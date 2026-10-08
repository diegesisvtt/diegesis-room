import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { campaigns } from "../../db/schema";
import { hostGuard, memberGuard } from "../../lib/guards";
import { authPlugin } from "../auth/plugin";
import { dropSocketsForProfile } from "../chat/routes";
import {
  approveMember,
  banMember,
  isOwnerProfile,
  kickMember,
  listMembers,
  rejectMember,
  unbanMember,
} from "./service";

export const membersRoutes = new Elysia({ prefix: "/campaigns/:campaignId/members" }).use(authPlugin)
  // Lista de participantes: qualquer membro ativo vê; pendentes/banidos aparecem
  // com status para o host moderar.
  .get("/", async ({ params, query, user, set }) => {
    const check = await memberGuard(params.campaignId, user, query.profileToken);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    const members = await listMembers(params.campaignId);
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, params.campaignId))
      .get();
    const isHost =
      check.membership!.role === "host" || (user != null && campaign?.ownerId === user.id);
    if (isHost) return members;
    // Convidados veem apenas membros ativos.
    return members.filter((m) => m.status === "active");
  })
  .post("/:profileId/approve", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    try {
      await approveMember(params.campaignId, params.profileId, user!.id);
      return { ok: true };
    } catch (err) {
      set.status = 400;
      return { error: err instanceof Error ? err.message : "Não foi possível aprovar" };
    }
  })
  .post("/:profileId/reject", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    try {
      const token = await rejectMember(params.campaignId, params.profileId);
      dropSocketsForProfile(token);
      return { ok: true };
    } catch (err) {
      set.status = 400;
      return { error: err instanceof Error ? err.message : "Não foi possível rejeitar" };
    }
  })
  .post("/:profileId/kick", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    if (await isOwnerProfile(params.campaignId, params.profileId)) {
      set.status = 400;
      return { error: "O dono da campanha não pode ser expulso" };
    }
    try {
      const token = await kickMember(params.campaignId, params.profileId);
      dropSocketsForProfile(token);
      return { ok: true };
    } catch (err) {
      set.status = 400;
      return { error: err instanceof Error ? err.message : "Não foi possível expulsar" };
    }
  })
  .post(
    "/:profileId/ban",
    async ({ params, body, user, set }) => {
      const check = await hostGuard(params.campaignId, user);
      if (!check.ok) {
        set.status = check.status;
        return { error: check.error };
      }
      if (await isOwnerProfile(params.campaignId, params.profileId)) {
        set.status = 400;
        return { error: "O dono da campanha não pode ser banido" };
      }
      try {
        const token = await banMember(params.campaignId, params.profileId, user!.id, body.reason);
        dropSocketsForProfile(token);
        return { ok: true };
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : "Não foi possível banir" };
      }
    },
    { body: t.Object({ reason: t.Optional(t.String({ maxLength: 200 })) }) },
  )
  .post("/:profileId/unban", async ({ params, user, set }) => {
    const check = await hostGuard(params.campaignId, user);
    if (!check.ok) {
      set.status = check.status;
      return { error: check.error };
    }
    try {
      await unbanMember(params.campaignId, params.profileId);
      return { ok: true };
    } catch (err) {
      set.status = 400;
      return { error: err instanceof Error ? err.message : "Não foi possível desbanir" };
    }
  });
