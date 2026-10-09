import { Elysia, t } from "elysia";
import { getPhotoFile, getProfile, ProfileError, upsertProfile } from "./service";
import { authPlugin } from "../auth/plugin";

export const profilesRoutes = new Elysia().use(authPlugin)
  .get("/campaigns/:campaignId/profiles/me", async ({ params, query, user }) => {
    // "Sem perfil ainda" não é erro: devolve 200 com profile nulo para o
    // cliente distinguir de "perfil excluído/rejeitado" sem poluir o console.
    const profile = await getProfile(params.campaignId, query.token, user);
    return { profile };
  })
  .put(
    "/campaigns/:campaignId/profiles/me",
    async ({ params, body, user, set }) => {
      try {
        return await upsertProfile(params.campaignId, body, user);
      } catch (error) {
        set.status = error instanceof ProfileError ? error.status : 400;
        return { error: error instanceof Error ? error.message : "Invalid profile" };
      }
    },
    {
      body: t.Object({
        token: t.String({ minLength: 8, maxLength: 128 }),
        name: t.String({ minLength: 1, maxLength: 60 }),
        characterName: t.Optional(t.Nullable(t.String({ maxLength: 60 }))),
        photo: t.Optional(t.Nullable(t.String({ maxLength: 3 * 1024 * 1024 }))),
        inviteToken: t.Optional(t.Nullable(t.String({ maxLength: 128 }))),
      }),
    },
  )
  .get("/profiles/:id/photo", async ({ params, set }) => {
    const photo = await getPhotoFile(params.id);
    if (!photo) {
      set.status = 404;
      return { error: "Photo not found" };
    }
    set.headers["content-type"] = photo.mime;
    set.headers["cache-control"] = "public, max-age=3600";
    return Bun.file(photo.path);
  });
