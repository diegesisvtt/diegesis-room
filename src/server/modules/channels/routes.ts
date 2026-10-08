import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { listChannels, createChannel, updateChannel, deleteChannel } from "./service";
import { db } from "../../db/client";
import { channels } from "../../db/schema";
import { hostGuard, memberGuard } from "../../lib/guards";
import { authPlugin } from "../auth/plugin";

const nameSchema = z.object({
  name: z.string().trim().min(1).max(48),
});

async function campaignIdOfChannel(channelId: string): Promise<string | null> {
  const channel = await db.select().from(channels).where(eq(channels.id, channelId)).get();
  return channel?.campaignId ?? null;
}

export const channelsRoutes = new Elysia({ prefix: "/campaigns/:campaignId/channels" }).use(authPlugin)
  .get("/", async ({ params, query, user, set }) => {
    const check = await memberGuard(params.campaignId, user, query.profileToken);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    return listChannels(params.campaignId);
  })
  .post(
    "/",
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
      return createChannel(params.campaignId, parsed.data);
    },
    { body: t.Object({ name: t.String() }) },
  );

export const channelRoutes = new Elysia({ prefix: "/channels" }).use(authPlugin)
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const campaignId = await campaignIdOfChannel(params.id);
      if (!campaignId) {
        set.status = 404;
        return { error: "Channel not found" };
      }
      const check = await hostGuard(campaignId, user);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      const parsed = nameSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
      }
      const channel = await updateChannel(params.id, parsed.data);
      if (!channel) {
        set.status = 404;
        return { error: "Channel not found" };
      }
      return channel;
    },
    { body: t.Object({ name: t.String() }) },
  )
  .delete("/:id", async ({ params, user, set }) => {
    const campaignId = await campaignIdOfChannel(params.id);
    if (!campaignId) {
      set.status = 404;
      return { error: "Channel not found" };
    }
    const check = await hostGuard(campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    await deleteChannel(params.id);
    return { ok: true };
  });
