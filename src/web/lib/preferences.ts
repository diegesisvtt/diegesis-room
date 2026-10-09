import { useSyncExternalStore } from "react";
import { VideoPresets } from "livekit-client";
import { api } from "./api";

export type ShareQuality = "720" | "1080" | "1440" | "2160";
export type CameraQuality = "360" | "540" | "720" | "1080" | "1440" | "2160";
export type ContentHint = "detail" | "text" | "motion";
export type NoiseCancellationMode = "none" | "voice-isolation" | "krisp";
export type KrispModel = "nc" | "bvc";
export type KrispQuality = "low" | "medium" | "high";
/** Modelo de segmentação do fundo virtual: rápido (leve) ou qualidade (nítido). */
export type SegmentationQuality = "fast" | "quality";

/** Câmera adicional do host (configuração persistente; "enabled" é estado de sessão). */
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

export const shareQualityPresets: Record<
  ShareQuality,
  { resolution: (typeof VideoPresets)[keyof typeof VideoPresets]["resolution"]; maxBitrate: number; maxFramerate: number; label: string }
> = {
  "720": { resolution: VideoPresets.h720.resolution, maxBitrate: 2_000_000, maxFramerate: 30, label: "720p (HD) · 2 Mbps" },
  "1080": { resolution: VideoPresets.h1080.resolution, maxBitrate: 4_000_000, maxFramerate: 30, label: "1080p (Full HD) · 4 Mbps" },
  "1440": { resolution: VideoPresets.h1440.resolution, maxBitrate: 6_000_000, maxFramerate: 30, label: "1440p · 6 Mbps" },
  "2160": { resolution: VideoPresets.h2160.resolution, maxBitrate: 8_000_000, maxFramerate: 30, label: "2160p (4K) · 8 Mbps" },
};

export const cameraQualityResolutions: Record<CameraQuality, { width: number; height: number; label: string }> = {
  "360": { width: 640, height: 360, label: "360p" },
  "540": { width: 960, height: 540, label: "540p" },
  "720": { width: 1280, height: 720, label: "720p (HD)" },
  "1080": { width: 1920, height: 1080, label: "1080p (Full HD)" },
  "1440": { width: 2560, height: 1440, label: "1440p" },
  "2160": { width: 3840, height: 2160, label: "2160p (4K)" },
};

export type UserPreferences = {
  /** Qualidade do compartilhamento de tela (aplicada no próximo share). */
  shareQuality: ShareQuality;
  /** Qualidade da câmera pessoal (guest). */
  cameraQuality: CameraQuality;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  /** Cancelamento de ruído aprimorado: Krisp (IA) ou isolamento de voz experimental. */
  noiseCancellation: NoiseCancellationMode;
  /** Modelo do Krisp: NC (ruído de fundo) ou BVC (vozes de fundo). */
  krispModel: KrispModel;
  /** Qualidade/uso de CPU do Krisp. */
  krispQuality: KrispQuality;
  autoGainControl: boolean;
  /** Áudio estéreo (aplicado na próxima ativação do microfone). */
  stereo: boolean;
  /** Dica de conteúdo do compartilhamento de tela. */
  contentHint: ContentHint;
  /** Microfone preferido (deviceId, "default" = padrão do sistema). */
  microphoneDeviceId: string;
  /** Câmera pessoal preferida (deviceId, "default" = padrão do sistema). */
  cameraDeviceId: string;
  /** Saída de áudio preferida (deviceId, "default" = padrão do sistema). */
  speakerDeviceId: string;
  /** Câmeras adicionais do host (globais, sincronizadas com a conta). */
  cameras: AdditionalCamera[];
  /** Fundo virtual da câmera pessoal (blur, cor sólida ou imagem). */
  cameraBackground: CameraBackground;
  /** Qualidade da segmentação do fundo virtual (rápido ou qualidade). */
  segmentationQuality: SegmentationQuality;
  /** Partículas e efeitos visuais de fundo. */
  visualEffects: boolean;
  /** Anima os dados 3D quando outros participantes rolarem. */
  showOthersRolls: boolean;
};

const defaults: UserPreferences = {
  shareQuality: "1080",
  cameraQuality: "720",
  echoCancellation: true,
  noiseSuppression: true,
  noiseCancellation: "krisp",
  krispModel: "nc",
  krispQuality: "medium",
  autoGainControl: true,
  stereo: false,
  contentHint: "detail",
  microphoneDeviceId: "default",
  cameraDeviceId: "default",
  speakerDeviceId: "default",
  cameras: [],
  cameraBackground: { mode: "none" },
  segmentationQuality: "quality",
  visualEffects: true,
  showOthersRolls: true,
};

const KEY = "diegesis:preferences";
const LEGACY_SHARE_QUALITY_KEY = "diegesis:share-quality";

function load(): UserPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<UserPreferences>) };
    // Migração da chave antiga de qualidade de compartilhamento.
    const legacy = localStorage.getItem(LEGACY_SHARE_QUALITY_KEY);
    if (legacy && legacy in shareQualityPresets) {
      return { ...defaults, shareQuality: legacy as ShareQuality };
    }
    return defaults;
  } catch {
    return defaults;
  }
}

function isDefault(prefs: UserPreferences): boolean {
  return (Object.keys(defaults) as (keyof UserPreferences)[]).every((key) => {
    const a = prefs[key];
    const b = defaults[key];
    if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
    return a === b;
  });
}

let current: UserPreferences = load();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist(prefs: UserPreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    localStorage.removeItem(LEGACY_SHARE_QUALITY_KEY);
  } catch {
    /* ignore */
  }
}

export function getPreferences(): UserPreferences {
  return current;
}

/**
 * Atualização otimista e síncrona (cache + localStorage) seguida de um PUT
 * debounced ao backend — apenas para usuários logados. Convidados (sem conta)
 * continuam persistindo só no dispositivo.
 */
export function setPreferences(patch: Partial<UserPreferences>) {
  current = { ...current, ...patch };
  persist(current);
  emit();
  scheduleServerSync(patch);
}

// ---- Sincronização com o backend (fonte da verdade para logados) ----

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPatch: Partial<UserPreferences> = {};

function scheduleServerSync(patch: Partial<UserPreferences>) {
  pendingPatch = { ...pendingPatch, ...patch };
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const patch = pendingPatch;
    pendingPatch = {};
    void syncToServer(patch);
  }, 300);
}

async function syncToServer(patch: Partial<UserPreferences>) {
  try {
    const { user } = await api.me();
    if (!user) return;
    await api.savePreferences(patch);
  } catch {
    // Rede/servidor indisponível: o cache local segue como fonte até a próxima sync.
  }
}

function applyServerPrefs(prefs: UserPreferences) {
  current = { ...defaults, ...prefs };
  persist(current);
  emit();
}

/**
 * Hidrata as preferências no boot: usuários logados passam a usar o backend
 * como fonte da verdade (com migração única do localStorage). Convidados e
 * falhas de rede mantêm o cache local.
 */
export async function hydratePreferences(): Promise<void> {
  try {
    const { user } = await api.me();
    if (!user) return;
    const server = await api.getPreferences();
    const local = getPreferences();
    if (!isDefault(server)) {
      // Servidor já tem valores: vence sobre o cache local (cross-device).
      applyServerPrefs(server);
    } else if (!isDefault(local)) {
      // Sem linha no servidor ainda: sobe o que o usuário já tinha localmente.
      try {
        await api.savePreferences(local);
      } catch {
        /* melhor esforço */
      }
    }
  } catch {
    /* melhor esforço: mantém o cache local */
  }
}

function subscribe(listener: () => void) {
  const onStorage = () => {
    current = load();
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePreferences(): UserPreferences {
  return useSyncExternalStore(subscribe, getPreferences);
}
