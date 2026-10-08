import { Elysia, t } from "elysia";
import { createInvite, listInvites, resolveInvite, revokeInvite } from "./service";
import { publicOrigin } from "../../lib/settings";
import { hostGuard } from "../../lib/guards";
import { authPlugin } from "../auth/plugin";

export const invitesRoutes = new Elysia({ prefix: "/invites" }).use(authPlugin)
  .post(
    "/",
    async ({ body, user, set }) => {
      const check = await hostGuard(body.campaignId, user);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      const invite = await createInvite(body.campaignId, body.role, user!.id);
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
  .get("/campaign/:campaignId", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    const origin = publicOrigin();
    const list = await listInvites(params.campaignId);
    return list.map((invite) => ({ ...invite, url: `${origin}/join/${invite.token}` }));
  })
  .delete("/:id/campaign/:campaignId", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    const revoked = await revokeInvite(params.campaignId, params.id);
    if (!revoked) {
      set.status = 404;
      return { error: "Invite not found" };
    }
    return { ok: true };
  })
  .get("/:token", async ({ params, set }) => {
    const resolved = await resolveInvite(params.token);
    if (!resolved) {
      set.status = 404;
      return { error: "Invite not found or expired" };
    }
    return resolved;
  });
