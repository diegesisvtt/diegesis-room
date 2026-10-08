import { and, asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "../../db/client";
import { channels } from "../../db/schema";

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
