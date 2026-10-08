import { and, eq, isNull, ne } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { uuidv7 } from "uuidv7";
import { db } from "../../db/client";
import { authSessions, profiles, users } from "../../db/schema";

export const SESSION_COOKIE = "diegesis_auth";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias

export type AuthUser = typeof users.$inferSelect;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
};

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    mustChangePassword: user.mustChangePassword === 1,
  };
}

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const user = await db.select().from(users).where(eq(users.email, normalized)).get();
  return user ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  const existing = await getUserByEmail(email);
  if (existing) throw new Error("Email já cadastrado");

  const id = uuidv7();
  const passwordHash = await hashPassword(input.password);
  await db.insert(users).values({ id, email, passwordHash, name: input.name.trim() });
  return (await db.select().from(users).where(eq(users.id, id)).get())!;
}

export async function verifyLogin(email: string, password: string): Promise<AuthUser | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const ok = await verifyPassword(user.passwordHash, password);
  return ok ? user : null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(authSessions).values({ id: token, userId, expiresAt });
  return token;
}

export async function getUserBySessionToken(token: string): Promise<AuthUser | null> {
  const session = await db.select().from(authSessions).where(eq(authSessions.id, token)).get();
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(authSessions).where(eq(authSessions.id, token));
    return null;
  }
  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
  return user ?? null;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.id, token));
}

/**
 * Gera uma senha temporária e marca o usuário para trocá-la no próximo login.
 * Retorna null se o email não existir.
 */
export async function resetPassword(email: string): Promise<string | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const temporary = randomBytes(5).toString("base64url"); // ~7-8 chars
  const passwordHash = await hashPassword(temporary);
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: 1, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  // Derruba sessões antigas por segurança.
  await db.delete(authSessions).where(eq(authSessions.userId, user.id));
  return temporary;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error("Usuário não encontrado");
  const ok = await verifyPassword(user.passwordHash, currentPassword);
  if (!ok) throw new Error("Senha atual incorreta");
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: 0, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Vincula ao usuário os perfis de convidado que este navegador já tinha
 * (mapa campaignId -> profileToken guardado no localStorage). Só vincula
 * perfis ainda sem dono; o token é rotacionado ao vincular para que o
 * token antigo (compartilhado/vazado) deixe de funcionar como bearer.
 */
export async function claimProfiles(
  userId: string,
  tokens: Record<string, string>,
): Promise<number> {
  let claimed = 0;
  for (const [campaignId, token] of Object.entries(tokens)) {
    if (!campaignId || !token) continue;
    // Update atômico com userId IS NULL no where: evita corrida entre dois
    // logins reivindicando o mesmo perfil. Se nenhum perfil casar, o update
    // simplesmente não afeta linha alguma.
    await db
      .update(profiles)
      .set({
        userId,
        token: randomBytes(24).toString("base64url"),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(profiles.campaignId, campaignId),
          eq(profiles.token, token),
          isNull(profiles.userId),
        ),
      );
    claimed += 1;
  }
  return claimed;
}

/** Derruba todas as sessões do usuário, exceto a informada (a atual). */
export async function destroyOtherSessions(userId: string, keepToken?: string): Promise<void> {
  if (keepToken) {
    await db
      .delete(authSessions)
      .where(and(eq(authSessions.userId, userId), ne(authSessions.id, keepToken)));
  } else {
    await db.delete(authSessions).where(eq(authSessions.userId, userId));
  }
}
