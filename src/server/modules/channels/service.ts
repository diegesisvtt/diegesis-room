import { and, asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "../../db/client";
import { channels } from "../../db/schema";
import { getRoomService } from "../../lib/livekit";

export async function listChannels(campaignId: string) {
  return db
    .select()
    .from(channels)
    .where(eq(channels.campaignId, campaignId))
    .orderBy(asc(channels.position));
}

export async function getChannel(id: string) {
  return db.select().from(channels).where(eq(channels.id, id)).get();
}

export async function createChannel(campaignId: string, input: { name: string }) {
  const existing = await db
    .select()
    .from(channels)
    .where(eq(channels.campaignId, campaignId))
    .orderBy(channels.position);
  const position = (existing[existing.length - 1]?.position ?? -1) + 1;

  const id = uuidv7();
  await db.insert(channels).values({ id, campaignId, name: input.name, position });
  return getChannel(id);
}

export async function updateChannel(id: string, input: { name: string }) {
  await db.update(channels).set({ name: input.name }).where(eq(channels.id, id));
  return getChannel(id);
}

export async function deleteChannel(id: string) {
  await db.delete(channels).where(eq(channels.id, id));
}

export type VoiceParticipant = {
  identity: string;
  name: string;
  photoUrl: string | null;
};

function parseMeta(metadata: string): { photo?: string; audience?: boolean } {
  try {
    const data = JSON.parse(metadata) as { photo?: unknown; audience?: unknown };
    return {
      photo: typeof data.photo === "string" ? data.photo : undefined,
      audience: data.audience === true,
    };
  } catch {
    return {};
  }
}

/**
 * Participantes de voz por canal (exclui audiência/streaming subscribe-only),
 * consultando as salas LiveKit diretamente. Retorna um mapa channelId -> lista.
 */
export async function listChannelPresence(campaignId: string): Promise<Record<string, VoiceParticipant[]>> {
  const presence: Record<string, VoiceParticipant[]> = {};
  const svc = await getRoomService();
  if (!svc) return presence;

  const channelList = await db.select().from(channels).where(eq(channels.campaignId, campaignId));
  await Promise.all(
    channelList.map(async (channel) => {
      presence[channel.id] = [];
      try {
        const participants = await svc.listParticipants(channel.id);
        presence[channel.id] = participants
          .filter((p) => !(p.permission?.canPublish === false || parseMeta(p.metadata).audience === true))
          .map((p) => ({
            identity: p.identity,
            name: p.name || p.identity,
            photoUrl: parseMeta(p.metadata).photo ?? null,
          }));
      } catch {
        /* sala vazia/inexistente ou LiveKit indisponível */
      }
    }),
  );
  return presence;
}
