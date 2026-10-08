import { Elysia } from "elysia";
import { getUserBySessionToken, SESSION_COOKIE } from "./service";

/**
 * Resolve `user` (usuário logado) em todas as rotas a partir do cookie de
 * sessão. Rotas usam os guards de `lib/guards.ts` para exigir login/host.
 */
export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "global" },
  async ({ cookie }) => {
    const token = cookie[SESSION_COOKIE]?.value as string | undefined;
    const user = token ? await getUserBySessionToken(token) : null;
    return { user };
  },
);
