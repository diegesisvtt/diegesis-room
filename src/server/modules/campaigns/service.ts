import { and, eq, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { randomBytes } from "node:crypto";
import { db } from "../../db/client";
import { campaigns, profiles } from "../../db/schema";

export type CampaignEntry = {
  id: string;
  name: string;
  ownerId: string | null;
  createdAt: Date;
  isOwner: boolean;
  myRole: "host" | "guest" | null;
  myStatus: "pending" | "active" | "banned" | null;
};

/** Campanhas que o usuário criou ou das quais participa (não banido). */
export async function listCampaignsForUser(userId: string): Promise<CampaignEntry[]> {
  const rows = await db
    .select({ campaign: campaigns, profile: profiles })
    .from(campaigns)
    .leftJoin(
      profiles,
      and(eq(profiles.campaignId, campaigns.id), eq(profiles.userId, userId)),
    )
    .where(or(eq(campaigns.ownerId, userId), eq(profiles.userId, userId)))
    .orderBy(campaigns.createdAt);

  const seen = new Map<string, CampaignEntry>();
  for (const { campaign, profile } of rows) {
    if (profile && profile.userId !== userId) continue;
    if (profile?.status === "banned") continue;
    const existing = seen.get(campaign.id);
    const entry: CampaignEntry = {
      id: campaign.id,
      name: campaign.name,
      ownerId: campaign.ownerId,
      createdAt: campaign.createdAt,
      isOwner: campaign.ownerId === userId,
      myRole: profile?.role ?? null,
      myStatus: profile?.status ?? null,
    };
    // Prefere a linha com profile (join pode duplicar).
    if (!existing || profile) seen.set(campaign.id, entry);
  }
  return [...seen.values()];
}

export async function getCampaign(id: string) {
  return db.select().from(campaigns).where(eq(campaigns.id, id)).get();
}

export async function createCampaign(name: string, ownerId: string, ownerName: string) {
  const id = uuidv7();
  await db.insert(campaigns).values({ id, name, ownerId });
  // Perfil do dono: host, já ativo. Token aleatório de servidor — o navegador
  // o descobre via GET /profiles/me (cookie) e passa a usá-lo.
  await db.insert(profiles).values({
    id: uuidv7(),
    campaignId: id,
    token: randomBytes(24).toString("base64url"),
    userId: ownerId,
    name: ownerName,
    role: "host",
    status: "active",
    approvedAt: new Date(),
    approvedBy: ownerId,
  });
  return getCampaign(id);
}

export async function updateCampaign(id: string, name: string) {
  await db.update(campaigns).set({ name }).where(eq(campaigns.id, id));
  return getCampaign(id);
}

export async function deleteCampaign(id: string) {
  await db.delete(campaigns).where(eq(campaigns.id, id));
}
