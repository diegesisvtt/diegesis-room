import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---- Campaigns (a "server" / "table" in Discord terms) ----
export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
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
    name: text("name").notNull(),
    characterName: text("character_name"),
    photoPath: text("photo_path"),
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
