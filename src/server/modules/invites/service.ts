import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { uuidv7 } from "uuidv7";
import { db } from "../../db/client";
import { invites, campaigns } from "../../db/schema";

export async function createInvite(
  campaignId: string,
  role: "host" | "guest" = "guest",
  createdBy?: string,
) {
  const token = randomBytes(16).toString("base64url");
  const id = uuidv7();
  await db.insert(invites).values({ id, campaignId, token, role, createdBy });
  return { id, campaignId, token, role, expiresAt: null, createdAt: new Date() };
}

export async function listInvites(campaignId: string) {
  return db
    .select()
    .from(invites)
    .where(eq(invites.campaignId, campaignId))
    .orderBy(invites.createdAt);
}

export async function revokeInvite(campaignId: string, inviteId: string): Promise<boolean> {
  const existing = await db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.id, inviteId), eq(invites.campaignId, campaignId)))
    .get();
  if (!existing) return false;
  await db.delete(invites).where(eq(invites.id, inviteId));
  return true;
}

export type ResolvedInvite = {
  token: string;
  role: "host" | "guest";
  campaign: typeof campaigns.$inferSelect;
};

export async function resolveInvite(token: string): Promise<ResolvedInvite | null> {
  const invite = await db.select().from(invites).where(eq(invites.token, token)).get();
  if (!invite) return null;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return null;

  const campaign = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, invite.campaignId))
    .get();
  if (!campaign) return null;

  // Não expõe a lista de canais: channelId é credencial de audiência (modo TV).
  return { token, role: invite.role, campaign };
}
