import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { campaigns, channels, profiles, users } from "../../db/schema";
import { getRoomService, removeParticipant } from "../../lib/livekit";

export type MemberDto = {
  id: string;
  campaignId: string;
  name: string;
  characterName: string | null;
  photoUrl: string | null;
  role: "host" | "guest";
  status: "pending" | "active" | "banned";
  isRegistered: boolean;
  accountName: string | null;
  isOwner: boolean;
  onlineNow: boolean;
  banReason: string | null;
  createdAt: Date;
};

function displayNameOf(profile: { name: string; characterName: string | null }): string {
  const character = profile.characterName?.trim();
  return character ? `${profile.name} · ${character}` : profile.name;
}

/** Nomes (LiveKit `name`) dos participantes online em qualquer canal da campanha. */
async function onlineNames(campaignId: string): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const svc = await getRoomService();
    if (!svc) return names;
    const channelList = await db
      .select()
      .from(channels)
      .where(eq(channels.campaignId, campaignId));
    await Promise.all(
      channelList.map(async (channel) => {
        try {
          const participants = await svc.listParticipants(channel.id);
          for (const p of participants) if (p.name) names.add(p.name);
        } catch {
          /* sala inexistente/vazia */
        }
      }),
    );
  } catch {
    /* LiveKit não configurado: todos offline */
  }
  return names;
}

export async function listMembers(campaignId: string): Promise<MemberDto[]> {
  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  const rows = await db
    .select({ profile: profiles, accountName: users.name })
    .from(profiles)
    .leftJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.campaignId, campaignId))
    .orderBy(profiles.createdAt);

  const online = await onlineNames(campaignId);

  return rows.map(({ profile, accountName }) => ({
    id: profile.id,
    campaignId: profile.campaignId,
    name: profile.name,
    characterName: profile.characterName,
    photoUrl: profile.photoPath
      ? `/api/profiles/${profile.id}/photo?v=${profile.updatedAt.getTime()}`
      : null,
    role: profile.role,
    status: profile.status,
    isRegistered: profile.userId !== null,
    accountName,
    isOwner: campaign?.ownerId != null && profile.userId === campaign.ownerId,
    onlineNow: online.has(displayNameOf(profile)) || online.has(profile.name),
    banReason: profile.banReason,
    createdAt: profile.createdAt,
  }));
}

async function getMemberProfile(campaignId: string, profileId: string) {
  return db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.campaignId, campaignId)))
    .get();
}

/** Remove o participante das salas LiveKit da campanha (melhor esforço). */
async function disconnectFromRooms(campaignId: string, profile: { name: string; characterName: string | null }) {
  try {
    const svc = await getRoomService();
    if (!svc) return;
    const channelList = await db.select().from(channels).where(eq(channels.campaignId, campaignId));
    const display = displayNameOf(profile);
    await Promise.all(
      channelList.map(async (channel) => {
        try {
          const participants = await svc.listParticipants(channel.id);
          for (const p of participants) {
            if (p.name === display || p.name === profile.name) {
              await removeParticipant(channel.id, p.identity);
            }
          }
        } catch {
          /* sala inexistente/vazia */
        }
      }),
    );
  } catch {
    /* LiveKit não configurado */
  }
}

export async function approveMember(campaignId: string, profileId: string, approvedBy: string) {
  const profile = await getMemberProfile(campaignId, profileId);
  if (!profile) throw new Error("Participante não encontrado");
  if (profile.status === "banned") throw new Error("Desbanir antes de aprovar novamente");
  await db
    .update(profiles)
    .set({ status: "active", approvedAt: new Date(), approvedBy, updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));
  return profile.token;
}

export async function rejectMember(campaignId: string, profileId: string) {
  const profile = await getMemberProfile(campaignId, profileId);
  if (!profile) throw new Error("Participante não encontrado");
  if (profile.status !== "pending") throw new Error("Só é possível rejeitar pedidos pendentes");
  await db.delete(profiles).where(eq(profiles.id, profile.id));
  return profile.token;
}

export async function kickMember(campaignId: string, profileId: string) {
  const profile = await getMemberProfile(campaignId, profileId);
  if (!profile) throw new Error("Participante não encontrado");
  await disconnectFromRooms(campaignId, profile);
  await db.delete(profiles).where(eq(profiles.id, profile.id));
  return profile.token;
}

export async function banMember(
  campaignId: string,
  profileId: string,
  bannedBy: string,
  reason?: string | null,
) {
  const profile = await getMemberProfile(campaignId, profileId);
  if (!profile) throw new Error("Participante não encontrado");
  await disconnectFromRooms(campaignId, profile);
  await db
    .update(profiles)
    .set({
      status: "banned",
      bannedAt: new Date(),
      bannedBy,
      banReason: reason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));
  return profile.token;
}

export async function unbanMember(campaignId: string, profileId: string) {
  const profile = await getMemberProfile(campaignId, profileId);
  if (!profile) throw new Error("Participante não encontrado");
  if (profile.status !== "banned") throw new Error("Participante não está banido");
  // Volta para pendente: precisa ser aprovado de novo para participar.
  await db
    .update(profiles)
    .set({ status: "pending", bannedAt: null, bannedBy: null, banReason: null, updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));
}

/** Guarda contra moderar o dono da campanha. */
export async function isOwnerProfile(campaignId: string, profileId: string): Promise<boolean> {
  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  const profile = await getMemberProfile(campaignId, profileId);
  return campaign?.ownerId != null && profile?.userId === campaign.ownerId;
}
