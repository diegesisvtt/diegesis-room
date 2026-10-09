import { Elysia, t } from "elysia";
import { z } from "zod";
import { userGuard } from "../../lib/guards";
import { authPlugin } from "../auth/plugin";
import { getUserPreferences, saveUserPreferences } from "./service";

const patchSchema = z
  .object({
    shareQuality: z.enum(["720", "1080", "1440", "2160"]).optional(),
    cameraQuality: z.enum(["360", "540", "720", "1080", "1440", "2160"]).optional(),
    echoCancellation: z.boolean().optional(),
    noiseSuppression: z.boolean().optional(),
    noiseCancellation: z.enum(["none", "voice-isolation", "krisp"]).optional(),
    krispModel: z.enum(["nc", "bvc"]).optional(),
    krispQuality: z.enum(["low", "medium", "high"]).optional(),
    autoGainControl: z.boolean().optional(),
    visualEffects: z.boolean().optional(),
    showOthersRolls: z.boolean().optional(),
    stereo: z.boolean().optional(),
    contentHint: z.enum(["detail", "text", "motion"]).optional(),
    microphoneDeviceId: z.string().max(256).optional(),
    cameraDeviceId: z.string().max(256).optional(),
    speakerDeviceId: z.string().max(256).optional(),
    segmentationQuality: z.enum(["fast", "quality"]).optional(),
    cameras: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          deviceId: z.string(),
          quality: z.enum(["360", "540", "720", "1080", "1440", "2160"]).optional(),
        }),
      )
      .optional(),
    cameraBackground: z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("none") }),
        z.object({ mode: z.literal("blur") }),
        z.object({ mode: z.literal("color"), color: z.string().max(32) }),
        z.object({
          mode: z.literal("image"),
          imageId: z.string().max(128).optional(),
          imageUrl: z.string().max(512).optional(),
          campaign: z.boolean().optional(),
        }),
      ])
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nada para atualizar" });

export const preferencesRoutes = new Elysia({ prefix: "/preferences" })
  .use(authPlugin)
  .get("/", async ({ user, set }) => {
    const auth = userGuard(user);
    if (!auth.ok) {
      set.status = auth.status;
      return { error: auth.error };
    }
    return getUserPreferences(user!.id);
  })
  .put(
    "/",
    async ({ user, set, body }) => {
      const auth = userGuard(user);
      if (!auth.ok) {
        set.status = auth.status;
        return { error: auth.error };
      }
      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
      }
      return saveUserPreferences(user!.id, parsed.data);
    },
    {
      body: t.Object({
        shareQuality: t.Optional(t.String()),
        cameraQuality: t.Optional(t.String()),
        echoCancellation: t.Optional(t.Boolean()),
        noiseSuppression: t.Optional(t.Boolean()),
        noiseCancellation: t.Optional(t.String()),
        krispModel: t.Optional(t.String()),
        krispQuality: t.Optional(t.String()),
        autoGainControl: t.Optional(t.Boolean()),
        visualEffects: t.Optional(t.Boolean()),
        showOthersRolls: t.Optional(t.Boolean()),
        stereo: t.Optional(t.Boolean()),
        contentHint: t.Optional(t.String()),
        microphoneDeviceId: t.Optional(t.String()),
        cameraDeviceId: t.Optional(t.String()),
        speakerDeviceId: t.Optional(t.String()),
        segmentationQuality: t.Optional(t.String()),
        cameras: t.Optional(
          t.Array(
            t.Object({
              id: t.String(),
              name: t.String(),
              deviceId: t.String(),
              quality: t.Optional(t.String()),
            }),
          ),
        ),
        cameraBackground: t.Optional(
          t.Object({
            mode: t.String(),
            color: t.Optional(t.String()),
            imageId: t.Optional(t.String()),
            imageUrl: t.Optional(t.String()),
            campaign: t.Optional(t.Boolean()),
          }),
        ),
      }),
    },
  );
