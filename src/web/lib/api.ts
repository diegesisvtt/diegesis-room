export type Campaign = {
  id: string;
  name: string;
  createdAt: string;
};

export type Channel = {
  id: string;
  campaignId: string;
  name: string;
  position: number;
  createdAt: string;
};

export type Invite = {
  id: string;
  campaignId: string;
  token: string;
  role: "host" | "guest";
  expiresAt: string | null;
  createdAt: string;
  url?: string;
};

export type ResolvedInvite = {
  token: string;
  role: "host" | "guest";
  campaign: Campaign;
  channels: Channel[];
};

export type Message = {
  id: string;
  channelId: string;
  authorName: string;
  kind: "text" | "roll" | "system";
  body: string;
  rollJson: string | null;
  createdAt: string;
};

export type Profile = {
  id: string;
  campaignId: string;
  name: string;
  characterName: string | null;
  photoUrl: string | null;
  updatedAt: string;
};

export type LiveKitSettings = {
  configured: boolean;
  url: string;
  apiKey: string;
  hasSecret: boolean;
};

export type TokenResponse = { mode: "live"; token: string; url: string; identity: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Campaigns
  listCampaigns: () => request<Campaign[]>("/api/campaigns"),
  getCampaign: (id: string) => request<Campaign>(`/api/campaigns/${id}`),
  createCampaign: (name: string) =>
    request<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify({ name }) }),

  // Channels
  listChannels: (campaignId: string) =>
    request<Channel[]>(`/api/campaigns/${campaignId}/channels`),
  createChannel: (campaignId: string, name: string) =>
    request<Channel>(`/api/campaigns/${campaignId}/channels`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteChannel: (id: string) =>
    request<{ ok: boolean }>(`/api/channels/${id}`, { method: "DELETE" }),

  // Invites
  createInvite: (campaignId: string, role: "host" | "guest") =>
    request<Invite>("/api/invites", {
      method: "POST",
      body: JSON.stringify({ campaignId, role }),
    }),
  resolveInvite: (token: string) => request<ResolvedInvite>(`/api/invites/${token}`),

  // Profiles
  getProfile: (campaignId: string, token: string) =>
    request<Profile>(`/api/campaigns/${campaignId}/profiles/me?token=${encodeURIComponent(token)}`),
  saveProfile: (
    campaignId: string,
    input: { token: string; name: string; characterName?: string | null; photo?: string | null },
  ) =>
    request<Profile>(`/api/campaigns/${campaignId}/profiles/me`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  // Rooms / LiveKit
  getToken: (body: {
    channelId: string;
    participantName: string;
    role?: "host" | "guest";
    audience?: boolean;
  }) => request<TokenResponse>("/api/rooms/token", { method: "POST", body: JSON.stringify(body) }),
  muteParticipant: (channelId: string, identity: string, muted: boolean) =>
    request<{ ok: boolean }>(`/api/rooms/${channelId}/participants/mute`, {
      method: "POST",
      body: JSON.stringify({ identity, muted }),
    }),
  removeParticipant: (channelId: string, identity: string) =>
    request<{ ok: boolean }>(`/api/rooms/${channelId}/participants/remove`, {
      method: "POST",
      body: JSON.stringify({ identity }),
    }),

  // Chat (REST fallback + history)
  listMessages: (channelId: string, limit = 50) =>
    request<Message[]>(`/api/channels/${channelId}/messages?limit=${limit}`),
  sendMessage: (
    channelId: string,
    input: { authorName: string; body: string; kind?: "text" | "roll" | "system"; rollJson?: string },
  ) =>
    request<Message>(`/api/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Settings
  getLiveKitSettings: () => request<LiveKitSettings>("/api/settings/livekit"),
  saveLiveKitSettings: (input: { url?: string; apiKey?: string; apiSecret?: string }) =>
    request<LiveKitSettings>("/api/settings/livekit", { method: "PUT", body: JSON.stringify(input) }),
};

export function wsUrl(channelId: string, since?: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return `${proto}//${host}/ws/channels/${channelId}${query}`;
}
