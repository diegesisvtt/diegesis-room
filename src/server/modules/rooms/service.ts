import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { channels } from "../../db/schema";
import { issueToken } from "../../lib/livekit";

export async function getChannelOrThrow(channelId: string) {
  const channel = await db.select().from(channels).where(eq(channels.id, channelId)).get();
  if (!channel) throw new Error("Channel not found");
  return channel;
}

export type TokenRequest = {
  channelId: string;
  participantName: string;
  audience?: boolean;
  photoUrl?: string | null;
  name?: string | null;
  characterName?: string | null;
};

export async function requestToken(input: TokenRequest) {
  const channel = await getChannelOrThrow(input.channelId);

  // Streaming mode / audience: subscribe-only.
  if (input.audience) {
    return issueToken({
      roomName: channel.id,
      participantName: input.participantName,
      canPublish: false,
      canSubscribe: true,
      metadata: JSON.stringify({ audience: true }),
    });
  }

  const metadata: { photo?: string | null; name?: string | null; characterName?: string | null } = {};
  if (input.photoUrl) metadata.photo = input.photoUrl;
  if (input.name) metadata.name = input.name;
  if (input.characterName) metadata.characterName = input.characterName;

  return issueToken({
    roomName: channel.id,
    participantName: input.participantName,
    canPublish: true,
    canSubscribe: true,
    ...(Object.keys(metadata).length > 0 ? { metadata: JSON.stringify(metadata) } : {}),
  });
}
