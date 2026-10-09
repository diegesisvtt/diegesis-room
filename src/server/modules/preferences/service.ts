import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { userPreferences } from "../../db/schema";

export type ShareQuality = "720" | "1080" | "1440" | "2160";
export type CameraQuality = "360" | "540" | "720" | "1080" | "1440" | "2160";
export type ContentHint = "detail" | "text" | "motion";
export type NoiseCancellationMode = "none" | "voice-isolation" | "krisp";
export type KrispModel = "nc" | "bvc";
export type KrispQuality = "low" | "medium" | "high";
export type SegmentationQuality = "fast" | "quality";

export type AdditionalCamera = {
  id: string;
  name: string;
  deviceId: string;
  quality?: CameraQuality;
};

/** Fundo virtual da câmera pessoal (guest). */
export type CameraBackground =
  | { mode: "none" }
  | { mode: "blur" }
  | { mode: "color"; color: string }
  | { mode: "image"; imageId?: string; imageUrl?: string; campaign?: boolean };

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
  cameras: AdditionalCamera[];
  cameraBackground: CameraBackground;
  segmentationQuality: SegmentationQuality;
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
  cameras: [],
  cameraBackground: { mode: "none" },
  segmentationQuality: "quality",
};

type Row = typeof userPreferences.$inferSelect;

function parseCameras(raw: string): AdditionalCamera[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (c): c is AdditionalCamera =>
        typeof c === "object" && c !== null && typeof (c as AdditionalCamera).id === "string" && typeof (c as AdditionalCamera).name === "string" && typeof (c as AdditionalCamera).deviceId === "string",
    );
  } catch {
    return [];
  }
}

function parseCameraBackground(raw: string): CameraBackground {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== "object" || value === null) return { mode: "none" };
    const mode = (value as { mode?: unknown }).mode;
    if (mode === "blur") return { mode: "blur" };
    if (mode === "color" && typeof (value as { color?: unknown }).color === "string") {
      return { mode: "color", color: (value as { color: string }).color };
    }
    if (mode === "image") {
      const v = value as { imageId?: unknown; imageUrl?: unknown; campaign?: unknown };
      return {
        mode: "image",
        ...(typeof v.imageId === "string" ? { imageId: v.imageId } : {}),
        ...(typeof v.imageUrl === "string" ? { imageUrl: v.imageUrl } : {}),
        ...(typeof v.campaign === "boolean" ? { campaign: v.campaign } : {}),
      };
    }
    return { mode: "none" };
  } catch {
    return { mode: "none" };
  }
}

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
    cameras: parseCameras(row.cameras),
    cameraBackground: parseCameraBackground(row.cameraBackground),
    segmentationQuality: row.segmentationQuality,
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
  const { cameras, cameraBackground, ...rest } = patch;
  const values = {
    userId,
    ...rest,
    ...(cameras !== undefined ? { cameras: JSON.stringify(cameras) } : {}),
    ...(cameraBackground !== undefined ? { cameraBackground: JSON.stringify(cameraBackground) } : {}),
  };
  await db
    .insert(userPreferences)
    .values(values)
    .onConflictDoUpdate({ target: userPreferences.userId, set: { ...values, updatedAt: new Date() } });
  return getUserPreferences(userId);
}
