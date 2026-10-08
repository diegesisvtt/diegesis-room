import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { userPreferences } from "../../db/schema";

export type ShareQuality = "720" | "1080" | "1440" | "2160";
export type CameraQuality = "360" | "540" | "720" | "1080" | "1440" | "2160";
export type ContentHint = "detail" | "text" | "motion";

export type UserPreferences = {
  shareQuality: ShareQuality;
  cameraQuality: CameraQuality;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  visualEffects: boolean;
  stereo: boolean;
  contentHint: ContentHint;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  shareQuality: "1080",
  cameraQuality: "720",
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  visualEffects: true,
  stereo: false,
  contentHint: "detail",
};

type Row = typeof userPreferences.$inferSelect;

function rowToPreferences(row: Row): UserPreferences {
  return {
    shareQuality: row.shareQuality,
    cameraQuality: row.cameraQuality,
    echoCancellation: row.echoCancellation,
    noiseSuppression: row.noiseSuppression,
    autoGainControl: row.autoGainControl,
    visualEffects: row.visualEffects,
    stereo: row.stereo,
    contentHint: row.contentHint,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const row = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  return row ? rowToPreferences(row) : DEFAULT_PREFERENCES;
}

export async function saveUserPreferences(
  userId: string,
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  await db
    .insert(userPreferences)
    .values({ userId, ...patch })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { ...patch, updatedAt: new Date() } });
  return getUserPreferences(userId);
}
