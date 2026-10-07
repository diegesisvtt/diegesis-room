import { Elysia, t } from "elysia";
import { requestToken } from "./service";
import { muteParticipant, removeParticipant } from "../../lib/livekit";

const TokenBody = t.Object({
  channelId: t.String(),
  participantName: t.String(),
  role: t.Optional(t.Union([t.Literal("host"), t.Literal("guest")])),
  audience: t.Optional(t.Boolean()),
});

export const roomsRoutes = new Elysia({ prefix: "/rooms" })
  // Issue a LiveKit token (direct join, or subscribe-only for audience/TV)
  .post(
    "/token",
    async ({ body, set }) => {
      try {
        return await requestToken(body);
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : "Unable to issue token" };
      }
    },
    { body: TokenBody },
  )
  // Moderation
  .post(
    "/:channelId/participants/mute",
    async ({ params, body }) => {
      await muteParticipant(params.channelId, body.identity, body.muted);
      return { ok: true };
    },
    { body: t.Object({ identity: t.String(), muted: t.Boolean() }) },
  )
  .post(
    "/:channelId/participants/remove",
    async ({ params, body }) => {
      await removeParticipant(params.channelId, body.identity);
      return { ok: true };
    },
    { body: t.Object({ identity: t.String() }) },
  );
