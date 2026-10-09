import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { db } from "../../db/client";
import { invites, profiles } from "../../db/schema";
import type { AuthUser } from "../auth/service";

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
  token: string;
  name: string;
  characterName: string | null;
  photoUrl: string | null;
  role: "host" | "guest";
  status: "pending" | "active" | "banned";
  isRegistered: boolean;
  updatedAt: Date;
};

export class ProfileError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function toDto(profile: Profile): ProfileDto {
  return {
    id: profile.id,
    campaignId: profile.campaignId,
    token: profile.token,
    name: profile.name,
    characterName: profile.characterName,
    photoUrl: profile.photoPath ? `/api/profiles/${profile.id}/photo?v=${profile.updatedAt.getTime()}` : null,
    role: profile.role,
    status: profile.status,
    isRegistered: profile.userId !== null,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Perfil "me": pelo token de convidado do navegador ou, na falta dele, pelo
 * usuário logado (cookie de sessão).
 */
export async function getProfile(
  campaignId: string,
  token: string | undefined,
  user: AuthUser | null,
): Promise<ProfileDto | null> {
  if (token) {
    const profile = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.campaignId, campaignId), eq(profiles.token, token)))
      .get();
    if (profile) return toDto(profile);
  }
  if (user) {
    const profile = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.campaignId, campaignId), eq(profiles.userId, user.id)))
      .get();
    if (profile) return toDto(profile);
  }
  return null;
}

export type UpsertProfileInput = {
  token: string;
  name: string;
  characterName?: string | null;
  photo?: string | null; // data URL (data:image/...;base64,...)
  inviteToken?: string | null;
};

export async function upsertProfile(
  campaignId: string,
  input: UpsertProfileInput,
  user: AuthUser | null,
): Promise<ProfileDto> {
  const name = input.name.trim().slice(0, MAX_NAME);
  if (!name) throw new ProfileError("Nome é obrigatório");
  const characterName = input.characterName?.trim().slice(0, MAX_NAME) || null;

  // Perfil existente: pelo token, ou pelo usuário logado (ex.: perfil do dono
  // criado no servidor, cujo token o navegador ainda não conhece).
  let existing =
    (await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.campaignId, campaignId), eq(profiles.token, input.token)))
      .get()) ?? null;
  if (!existing && user) {
    existing =
      (await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.campaignId, campaignId), eq(profiles.userId, user.id)))
        .get()) ?? null;
  }

  if (existing?.status === "banned") {
    throw new ProfileError("Você foi banido desta campanha", 403);
  }

  // Convite válido para esta campanha (se informado).
  const invite = input.inviteToken
    ? await db.select().from(invites).where(eq(invites.token, input.inviteToken)).get()
    : null;
  const validInvite = invite && invite.campaignId === campaignId ? invite : null;

  // Perfil novo só nasce via convite válido — evita spam na fila de aprovação.
  if (!existing && !validInvite) {
    throw new ProfileError("Convite inválido para esta campanha", 403);
  }

  const id = existing?.id ?? uuidv7();
  let photoPath = existing?.photoPath ?? null;
  if (typeof input.photo === "string") {
    photoPath = await savePhoto(id, input.photo, photoPath);
  }

  const now = new Date();
  if (existing) {
    // Atualização nunca rebaixa status nem desvincula a conta. Convite de
    // anfitrião + conta elevam um perfil já existente a host ativo.
    const elevate = validInvite?.role === "host" && user && existing.role !== "host";
    await db
      .update(profiles)
      .set({
        token: input.token,
        name,
        characterName,
        photoPath,
        userId: existing.userId ?? user?.id ?? null,
        ...(elevate
          ? {
              role: "host" as const,
              status: "active" as const,
              approvedAt: now,
              approvedBy: validInvite.createdBy,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(profiles.id, id));
    return toDto({
      ...existing,
      token: input.token,
      name,
      characterName,
      photoPath,
      userId: existing.userId ?? user?.id ?? null,
      ...(elevate
        ? { role: "host" as const, status: "active" as const, approvedAt: now, approvedBy: validInvite.createdBy }
        : {}),
      updatedAt: now,
    });
  }

  // Papel e status iniciais: convite de anfitrião só vale para quem tem conta.
  const asHost = validInvite!.role === "host" && user;
  try {
    await db.insert(profiles).values({
      id,
      campaignId,
      token: input.token,
      userId: user?.id ?? null,
      name,
      characterName,
      photoPath,
      role: asHost ? "host" : "guest",
      status: asHost ? "active" : "pending",
      inviteToken: validInvite!.token,
      approvedAt: asHost ? now : null,
      approvedBy: asHost ? validInvite!.createdBy : null,
    });
  } catch (err) {
    // Corrida entre abas/requisições: token ou (campaignId, userId) duplicado.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("profiles_token_idx") || message.includes("profiles.token")) {
      throw new ProfileError("Este perfil já foi criado — recarregue a página", 409);
    }
    if (message.includes("profiles_campaign_user_idx")) {
      throw new ProfileError("Você já tem um perfil nesta campanha — recarregue a página", 409);
    }
    throw err;
  }
  const created = await db.select().from(profiles).where(eq(profiles.id, id)).get();
  return toDto(created!);
}

async function savePhoto(id: string, dataUrl: string, previousPath: string | null): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) throw new ProfileError("Foto inválida");
  const mime = match[1]!.toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) throw new ProfileError("Formato de foto não suportado (use png, jpeg ou webp)");

  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    throw new ProfileError("Foto muito grande (máx. 2MB)");
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
