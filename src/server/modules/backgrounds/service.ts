import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { db } from "../../db/client";
import { campaignBackgrounds, userBackgrounds } from "../../db/schema";

const UPLOADS_DIR = resolve(process.cwd(), "data", "uploads", "backgrounds");
mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_NAME = 80;
const MAX_BYTES = 4 * 1024 * 1024; // 4MB após decodificar
const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export type BackgroundDto = { id: string; name: string; url: string };

export class BackgroundError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function toDto(id: string, name: string, updatedAt: Date, baseUrl: string): BackgroundDto {
  return { id, name, url: `${baseUrl}?v=${updatedAt.getTime()}` };
}

// ---- Fundos do usuário (globais, sincronizados com a conta) ----

export async function listUserBackgrounds(userId: string): Promise<BackgroundDto[]> {
  const rows = await db
    .select()
    .from(userBackgrounds)
    .where(eq(userBackgrounds.userId, userId))
    .orderBy(userBackgrounds.createdAt);
  return rows.map((r) => toDto(r.id, r.name, r.createdAt, `/api/backgrounds/${r.id}/file`));
}

export async function uploadUserBackground(userId: string, name: string, dataUrl: string): Promise<BackgroundDto> {
  const cleanName = name.trim().slice(0, MAX_NAME);
  if (!cleanName) throw new BackgroundError("Nome do fundo é obrigatório");
  const id = uuidv7();
  const stored = await storeImage(join(UPLOADS_DIR, "user", userId), id, dataUrl);
  await db.insert(userBackgrounds).values({
    id,
    userId,
    name: cleanName,
    path: stored.path,
    mime: stored.mime,
  });
  const row = await db.select().from(userBackgrounds).where(eq(userBackgrounds.id, id)).get();
  return toDto(id, cleanName, row!.createdAt, `/api/backgrounds/${id}/file`);
}

export async function deleteUserBackground(userId: string, id: string): Promise<void> {
  const row = await db
    .select()
    .from(userBackgrounds)
    .where(and(eq(userBackgrounds.id, id), eq(userBackgrounds.userId, userId)))
    .get();
  if (!row) return;
  await db.delete(userBackgrounds).where(eq(userBackgrounds.id, id));
  if (existsSync(row.path)) rmSync(row.path, { force: true });
}

export async function getUserBackgroundFile(id: string): Promise<{ path: string; mime: string } | null> {
  const row = await db.select().from(userBackgrounds).where(eq(userBackgrounds.id, id)).get();
  if (!row || !existsSync(row.path)) return null;
  return { path: row.path, mime: row.mime };
}

// ---- Fundos da campanha (oferecidos a todos os membros) ----

export async function listCampaignBackgrounds(campaignId: string): Promise<BackgroundDto[]> {
  const rows = await db
    .select()
    .from(campaignBackgrounds)
    .where(eq(campaignBackgrounds.campaignId, campaignId))
    .orderBy(campaignBackgrounds.createdAt);
  return rows.map((r) => toDto(r.id, r.name, r.createdAt, `/api/campaigns/${campaignId}/backgrounds/${r.id}/file`));
}

export async function uploadCampaignBackground(
  campaignId: string,
  createdBy: string,
  name: string,
  dataUrl: string,
): Promise<BackgroundDto> {
  const cleanName = name.trim().slice(0, MAX_NAME);
  if (!cleanName) throw new BackgroundError("Nome do fundo é obrigatório");
  const id = uuidv7();
  const stored = await storeImage(join(UPLOADS_DIR, "campaign", campaignId), id, dataUrl);
  await db.insert(campaignBackgrounds).values({
    id,
    campaignId,
    name: cleanName,
    path: stored.path,
    mime: stored.mime,
    createdBy,
  });
  const row = await db.select().from(campaignBackgrounds).where(eq(campaignBackgrounds.id, id)).get();
  return toDto(id, cleanName, row!.createdAt, `/api/campaigns/${campaignId}/backgrounds/${id}/file`);
}

export async function deleteCampaignBackground(campaignId: string, id: string): Promise<void> {
  const row = await db
    .select()
    .from(campaignBackgrounds)
    .where(and(eq(campaignBackgrounds.id, id), eq(campaignBackgrounds.campaignId, campaignId)))
    .get();
  if (!row) return;
  await db.delete(campaignBackgrounds).where(eq(campaignBackgrounds.id, id));
  if (existsSync(row.path)) rmSync(row.path, { force: true });
}

export async function getCampaignBackgroundFile(id: string): Promise<{ path: string; mime: string } | null> {
  const row = await db.select().from(campaignBackgrounds).where(eq(campaignBackgrounds.id, id)).get();
  if (!row || !existsSync(row.path)) return null;
  return { path: row.path, mime: row.mime };
}

// ---- Helpers de armazenamento ----

/** Decodifica o data URL, valida tamanho/formato e grava o arquivo no diretório alvo. */
async function storeImage(dir: string, id: string, dataUrl: string): Promise<{ path: string; mime: string }> {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) throw new BackgroundError("Imagem inválida");
  const mime = match[1]!.toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) throw new BackgroundError("Formato não suportado (use png, jpeg ou webp)");

  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new BackgroundError("Imagem muito grande (máx. 4MB)");
  }

  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${id}${ext}`);
  await Bun.write(filePath, bytes);
  return { path: filePath, mime };
}
