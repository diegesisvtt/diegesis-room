import { and, asc, desc, eq, gt } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { db } from "../../db/client";
import { messages } from "../../db/schema";

const UPLOADS_DIR = resolve(process.cwd(), "data", "uploads", "chat");
mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB após decodificar
const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type NewMessage = {
  authorName: string;
  body: string;
  kind?: "text" | "roll" | "system" | "image";
  rollJson?: string;
  image?: string; // data URL (data:image/...;base64,...)
};

type MessageRow = typeof messages.$inferSelect;
export type MessageDto = Omit<MessageRow, "imagePath" | "imageMime"> & {
  imageUrl: string | null;
};

/** Expõe a URL pública da imagem e oculta o caminho no filesystem. */
function toDto(row: MessageRow): MessageDto {
  const { imagePath, imageMime, ...rest } = row;
  return {
    ...rest,
    imageUrl: imagePath ? `/api/channels/messages/${row.id}/image` : null,
  };
}

export async function listMessages(channelId: string, limit = 50): Promise<MessageDto[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.reverse().map(toDto);
}

// uuidv7 ids are time-ordered, so id comparison works as a cursor.
export async function listMessagesAfter(channelId: string, afterId: string, limit = 200): Promise<MessageDto[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.channelId, channelId), gt(messages.id, afterId)))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(toDto);
}

export async function createMessage(channelId: string, input: NewMessage): Promise<MessageDto> {
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

  // Imagem anexada: grava o arquivo e aponta o registro para ele.
  let imagePath: string | null = null;
  let imageMime: string | null = null;
  if (input.image) {
    const stored = await storeChatImage(channelId, id, input.image);
    imagePath = stored.path;
    imageMime = stored.mime;
  }

  const row = {
    id,
    channelId,
    authorName: input.authorName.trim().slice(0, 48) || "Anônimo",
    body: input.body.slice(0, 4000),
    kind: input.kind ?? (imagePath ? "image" : "text"),
    rollJson,
    imagePath,
    imageMime,
  };
  await db.insert(messages).values(row);
  const created = await db.select().from(messages).where(eq(messages.id, id)).get();
  return toDto(created!);
}

export async function getMessageImageFile(id: string): Promise<{ path: string; mime: string } | null> {
  const row = await db.select().from(messages).where(eq(messages.id, id)).get();
  if (!row?.imagePath || !existsSync(row.imagePath)) return null;
  return { path: row.imagePath, mime: row.imageMime ?? "application/octet-stream" };
}

/** Decodifica o data URL, valida tamanho/formato e grava o arquivo no disco. */
async function storeChatImage(channelId: string, id: string, dataUrl: string): Promise<{ path: string; mime: string }> {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) throw new Error("Imagem inválida");
  const mime = match[1]!.toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error("Formato de imagem não suportado (use png, jpeg, webp ou gif)");

  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("Imagem muito grande (máx. 4MB)");
  }

  const dir = join(UPLOADS_DIR, channelId);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${id}${ext}`);
  await Bun.write(filePath, bytes);
  return { path: filePath, mime };
}
