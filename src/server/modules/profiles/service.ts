import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { db } from "../../db/client";
import { profiles } from "../../db/schema";

const UPLOADS_DIR = resolve(process.cwd(), "data", "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_NAME = 60;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB após decodificar
const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export type Profile = typeof profiles.$inferSelect;

export type ProfileDto = {
  id: string;
  campaignId: string;
  name: string;
  characterName: string | null;
  photoUrl: string | null;
  updatedAt: Date;
};

function toDto(profile: Profile): ProfileDto {
  return {
    id: profile.id,
    campaignId: profile.campaignId,
    name: profile.name,
    characterName: profile.characterName,
    photoUrl: profile.photoPath ? `/api/profiles/${profile.id}/photo?v=${profile.updatedAt.getTime()}` : null,
    updatedAt: profile.updatedAt,
  };
}

export async function getProfile(campaignId: string, token: string): Promise<ProfileDto | null> {
  const profile = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.campaignId, campaignId), eq(profiles.token, token)))
    .get();
  return profile ? toDto(profile) : null;
}

export type UpsertProfileInput = {
  token: string;
  name: string;
  characterName?: string | null;
  photo?: string | null; // data URL (data:image/...;base64,...)
};

export async function upsertProfile(campaignId: string, input: UpsertProfileInput): Promise<ProfileDto> {
  const name = input.name.trim().slice(0, MAX_NAME);
  if (!name) throw new Error("Nome é obrigatório");
  const characterName = input.characterName?.trim().slice(0, MAX_NAME) || null;

  const existing = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.campaignId, campaignId), eq(profiles.token, input.token)))
    .get();

  const id = existing?.id ?? uuidv7();
  let photoPath = existing?.photoPath ?? null;
  if (typeof input.photo === "string") {
    photoPath = await savePhoto(id, input.photo, photoPath);
  }

  const now = new Date();
  if (existing) {
    await db
      .update(profiles)
      .set({ name, characterName, photoPath, updatedAt: now })
      .where(eq(profiles.id, id));
    return toDto({ ...existing, name, characterName, photoPath, updatedAt: now });
  }

  await db.insert(profiles).values({ id, campaignId, token: input.token, name, characterName, photoPath });
  const created = await db.select().from(profiles).where(eq(profiles.id, id)).get();
  return toDto(created!);
}

async function savePhoto(id: string, dataUrl: string, previousPath: string | null): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) throw new Error("Foto inválida");
  const mime = match[1]!.toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error("Formato de foto não suportado (use png, jpeg ou webp)");

  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("Foto muito grande (máx. 2MB)");
  }

  const filePath = join(UPLOADS_DIR, `${id}${ext}`);
  if (previousPath && previousPath !== filePath && existsSync(previousPath)) {
    rmSync(previousPath, { force: true });
  }
  await Bun.write(filePath, bytes);
  return filePath;
}

export async function getPhotoFile(id: string): Promise<{ path: string; mime: string } | null> {
  const profile = await db.select().from(profiles).where(eq(profiles.id, id)).get();
  if (!profile?.photoPath || !existsSync(profile.photoPath)) return null;
  const ext = extname(profile.photoPath).toLowerCase();
  const mime = Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return { path: profile.photoPath, mime };
}
