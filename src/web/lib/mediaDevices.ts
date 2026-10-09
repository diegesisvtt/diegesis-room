import { useCallback, useEffect, useState } from "react";
import type { UserPreferences } from "./preferences";

/** Mapeia o tipo de dispositivo para o campo correspondente nas preferências globais. */
export const devicePreferenceKey: Record<MediaDeviceKind, keyof UserPreferences> = {
  audioinput: "microphoneDeviceId",
  videoinput: "cameraDeviceId",
  audiooutput: "speakerDeviceId",
};

export const deviceKindLabels: Record<MediaDeviceKind, string> = {
  audioinput: "Microfone",
  videoinput: "Câmera",
  audiooutput: "Saída de áudio",
};

/**
 * Enumera os dispositivos de mídia e reage a mudanças (conectar/desconectar
 * microfone, câmera etc.) via evento `devicechange`.
 */
export function useMediaDevices(): { devices: MediaDeviceInfo[]; refresh: () => void } {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.enumerateDevices().then(setDevices);
  }, []);

  useEffect(() => {
    refresh();
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  return { devices, refresh };
}

/** Dispositivos reais (ignora a entrada "default") de um tipo. */
export function devicesOfKind(devices: MediaDeviceInfo[], kind: MediaDeviceKind): MediaDeviceInfo[] {
  return devices.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "default");
}

/** Rótulo legível de um dispositivo, com fallback numerado quando sem label. */
export function deviceLabel(
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  deviceId: string,
  fallback: string,
): string | undefined {
  if (!deviceId || deviceId === "default") return undefined;
  const list = devicesOfKind(devices, kind);
  const index = list.findIndex((d) => d.deviceId === deviceId);
  if (index < 0) return undefined;
  return list[index]!.label || `${fallback} ${index + 1}`;
}

/**
 * Reproduz um tom curto no dispositivo de saída escolhido (ou no padrão do
 * sistema). Lança em caso de falha; o chamador monta a mensagem de resultado.
 */
export async function testSoundOnDevice(deviceId: string): Promise<void> {
  const audio = new AudioContext();
  await audio.resume();
  if (deviceId && deviceId !== "default" && "setSinkId" in audio) {
    await (audio as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId);
  }
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  gain.gain.value = 0.15;
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.3);
  await new Promise((resolve) => setTimeout(resolve, 400));
  await audio.close();
}
