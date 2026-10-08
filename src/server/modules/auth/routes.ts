import { Elysia, t } from "elysia";
import {
  changePassword,
  claimProfiles,
  createSession,
  createUser,
  destroyOtherSessions,
  destroySession,
  resetPassword,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  toPublicUser,
  verifyLogin,
} from "./service";
import { authPlugin } from "./plugin";

// Rate limit simples por email para o reset de senha (1 a cada 5 min).
const RESET_COOLDOWN_MS = 5 * 60 * 1000;
const lastResetByEmail = new Map<string, number>();

async function tryClaimProfiles(userId: string, tokens?: Record<string, string>) {
  if (!tokens) return;
  try {
    await claimProfiles(userId, tokens);
  } catch {
    /* claim é melhor esforço — nunca derruba o register/login */
  }
}

const profileTokens = t.Optional(t.Record(t.String(), t.String()));

function setSessionCookie(
  cookie: Record<string, { set: (opts: object) => void; remove: () => void } | undefined>,
  token: string,
) {
  cookie[SESSION_COOKIE]?.set({
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export const authRoutes = new Elysia({ prefix: "/auth" }).use(authPlugin)
  .post(
    "/register",
    async ({ body, cookie, set }) => {
      try {
        const user = await createUser(body);
        const token = await createSession(user.id);
        await tryClaimProfiles(user.id, body.profileTokens);
        setSessionCookie(cookie, token);
        return { user: toPublicUser(user) };
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : "Não foi possível cadastrar" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 60 }),
        email: t.String({ format: "email", maxLength: 120 }),
        password: t.String({ minLength: 8, maxLength: 128 }),
        profileTokens,
      }),
    },
  )
  .post(
    "/login",
    async ({ body, cookie, set }) => {
      const user = await verifyLogin(body.email, body.password);
      if (!user) {
        set.status = 401;
        return { error: "Email ou senha incorretos" };
      }
      const token = await createSession(user.id);
      await tryClaimProfiles(user.id, body.profileTokens);
      setSessionCookie(cookie, token);
      return { user: toPublicUser(user) };
    },
    {
      body: t.Object({
        email: t.String({ format: "email", maxLength: 120 }),
        password: t.String({ minLength: 1, maxLength: 128 }),
        profileTokens,
      }),
    },
  )
  .post("/logout", async ({ cookie }) => {
    const token = cookie[SESSION_COOKIE]?.value as string | undefined;
    if (token) await destroySession(token);
    cookie[SESSION_COOKIE]?.remove();
    return { ok: true };
  })
  .get("/me", ({ user }) => ({ user: user ? toPublicUser(user) : null }))
  .post(
    "/reset-password",
    async ({ body, set }) => {
      const email = body.email.trim().toLowerCase();
      const lastReset = lastResetByEmail.get(email) ?? 0;
      if (Date.now() - lastReset < RESET_COOLDOWN_MS) {
        set.status = 429;
        return { error: "Aguarde alguns minutos antes de pedir outro reset" };
      }
      try {
        const temporaryPassword = await resetPassword(email);
        if (!temporaryPassword) {
          set.status = 404;
          return { error: "Nenhum usuário com esse email" };
        }
        lastResetByEmail.set(email, Date.now());
        // App auto-hospedado sem envio de email: a senha temporária é exibida
        // na tela para o próprio usuário copiar.
        return { temporaryPassword };
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : "Não foi possível resetar" };
      }
    },
    { body: t.Object({ email: t.String({ format: "email", maxLength: 120 }) }) },
  )
  .post(
    "/change-password",
    async ({ user, body, cookie, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Login necessário" };
      }
      try {
        await changePassword(user.id, body.currentPassword, body.newPassword);
        // Derruba sessões em outros dispositivos; mantém apenas a atual.
        const currentToken = cookie[SESSION_COOKIE]?.value as string | undefined;
        await destroyOtherSessions(user.id, currentToken);
        return { ok: true };
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : "Não foi possível trocar a senha" };
      }
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1, maxLength: 128 }),
        newPassword: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  );
