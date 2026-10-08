import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---- Users (registered accounts: email + password) ----
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    mustChangePassword: integer("must_change_password").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

// ---- Auth sessions (opaque token in httpOnly cookie) ----
export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(), // the session token itself
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdx: index("auth_sessions_user_idx").on(table.userId),
  }),
);

// ---- Campaigns (a "server" / "table" in Discord terms) ----
export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---- Channels (unified: persistent chat + voice/video stage) ----
export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    campaignIdx: index("channels_campaign_idx").on(table.campaignId),
  }),
);

// ---- Invites (guest join links) ----
export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    role: text("role", { enum: ["host", "guest"] }).notNull().default("guest"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tokenIdx: uniqueIndex("invites_token_idx").on(table.token),
  }),
);

// ---- Messages (persistent channel chat + dice rolls) ----
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    kind: text("kind", { enum: ["text", "roll", "system"] }).notNull().default("text"),
    body: text("body").notNull().default(""),
    rollJson: text("roll_json"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    channelIdx: index("messages_channel_idx").on(table.channelId),
  }),
);

// ---- Profiles (participant identity per campaign: name, photo, character) ----
export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    characterName: text("character_name"),
    photoPath: text("photo_path"),
    role: text("role", { enum: ["host", "guest"] }).notNull().default("guest"),
    status: text("status", { enum: ["pending", "active", "banned"] })
      .notNull()
      .default("pending"),
    inviteToken: text("invite_token"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    approvedBy: text("approved_by"),
    bannedAt: integer("banned_at", { mode: "timestamp" }),
    bannedBy: text("banned_by"),
    banReason: text("ban_reason"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tokenIdx: uniqueIndex("profiles_token_idx").on(table.token),
    campaignIdx: index("profiles_campaign_idx").on(table.campaignId),
    userIdx: index("profiles_user_idx").on(table.userId),
    // Um perfil por usuário por campanha (SQLite permite múltiplos NULLs).
    campaignUserIdx: uniqueIndex("profiles_campaign_user_idx").on(table.campaignId, table.userId),
  }),
);

// ---- Key/value campaign settings (per-campaign preferences) ----
export const campaignSettings = sqliteTable(
  "campaign_settings",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: uniqueIndex("campaign_settings_pk").on(table.campaignId, table.key),
  }),
);

// ---- Key/value settings (LiveKit config, etc.) ----
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
