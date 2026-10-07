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
  role?: "host" | "guest";
  audience?: boolean;
};

export async function requestToken(input: TokenRequest) {
  const channel = await getChannelOrThrow(input.channelId);

  // TV mode / audience: subscribe-only.
  if (input.audience) {
    return issueToken({
      roomName: channel.id,
      participantName: input.participantName,
      canPublish: false,
      canSubscribe: true,
    });
  }

  return issueToken({
    roomName: channel.id,
    participantName: input.participantName,
    canPublish: true,
    canSubscribe: true,
  });
}
