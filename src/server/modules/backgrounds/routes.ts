import { Elysia, t } from "elysia";
import { hostGuard, memberGuard, userGuard } from "../../lib/guards";
import { authPlugin } from "../auth/plugin";
import {
  BackgroundError,
  deleteCampaignBackground,
  deleteUserBackground,
  getCampaignBackgroundFile,
  getUserBackgroundFile,
  listCampaignBackgrounds,
  listUserBackgrounds,
  uploadCampaignBackground,
  uploadUserBackground,
} from "./service";

// Data URL base64 de até ~4MB decodificados (com folga para o encoding).
const imageField = t.String({ maxLength: 6 * 1024 * 1024 });

export const backgroundsRoutes = new Elysia().use(authPlugin)
  // ---- Fundos do usuário (globais) ----
  .get("/backgrounds", async ({ user, set }) => {
    const auth = userGuard(user);
    if (!auth.ok) {
      set.status = auth.status;
      return { error: auth.error };
    }
    return listUserBackgrounds(user!.id);
  })
  .post(
    "/backgrounds",
    async ({ user, set, body }) => {
      const auth = userGuard(user);
      if (!auth.ok) {
        set.status = auth.status;
        return { error: auth.error };
      }
      try {
        return await uploadUserBackground(user!.id, body.name, body.image);
      } catch (err) {
        set.status = err instanceof BackgroundError ? err.status : 400;
        return { error: err instanceof Error ? err.message : "Fundo inválido" };
      }
    },
    { body: t.Object({ name: t.String({ minLength: 1, maxLength: 80 }), image: imageField }) },
  )
  .delete("/backgrounds/:id", async ({ user, params, set }) => {
    const auth = userGuard(user);
    if (!auth.ok) {
      set.status = auth.status;
      return { error: auth.error };
    }
    await deleteUserBackground(user!.id, params.id);
    return { ok: true };
  })
  .get("/backgrounds/:id/file", async ({ params, set }) => {
    const file = await getUserBackgroundFile(params.id);
    if (!file) {
      set.status = 404;
      return { error: "Fundo não encontrado" };
    }
    set.headers["content-type"] = file.mime;
    set.headers["cache-control"] = "public, max-age=31536000, immutable";
    return Bun.file(file.path);
  })
  // ---- Fundos da campanha (oferecidos aos membros) ----
  .get("/campaigns/:campaignId/backgrounds", async ({ params, query, user, set }) => {
    const check = await memberGuard(params.campaignId, user, query.profileToken);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    return listCampaignBackgrounds(params.campaignId);
  })
  .post(
    "/campaigns/:campaignId/backgrounds",
    async ({ params, user, set, body }) => {
      const check = await hostGuard(params.campaignId, user);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      try {
        return await uploadCampaignBackground(params.campaignId, user!.id, body.name, body.image);
      } catch (err) {
        set.status = err instanceof BackgroundError ? err.status : 400;
        return { error: err instanceof Error ? err.message : "Fundo inválido" };
      }
    },
    { body: t.Object({ name: t.String({ minLength: 1, maxLength: 80 }), image: imageField }) },
  )
  .delete("/campaigns/:campaignId/backgrounds/:id", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    await deleteCampaignBackground(params.campaignId, params.id);
    return { ok: true };
  })
  .get("/campaigns/:campaignId/backgrounds/:id/file", async ({ params, set }) => {
    const file = await getCampaignBackgroundFile(params.id);
    if (!file) {
      set.status = 404;
      return { error: "Fundo não encontrado" };
    }
    set.headers["content-type"] = file.mime;
    set.headers["cache-control"] = "public, max-age=31536000, immutable";
    return Bun.file(file.path);
  });
