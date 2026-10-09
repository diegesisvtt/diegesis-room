import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { listMessages, listMessagesAfter, createMessage } from "./service";
import { db } from "../../db/client";
import { channels } from "../../db/schema";
import { memberGuard } from "../../lib/guards";
import { authPlugin } from "../auth/plugin";

async function campaignIdOfChannel(channelId: string): Promise<string | null> {
  const channel = await db.select().from(channels).where(eq(channels.id, channelId)).get();
  return channel?.campaignId ?? null;
}

export const chatRoutes = new Elysia({ prefix: "/channels" }).use(authPlugin)
  .get("/:id/messages", async ({ params, query, user, set }) => {
    const campaignId = await campaignIdOfChannel(params.id);
    if (!campaignId) {
      set.status = 404;
      return { error: "Channel not found" };
    }
    const check = await memberGuard(campaignId, user, query.profileToken);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    return listMessages(params.id, Number(query.limit ?? 50));
  })
  .post(
    "/:id/messages",
    async ({ params, body, user, set }) => {
      const campaignId = await campaignIdOfChannel(params.id);
      if (!campaignId) {
        set.status = 404;
        return { error: "Channel not found" };
      }
      const check = await memberGuard(campaignId, user, body.profileToken);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      try {
        const message = await createMessage(params.id, body);
        if (message) deliver(params.id, [message]);
        return message;
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : "Unable to send message" };
      }
    },
    {
      body: t.Object({
        authorName: t.String(),
        body: t.String(),
        kind: t.Optional(t.Union([t.Literal("text"), t.Literal("roll"), t.Literal("system")])),
        rollJson: t.Optional(t.String()),
        profileToken: t.Optional(t.String()),
      }),
    },
  );

// Connected sockets per channel. Delivery is driven by the messages table
// (see the watcher below), so messages written by any instance — or while a
// client was disconnected — still reach subscribers.
// NOTE: Elysia creates a new ElysiaWS wrapper per event, so socket identity
// must go through `ws.raw` (the stable Bun ServerWebSocket), never `ws`.
type Socket = { send: (data: string) => void; close: () => void };
type MessageRow = NonNullable<Awaited<ReturnType<typeof createMessage>>>;

const subscribers = new Map<string, Set<Socket>>();
const lastDelivered = new Map<string, string>();

function subscribe(channelId: string, ws: Socket) {
  let set = subscribers.get(channelId);
  if (!set) {
    set = new Set();
    subscribers.set(channelId, set);
  }
  set.add(ws);
}

function unsubscribe(channelId: string, ws: Socket) {
  const set = subscribers.get(channelId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    subscribers.delete(channelId);
    lastDelivered.delete(channelId);
  }
}

function broadcast(channelId: string, payload: string) {
  const set = subscribers.get(channelId);
  if (!set) return;
  for (const ws of set) {
    try {
      ws.send(payload);
    } catch {
      /* socket may be closing */
    }
  }
}

function deliver(channelId: string, rows: MessageRow[]) {
  if (!subscribers.has(channelId)) return;
  for (const message of rows) {
    broadcast(channelId, JSON.stringify({ type: "message", message }));
    lastDelivered.set(channelId, message.id);
  }
}

// Persisted broadcast: poll the messages table so any persisted row — written
// via REST, another process, or during a socket gap — is delivered to live
// subscribers. The DB is the source of truth; subscribers are just a cache.
const WATCH_INTERVAL_MS = 1000;
setInterval(() => {
  for (const channelId of subscribers.keys()) {
    const since = lastDelivered.get(channelId) ?? "";
    void listMessagesAfter(channelId, since)
      .then((rows) => deliver(channelId, rows))
      .catch(() => {});
  }
}, WATCH_INTERVAL_MS);

const authorizedSockets = new WeakSet<object>();
// Audiência (modo streaming): recebe mensagens, mas não pode enviar.
const audienceSockets = new WeakSet<object>();
const socketProfileTokens = new WeakMap<object, string>();
// Mapa reverso para derrubar sockets de um perfil (kick/ban/reject).
const socketsByProfileToken = new Map<string, Set<{ close: () => void }>>();

/** Fecha todos os sockets de chat de um perfil (chamado ao expulsar/banir/rejeitar). */
export function dropSocketsForProfile(profileToken: string) {
  const sockets = socketsByProfileToken.get(profileToken);
  if (!sockets) return;
  for (const ws of sockets) {
    try {
      ws.close();
    } catch {
      /* já fechado */
    }
  }
  socketsByProfileToken.delete(profileToken);
}

export const chatWs = new Elysia().ws("/ws/channels/:id", {
  open(ws) {
    const channelId = ws.data.params.id;
    const profileToken = ws.data.query.profileToken;
    const isAudience = ws.data.query.audience === "1";
    // Membros ativos enviam/recebem; audiência (modo streaming) só recebe.
    void (async () => {
      const campaignId = await campaignIdOfChannel(channelId);
      const check = campaignId
        ? await memberGuard(campaignId, null, profileToken)
        : ({ ok: false } as const);
      if (!check.ok && !isAudience) {
        ws.close();
        return;
      }
      if (isAudience) {
        audienceSockets.add(ws.raw);
      } else {
        authorizedSockets.add(ws.raw);
        if (profileToken) {
          socketProfileTokens.set(ws.raw, profileToken);
          let set = socketsByProfileToken.get(profileToken);
          if (!set) {
            set = new Set();
            socketsByProfileToken.set(profileToken, set);
          }
          set.add(ws.raw);
        }
      }
      subscribe(channelId, ws.raw);
      // On reconnect the client passes ?since=<lastMessageId> to fill only the gap.
      const since = ws.data.query.since;
      const pending = since
        ? listMessagesAfter(channelId, since)
        : listMessages(channelId, 50);
      void pending.then((history) => {
        ws.send(JSON.stringify({ type: "history", messages: history }));
        const last = history[history.length - 1];
        if (last) {
          const current = lastDelivered.get(channelId);
          if (!current || current < last.id) lastDelivered.set(channelId, last.id);
        }
      });
    })();
  },
  close(ws) {
    const channelId = ws.data.params.id;
    audienceSockets.delete(ws.raw);
    const profileToken = socketProfileTokens.get(ws.raw);
    if (profileToken) {
      const set = socketsByProfileToken.get(profileToken);
      set?.delete(ws.raw);
      if (set && set.size === 0) socketsByProfileToken.delete(profileToken);
    }
    unsubscribe(channelId, ws.raw);
  },
  message(ws, raw) {
    if (!authorizedSockets.has(ws.raw)) return;
    const channelId = ws.data.params.id;
    const profileToken = socketProfileTokens.get(ws.raw);
    // Elysia auto-parses JSON string frames into objects.
    let data: { type?: string; authorName?: string; body?: string; kind?: "text" | "roll" | "system"; rollJson?: string };
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }
    } else if (raw && typeof raw === "object") {
      data = raw as typeof data;
    } else {
      return;
    }

    if (data.type !== "message" || !data.authorName || !data.body) return;

    // Revalida o membership a cada mensagem: ban/kick durante a sessão
    // interrompem o participante sem esperar ele fechar a aba.
    void (async () => {
      const campaignId = await campaignIdOfChannel(channelId);
      const check = campaignId
        ? await memberGuard(campaignId, null, profileToken)
        : ({ ok: false } as const);
      if (!check.ok) {
        ws.close();
        return;
      }
      const message = await createMessage(channelId, {
        authorName: data.authorName!,
        body: data.body!,
        kind: data.kind,
        rollJson: data.rollJson,
      });
      if (message) deliver(channelId, [message]);
    })();
  },
});
