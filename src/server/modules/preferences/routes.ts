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
    autoGainControl: z.boolean().optional(),
    visualEffects: z.boolean().optional(),
    stereo: z.boolean().optional(),
    contentHint: z.enum(["detail", "text", "motion"]).optional(),
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
        autoGainControl: t.Optional(t.Boolean()),
        visualEffects: t.Optional(t.Boolean()),
        stereo: t.Optional(t.Boolean()),
        contentHint: t.Optional(t.String()),
      }),
    },
  );
