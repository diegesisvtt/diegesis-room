import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { userPreferences } from "../../db/schema";

export type ShareQuality = "720" | "1080" | "1440" | "2160";
export type CameraQuality = "360" | "540" | "720" | "1080" | "1440" | "2160";
export type ContentHint = "detail" | "text" | "motion";
export type NoiseCancellationMode = "none" | "voice-isolation" | "krisp";
export type KrispModel = "nc" | "bvc";
export type KrispQuality = "low" | "medium" | "high";

export type UserPreferences = {
  shareQuality: ShareQuality;
  cameraQuality: CameraQuality;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  noiseCancellation: NoiseCancellationMode;
  krispModel: KrispModel;
  krispQuality: KrispQuality;
  autoGainControl: boolean;
  visualEffects: boolean;
  showOthersRolls: boolean;
  stereo: boolean;
  contentHint: ContentHint;
  microphoneDeviceId: string;
  cameraDeviceId: string;
  speakerDeviceId: string;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  shareQuality: "1080",
  cameraQuality: "720",
  echoCancellation: true,
  noiseSuppression: true,
  noiseCancellation: "krisp",
  krispModel: "nc",
  krispQuality: "medium",
  autoGainControl: true,
  visualEffects: true,
  showOthersRolls: true,
  stereo: false,
  contentHint: "detail",
  microphoneDeviceId: "default",
  cameraDeviceId: "default",
  speakerDeviceId: "default",
};

type Row = typeof userPreferences.$inferSelect;

function rowToPreferences(row: Row): UserPreferences {
  return {
    shareQuality: row.shareQuality,
    cameraQuality: row.cameraQuality,
    echoCancellation: row.echoCancellation,
    noiseSuppression: row.noiseSuppression,
    noiseCancellation: row.noiseCancellation,
    krispModel: row.krispModel,
    krispQuality: row.krispQuality,
    autoGainControl: row.autoGainControl,
    visualEffects: row.visualEffects,
    showOthersRolls: row.showOthersRolls,
    stereo: row.stereo,
    contentHint: row.contentHint,
    microphoneDeviceId: row.microphoneDeviceId,
    cameraDeviceId: row.cameraDeviceId,
    speakerDeviceId: row.speakerDeviceId,
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
