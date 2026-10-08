import type { UserPreferences } from "./preferences";

export type Campaign = {
  id: string;
  name: string;
  ownerId: string | null;
  createdAt: string;
};

export type MemberStatus = "pending" | "active" | "banned";
export type MemberRole = "host" | "guest";

export type CampaignEntry = Campaign & {
  isOwner: boolean;
  myRole: MemberRole | null;
  myStatus: MemberStatus | null;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
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
  token: string;
  name: string;
  characterName: string | null;
  photoUrl: string | null;
  role: MemberRole;
  status: MemberStatus;
  isRegistered: boolean;
  updatedAt: string;
};

export type Member = {
  id: string;
  campaignId: string;
  name: string;
  characterName: string | null;
  photoUrl: string | null;
  role: MemberRole;
  status: MemberStatus;
  isRegistered: boolean;
  accountName: string | null;
  isOwner: boolean;
  onlineNow: boolean;
  banReason: string | null;
  createdAt: string;
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
    // Senha temporária pendente de troca: leva direto para a troca de senha.
    if (message === "password_change_required" && window.location.pathname !== "/change-password") {
      window.location.assign("/change-password");
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  me: () => request<{ user: AuthUser | null }>("/api/auth/me"),
  register: (input: { name: string; email: string; password: string; profileTokens?: Record<string, string> }) =>
    request<{ user: AuthUser }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string; profileTokens?: Record<string, string> }) =>
    request<{ user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  resetPassword: (email: string) =>
    request<{ temporaryPassword: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>("/api/auth/change-password", { method: "POST", body: JSON.stringify(input) }),

  // Campaigns
  listCampaigns: () => request<CampaignEntry[]>("/api/campaigns"),
  getCampaign: (id: string) => request<Campaign>(`/api/campaigns/${id}`),
  createCampaign: (name: string) =>
    request<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify({ name }) }),
  updateCampaign: (id: string, name: string) =>
    request<Campaign>(`/api/campaigns/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteCampaign: (id: string) =>
    request<{ ok: boolean }>(`/api/campaigns/${id}`, { method: "DELETE" }),

  // Channels
  listChannels: (campaignId: string, profileToken?: string) =>
    request<Channel[]>(
      `/api/campaigns/${campaignId}/channels${profileToken ? `?profileToken=${encodeURIComponent(profileToken)}` : ""}`,
    ),
  createChannel: (campaignId: string, name: string) =>
    request<Channel>(`/api/campaigns/${campaignId}/channels`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateChannel: (id: string, name: string) =>
    request<Channel>(`/api/channels/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteChannel: (id: string) =>
    request<{ ok: boolean }>(`/api/channels/${id}`, { method: "DELETE" }),

  // Invites
  createInvite: (campaignId: string, role: "host" | "guest") =>
    request<Invite>("/api/invites", {
      method: "POST",
      body: JSON.stringify({ campaignId, role }),
    }),
  listInvites: (campaignId: string) => request<Invite[]>(`/api/invites/campaign/${campaignId}`),
  revokeInvite: (campaignId: string, inviteId: string) =>
    request<{ ok: boolean }>(`/api/invites/${inviteId}/campaign/${campaignId}`, { method: "DELETE" }),
  resolveInvite: (token: string) => request<ResolvedInvite>(`/api/invites/${token}`),

  // Profiles
  getProfile: (campaignId: string, token?: string) =>
    request<Profile>(
      `/api/campaigns/${campaignId}/profiles/me${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    ),
  saveProfile: (
    campaignId: string,
    input: {
      token: string;
      name: string;
      characterName?: string | null;
      photo?: string | null;
      inviteToken?: string | null;
    },
  ) =>
    request<Profile>(`/api/campaigns/${campaignId}/profiles/me`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  // Members (moderação)
  listMembers: (campaignId: string, profileToken?: string) =>
    request<Member[]>(
      `/api/campaigns/${campaignId}/members${profileToken ? `?profileToken=${encodeURIComponent(profileToken)}` : ""}`,
    ),
  approveMember: (campaignId: string, profileId: string) =>
    request<{ ok: boolean }>(`/api/campaigns/${campaignId}/members/${profileId}/approve`, { method: "POST" }),
  rejectMember: (campaignId: string, profileId: string) =>
    request<{ ok: boolean }>(`/api/campaigns/${campaignId}/members/${profileId}/reject`, { method: "POST" }),
  kickMember: (campaignId: string, profileId: string) =>
    request<{ ok: boolean }>(`/api/campaigns/${campaignId}/members/${profileId}/kick`, { method: "POST" }),
  banMember: (campaignId: string, profileId: string, reason?: string) =>
    request<{ ok: boolean }>(`/api/campaigns/${campaignId}/members/${profileId}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  unbanMember: (campaignId: string, profileId: string) =>
    request<{ ok: boolean }>(`/api/campaigns/${campaignId}/members/${profileId}/unban`, { method: "POST" }),

  // Rooms / LiveKit
  getToken: (body: {
    channelId: string;
    participantName: string;
    audience?: boolean;
    profileToken?: string;
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
  listMessages: (channelId: string, limit = 50, profileToken?: string) =>
    request<Message[]>(
      `/api/channels/${channelId}/messages?limit=${limit}${profileToken ? `&profileToken=${encodeURIComponent(profileToken)}` : ""}`,
    ),
  sendMessage: (
    channelId: string,
    input: { authorName: string; body: string; kind?: "text" | "roll" | "system"; rollJson?: string; profileToken?: string },
  ) =>
    request<Message>(`/api/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Settings
  getLiveKitSettings: () => request<LiveKitSettings>("/api/settings/livekit"),
  saveLiveKitSettings: (input: { url?: string; apiKey?: string; apiSecret?: string }) =>
    request<LiveKitSettings>("/api/settings/livekit", { method: "PUT", body: JSON.stringify(input) }),

  // Preferences (per user, synced to the backend)
  getPreferences: () => request<UserPreferences>("/api/preferences"),
  savePreferences: (patch: Partial<UserPreferences>) =>
    request<UserPreferences>("/api/preferences", { method: "PUT", body: JSON.stringify(patch) }),
};

export function wsUrl(channelId: string, since?: string, profileToken?: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  if (profileToken) params.set("profileToken", profileToken);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return `${proto}//${host}/ws/channels/${channelId}${query}`;
}
