import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { uuidv7 } from "uuidv7";
import { db } from "../../db/client";
import { invites, campaigns, channels } from "../../db/schema";

export async function createInvite(campaignId: string, role: "host" | "guest" = "guest") {
  const token = randomBytes(16).toString("base64url");
  const id = uuidv7();
  await db.insert(invites).values({ id, campaignId, token, role });
  return { id, campaignId, token, role, expiresAt: null, createdAt: new Date() };
}

export type ResolvedInvite = {
  token: string;
  role: "host" | "guest";
  campaign: typeof campaigns.$inferSelect;
  channels: (typeof channels.$inferSelect)[];
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

  const channelList = await db
    .select()
    .from(channels)
    .where(eq(channels.campaignId, campaign.id))
    .orderBy(channels.position);

  return { token, role: invite.role, campaign, channels: channelList };
}
