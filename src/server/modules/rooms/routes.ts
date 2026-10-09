import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requestToken } from "./service";
import { muteParticipant, removeParticipant } from "../../lib/livekit";
import { db } from "../../db/client";
import { channels } from "../../db/schema";
import { hostGuard, memberGuard } from "../../lib/guards";
import { getStreamDisplayMode } from "../campaigns/service";
import { authPlugin } from "../auth/plugin";

const TokenBody = t.Object({
  channelId: t.String(),
  participantName: t.String(),
  audience: t.Optional(t.Boolean()),
  profileToken: t.Optional(t.String()),
});

async function campaignIdOfChannel(channelId: string): Promise<string | null> {
  const channel = await db.select().from(channels).where(eq(channels.id, channelId)).get();
  return channel?.campaignId ?? null;
}

export const roomsRoutes = new Elysia({ prefix: "/rooms" }).use(authPlugin)
  // Issue a LiveKit token (direct join, or subscribe-only for audience/streaming)
  .post(
    "/token",
    async ({ body, user, set }) => {
      const campaignId = await campaignIdOfChannel(body.channelId);
      let photoUrl: string | null = null;
      let name: string | null = null;
      let characterName: string | null = null;
      // Audience (modo TV/streaming): subscribe-only, link público do canal.
      if (!body.audience) {
        if (!campaignId) {
          set.status = 404;
          return { error: "Channel not found" };
        }
        const check = await memberGuard(campaignId, user, body.profileToken);
        if (!check.ok) {
          set.status = check.status;
          return { error: check.error };
        }
        const membership = check.membership;
        if (membership?.photoPath) {
          photoUrl = `/api/profiles/${membership.id}/photo?v=${membership.updatedAt.getTime()}`;
        }
        name = membership?.name ?? null;
        characterName = membership?.characterName ?? null;
      }
      try {
        const result = await requestToken({ ...body, photoUrl, name, characterName });
        // Modo de exibição de nomes no streaming (configurado por campanha).
        const streamDisplayMode = campaignId ? await getStreamDisplayMode(campaignId) : "both";
        return { ...result, streamDisplayMode };
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : "Unable to issue token" };
      }
    },
    { body: TokenBody },
  )
  // Moderation (host da campanha apenas)
  .post(
    "/:channelId/participants/mute",
    async ({ params, body, user, set }) => {
      const campaignId = await campaignIdOfChannel(params.channelId);
      if (!campaignId) {
        set.status = 404;
        return { error: "Channel not found" };
      }
      const check = await hostGuard(campaignId, user);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      await muteParticipant(params.channelId, body.identity, body.muted);
      return { ok: true };
    },
    { body: t.Object({ identity: t.String(), muted: t.Boolean() }) },
  )
  .post(
    "/:channelId/participants/remove",
    async ({ params, body, user, set }) => {
      const campaignId = await campaignIdOfChannel(params.channelId);
      if (!campaignId) {
        set.status = 404;
        return { error: "Channel not found" };
      }
      const check = await hostGuard(campaignId, user);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      await removeParticipant(params.channelId, body.identity);
      return { ok: true };
    },
    { body: t.Object({ identity: t.String() }) },
  );
