import { useEffect, useRef } from "react";
import { Track } from "livekit-client";
import type { LocalAudioTrack } from "livekit-client";
import { usePreferences } from "@/web/lib/preferences";
import {
  connect as connectRoom,
  disconnect as disconnectRoom,
  enableAudio,
  enableCameraWithSettings,
  roomRef,
  sendSignal,
  setParticipantVolume,
  setShareQuality,
  setSpotlight,
  toggleAllHostCameras,
  toggleCamera,
  toggleHostCamera,
  toggleMic,
  toggleShare,
  useVoiceRoom,
  type UseLiveKitRoomOptions,
} from "./voiceStore";

export type {
  CameraQuality,
  HostCamera,
  RemoteCamera,
  RemoteGuest,
  RoomStatus,
  Signal,
  UseLiveKitRoomOptions,
  VoiceSnapshot,
} from "./voiceStore";
export type { ShareQuality } from "./voiceStore";

/**
 * Hook fino sobre o store global de voz. A sala agora vive fora do React
 * (voiceStore), então trocar de canal ou abrir as configurações NÃO desconecta
 * mais — o áudio e a conexão persistem até um "Sair" explícito.
 */
export function useLiveKitRoom({ campaignId, channelId, channelName, participantName, role, audience = false }: UseLiveKitRoomOptions) {
  const voice = useVoiceRoom();
  const preferences = usePreferences();
  const noiseProcessorRef = useRef<LocalAudioTrack | null>(null);

  // Conecta (idempotente) e move de sala quando canal/campanha muda.
  useEffect(() => {
    void connectRoom({ campaignId, channelId, channelName, participantName, role, audience });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, channelId]);

  // Aplica/remove o cancelamento de ruído aprimorado (Krisp) no microfone local,
  // reagindo à preferência e ao estado da sala/microfone.
  useEffect(() => {
    const room = roomRef.current;
    const micTrack = room?.localParticipant.getTrackPublication(Track.Source.Microphone)
      ?.track as LocalAudioTrack | undefined;
    const wantKrisp = preferences.noiseCancellation === "krisp" && voice.micOn && Boolean(micTrack);

    if (!wantKrisp || !micTrack) {
      const prev = noiseProcessorRef.current;
      if (prev) {
        noiseProcessorRef.current = null;
        void prev.stopProcessor().catch(() => {});
      }
      return;
    }

    const track = micTrack;
    let cancelled = false;
    void (async () => {
      try {
        const { KrispNoiseFilter, isKrispNoiseFilterSupported } = await import("@livekit/krisp-noise-filter");
        if (!isKrispNoiseFilterSupported()) return;
        const krisp = KrispNoiseFilter({
          useBVC: preferences.krispModel === "bvc",
          quality: preferences.krispQuality,
        });
        await track.setProcessor(krisp);
        await krisp.setEnabled(true);
        if (!cancelled) noiseProcessorRef.current = track;
      } catch (error) {
        console.error("Falha ao ativar cancelamento de ruído (Krisp)", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preferences.noiseCancellation, preferences.krispModel, preferences.krispQuality, voice.status, voice.micOn]);

  const options = { campaignId, channelId, channelName, participantName, role, audience };

  return {
    roomRef,
    ...voice,
    shareQuality: preferences.shareQuality,
    connect: () => void connectRoom(options),
    disconnect: disconnectRoom,
    toggleMic,
    toggleCamera,
    toggleAllHostCameras,
    toggleHostCamera,
    toggleShare,
    setShareQuality,
    setParticipantVolume,
    sendSignal,
    setSpotlight,
    enableAudio,
    enableCameraWithSettings,
  };
}
