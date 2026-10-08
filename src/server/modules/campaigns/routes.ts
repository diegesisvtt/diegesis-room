import { Elysia, t } from "elysia";
import { z } from "zod";
import {
  listCampaignsForUser,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "./service";
import { hostGuard, userGuard } from "../../lib/guards";
import { authPlugin } from "../auth/plugin";

const nameSchema = z.object({ name: z.string().trim().min(1).max(64) });

export const campaignsRoutes = new Elysia({ prefix: "/campaigns" }).use(authPlugin)
  .get("/", async ({ user, set }) => {
    const auth = userGuard(user);
    if (!auth.ok) {
      set.status = auth.status;
      return { error: auth.error };
    }
    return listCampaignsForUser(user!.id);
  })
  .get("/:campaignId", async ({ params, query, user, set }) => {
    const campaign = await getCampaign(params.campaignId);
    if (!campaign) {
      set.status = 404;
      return { error: "Campaign not found" };
    }
    return campaign;
  })
  .post(
    "/",
    async ({ body, user, set }) => {
      const auth = userGuard(user);
      if (!auth.ok) {
        set.status = auth.status;
        return { error: auth.error };
      }
      const parsed = nameSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
      }
      return createCampaign(parsed.data.name, user!.id, user!.name);
    },
    { body: t.Object({ name: t.String() }) },
  )
  .patch(
    "/:campaignId",
    async ({ params, body, user, set }) => {
      const check = await hostGuard(params.campaignId, user);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      const parsed = nameSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
      }
      return updateCampaign(params.campaignId, parsed.data.name);
    },
    { body: t.Object({ name: t.String() }) },
  )
  .delete("/:campaignId", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    await deleteCampaign(params.campaignId);
    return { ok: true };
  });
