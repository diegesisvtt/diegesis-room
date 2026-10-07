import { and, asc, desc, eq, gt } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "../../db/client";
import { messages } from "../../db/schema";

export type NewMessage = {
  authorName: string;
  body: string;
  kind?: "text" | "roll" | "system";
  rollJson?: string;
};

export async function listMessages(channelId: string, limit = 50) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.reverse();
}

// uuidv7 ids are time-ordered, so id comparison works as a cursor.
export async function listMessagesAfter(channelId: string, afterId: string, limit = 200) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.channelId, channelId), gt(messages.id, afterId)))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function createMessage(channelId: string, input: NewMessage) {
  let rollJson: string | null = null;
  if (input.rollJson) {
    try {
      JSON.parse(input.rollJson);
    } catch {
      throw new Error("Invalid roll payload");
    }
    rollJson = input.rollJson.slice(0, 8000);
  }

  const id = uuidv7();
  const row = {
    id,
    channelId,
    authorName: input.authorName.trim().slice(0, 48) || "Anônimo",
    body: input.body.slice(0, 4000),
    kind: input.kind ?? "text",
    rollJson,
  };
  await db.insert(messages).values(row);
  return db.select().from(messages).where(eq(messages.id, id)).get();
}
