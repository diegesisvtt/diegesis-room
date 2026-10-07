import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { settings } from "../db/schema";

export type LiveKitConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
  configured: boolean;
};

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

/**
 * Resolve LiveKit configuration. Precedence:
 *  1. Values persisted in the DB (set via the Settings UI).
 *  2. Values from environment variables.
 */
export async function getLiveKitConfig(): Promise<LiveKitConfig> {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const url = map.get("livekit_url") || env("LIVEKIT_URL");
  const apiKey = map.get("livekit_api_key") || env("LIVEKIT_API_KEY");
  const apiSecret = map.get("livekit_api_secret") || env("LIVEKIT_API_SECRET");

  return {
    url,
    apiKey,
    apiSecret,
    configured: Boolean(url && apiKey && apiSecret),
  };
}

export async function setLiveKitConfig(input: {
  url?: string;
  apiKey?: string;
  apiSecret?: string;
}): Promise<LiveKitConfig> {
  const entries: { key: string; value: string }[] = [];
  if (input.url !== undefined) entries.push({ key: "livekit_url", value: input.url.trim() });
  if (input.apiKey !== undefined) entries.push({ key: "livekit_api_key", value: input.apiKey.trim() });
  if (input.apiSecret !== undefined)
    entries.push({ key: "livekit_api_secret", value: input.apiSecret.trim() });

  for (const entry of entries) {
    await db
      .insert(settings)
      .values(entry)
      .onConflictDoUpdate({ target: settings.key, set: { value: entry.value } });
  }
  return getLiveKitConfig();
}

export function publicOrigin(): string {
  return (process.env.PUBLIC_URL ?? "http://localhost:5173").replace(/\/$/, "");
}
