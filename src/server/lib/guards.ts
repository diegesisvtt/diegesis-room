import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { campaigns, profiles } from "../db/schema";
import type { AuthUser } from "../modules/auth/service";

export type Membership = typeof profiles.$inferSelect;

export type GuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const NEEDS_PASSWORD_CHANGE: GuardResult = {
  ok: false,
  status: 403,
  error: "password_change_required",
};

/** Usuário precisa estar logado e com senha definitiva. */
export function userGuard(user: AuthUser | null): GuardResult {
  if (!user) return { ok: false, status: 401, error: "Login necessário" };
  if (user.mustChangePassword === 1) return NEEDS_PASSWORD_CHANGE;
  return { ok: true };
}

/**
 * Resolve a identidade do participante numa campanha: pelo usuário logado
 * (userId no profile) ou pelo token de convidado do navegador.
 */
export async function resolveMembership(
  campaignId: string,
  user: AuthUser | null,
  profileToken?: string | null,
): Promise<Membership | null> {
  if (user) {
    const byUser = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.campaignId, campaignId), eq(profiles.userId, user.id)))
      .get();
    if (byUser) return byUser;
  }
  if (profileToken) {
    const byToken = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.campaignId, campaignId), eq(profiles.token, profileToken)))
      .get();
    if (byToken) return byToken;
  }
  return null;
}

/** Participante precisa estar aprovado (status active) na campanha. */
export async function memberGuard(
  campaignId: string,
  user: AuthUser | null,
  profileToken?: string | null,
): Promise<GuardResult & { membership?: Membership }> {
  if (user?.mustChangePassword === 1) return NEEDS_PASSWORD_CHANGE;
  const membership = await resolveMembership(campaignId, user, profileToken);
  if (!membership) {
    return { ok: false, status: 403, error: "Você não participa desta campanha" };
  }
  if (membership.status === "banned") {
    return { ok: false, status: 403, error: "Você foi banido desta campanha", membership };
  }
  if (membership.status !== "active") {
    return { ok: false, status: 403, error: "Aguardando aprovação do anfitrião", membership };
  }
  return { ok: true, membership };
}

/** Apenas o dono da campanha ou um participante host (com conta) pode moderar. */
export async function hostGuard(
  campaignId: string,
  user: AuthUser | null,
): Promise<GuardResult & { membership?: Membership }> {
  const auth = userGuard(user);
  if (!auth.ok) return auth;

  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) return { ok: false, status: 404, error: "Campanha não encontrada" };
  if (campaign.ownerId === user!.id) {
    const membership = await resolveMembership(campaignId, user);
    return { ok: true, membership: membership ?? undefined };
  }

  const membership = await resolveMembership(campaignId, user);
  if (membership && membership.role === "host" && membership.status === "active") {
    return { ok: true, membership };
  }
  return { ok: false, status: 403, error: "Apenas o anfitrião pode fazer isso" };
}
