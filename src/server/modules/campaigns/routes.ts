import { Elysia, t } from "elysia";
import { z } from "zod";
import { listCampaigns, getCampaign, createCampaign } from "./service";

const createSchema = z.object({ name: z.string().trim().min(1).max(64) });

export const campaignsRoutes = new Elysia({ prefix: "/campaigns" })
  .get("/", async () => listCampaigns())
  .get("/:campaignId", async ({ params, set }) => {
    const campaign = await getCampaign(params.campaignId);
    if (!campaign) {
      set.status = 404;
      return { error: "Campaign not found" };
    }
    return campaign;
  })
  .post(
    "/",
    async ({ body, set }) => {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
      }
      return createCampaign(parsed.data.name);
    },
    { body: t.Object({ name: t.String() }) },
  );
