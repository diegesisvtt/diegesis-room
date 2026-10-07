import { Elysia, t } from "elysia";
import { z } from "zod";
import { listChannels, createChannel, deleteChannel } from "./service";

const createSchema = z.object({
  name: z.string().trim().min(1).max(48),
});

export const channelsRoutes = new Elysia({ prefix: "/campaigns/:campaignId/channels" })
  .get("/", async ({ params }) => listChannels(params.campaignId))
  .post(
    "/",
    async ({ params, body, set }) => {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
      }
      return createChannel(params.campaignId, parsed.data);
    },
    { body: t.Object({ name: t.String() }) },
  );

export const channelRoutes = new Elysia({ prefix: "/channels" }).delete(
  "/:id",
  async ({ params }) => {
    await deleteChannel(params.id);
    return { ok: true };
  },
);
