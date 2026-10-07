import { Elysia, t } from "elysia";
import { listMessages, listMessagesAfter, createMessage } from "./service";

export const chatRoutes = new Elysia({ prefix: "/channels" })
  .get("/:id/messages", async ({ params, query }) =>
    listMessages(params.id, Number(query.limit ?? 50)),
  )
  .post(
    "/:id/messages",
    async ({ params, body, set }) => {
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
      }),
    },
  );

// Connected sockets per channel. Delivery is driven by the messages table
// (see the watcher below), so messages written by any instance — or while a
// client was disconnected — still reach subscribers.
type Socket = { send: (data: string) => void };
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

export const chatWs = new Elysia().ws("/ws/channels/:id", {
  open(ws) {
    const channelId = ws.data.params.id;
    subscribe(channelId, ws);
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
  },
  close(ws) {
    const channelId = ws.data.params.id;
    unsubscribe(channelId, ws);
  },
  message(ws, raw) {
    const channelId = ws.data.params.id;
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

    void createMessage(channelId, {
      authorName: data.authorName,
      body: data.body,
      kind: data.kind,
      rollJson: data.rollJson,
    }).then((message) => {
      if (message) deliver(channelId, [message]);
    });
  },
});
