import { Elysia, t } from "elysia";
import { getLiveKitConfig, setLiveKitConfig } from "../../lib/settings";

export const settingsRoutes = new Elysia({ prefix: "/settings/livekit" })
  .get("/", async () => {
    const config = await getLiveKitConfig();
    // Never leak the secret back to the client; only indicate whether it is set.
    return {
      configured: config.configured,
      url: config.url,
      apiKey: config.apiKey ? "••••••••" : "",
      hasSecret: Boolean(config.apiSecret),
    };
  })
  .put(
    "/",
    async ({ body, set }) => {
      try {
        const input: { url?: string; apiKey?: string; apiSecret?: string } = {};
        if (body.url !== undefined) input.url = body.url;
        if (body.apiKey !== undefined) input.apiKey = body.apiKey;
        if (body.apiSecret !== undefined && body.apiSecret.trim() !== "") input.apiSecret = body.apiSecret;

        const config = await setLiveKitConfig(input);
        return {
          configured: config.configured,
          url: config.url,
          apiKey: config.apiKey ? "••••••••" : "",
          hasSecret: Boolean(config.apiSecret),
        };
      } catch (err) {
        set.status = 500;
        return { error: err instanceof Error ? err.message : "Unable to save settings" };
      }
    },
    {
      body: t.Object({
        url: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        apiSecret: t.Optional(t.String()),
      }),
    },
  );
