import { Elysia, t } from "elysia";
import { createInvite, resolveInvite } from "./service";
import { publicOrigin } from "../../lib/settings";

export const invitesRoutes = new Elysia({ prefix: "/invites" })
  .post(
    "/",
    async ({ body }) => {
      const invite = await createInvite(body.campaignId, body.role);
      const origin = publicOrigin();
      return { ...invite, url: `${origin}/join/${invite.token}` };
    },
    {
      body: t.Object({
        campaignId: t.String(),
        role: t.Optional(t.Union([t.Literal("host"), t.Literal("guest")])),
      }),
    },
  )
  .get("/:token", async ({ params, set }) => {
    const resolved = await resolveInvite(params.token);
    if (!resolved) {
      set.status = 404;
      return { error: "Invite not found or expired" };
    }
    return resolved;
  });
