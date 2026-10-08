import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { getLiveKitConfig } from "./settings";
import { uuidv7 } from "uuidv7";

export type TokenGrant = {
  roomName: string;
  participantName: string;
  canPublish: boolean;
  canSubscribe?: boolean;
  metadata?: string;
};

export type TokenResult = { mode: "live"; token: string; url: string; identity: string };

function toWsUrl(url: string): string {
  return url.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

function sanitizeIdentity(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  return `${base || "guest"}-${uuidv7().slice(0, 8)}`;
}

export async function issueToken(grant: TokenGrant): Promise<TokenResult> {
  const config = await getLiveKitConfig();
  if (!config.configured) throw new Error("LiveKit is not configured");

  const identity = sanitizeIdentity(grant.participantName);
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name: grant.participantName,
    ttl: "4h",
    ...(grant.metadata ? { metadata: grant.metadata } : {}),
  });

  token.addGrant({
    room: grant.roomName,
    roomJoin: true,
    canPublish: grant.canPublish,
    canSubscribe: grant.canSubscribe ?? true,
  });

  return {
    mode: "live",
    token: await token.toJwt(),
    url: toWsUrl(config.url),
    identity,
  };
}

export async function getRoomService(): Promise<RoomServiceClient | null> {
  const config = await getLiveKitConfig();
  if (!config.configured) return null;
  return new RoomServiceClient(config.url, config.apiKey, config.apiSecret);
}

export async function removeParticipant(roomName: string, identity: string): Promise<void> {
  const svc = await getRoomService();
  await svc?.removeParticipant(roomName, identity);
}

export async function muteParticipant(roomName: string, identity: string, muted: boolean): Promise<void> {
  const svc = await getRoomService();
  await svc?.updateParticipant(roomName, identity, { permission: { canPublish: !muted } });
}
