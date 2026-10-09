import { useSyncExternalStore } from "react";
import { createLocalVideoTrack, Room, RoomEvent, Track, VideoPresets } from "livekit-client";
import type { LocalVideoTrack, RemoteAudioTrack, RemoteVideoTrack } from "livekit-client";
import { api, type TokenResponse } from "@/web/lib/api";
import { loadSession, peekProfileToken } from "@/web/lib/session";
import { getPreferences, setPreferences, shareQualityPresets, type ShareQuality } from "@/web/lib/preferences";

export type RoomStatus = "idle" | "connecting" | "live" | "error";

export type RemoteCamera = { id: string; name: string; track: RemoteVideoTrack | null };

export type RemoteGuest = {
  identity: string;
  name: string;
  isHost: boolean;
  photoUrl: string | null;
  cameras: RemoteCamera[];
  cameraTrack: RemoteVideoTrack | null;
  screenTrack: RemoteVideoTrack | null;
  audioTrack: RemoteAudioTrack | null;
};

type ParticipantMeta = { photo: string | null; audience: boolean };

function parseMetadata(metadata: string | undefined): ParticipantMeta {
  if (!metadata) return { photo: null, audience: false };
  try {
    const data = JSON.parse(metadata) as { photo?: unknown; audience?: unknown };
    return { photo: typeof data.photo === "string" ? data.photo : null, audience: data.audience === true };
  } catch {
    return { photo: null, audience: false };
  }
}

function isAudience(participant: { metadata?: string; permissions?: { canPublish?: boolean } }): boolean {
  return participant.permissions?.canPublish === false || parseMetadata(participant.metadata).audience;
}

export type CameraQuality = "360" | "540" | "720" | "1080" | "1440" | "2160";

const qualityPresets: Record<CameraQuality, { preset: (typeof VideoPresets)[keyof typeof VideoPresets]; simulcast: (typeof VideoPresets)[keyof typeof VideoPresets][] }> = {
  "360": { preset: VideoPresets.h360, simulcast: [VideoPresets.h180] },
  "540": { preset: VideoPresets.h540, simulcast: [VideoPresets.h180] },
  "720": { preset: VideoPresets.h720, simulcast: [VideoPresets.h360, VideoPresets.h180] },
  "1080": { preset: VideoPresets.h1080, simulcast: [VideoPresets.h540, VideoPresets.h360, VideoPresets.h180] },
  "1440": { preset: VideoPresets.h1440, simulcast: [VideoPresets.h720, VideoPresets.h360, VideoPresets.h180] },
  "2160": { preset: VideoPresets.h2160, simulcast: [VideoPresets.h1080, VideoPresets.h540, VideoPresets.h180] },
};

export type HostCamera = { id: string; name: string; deviceId: string; enabled: boolean; quality?: CameraQuality };

export type { ShareQuality } from "@/web/lib/preferences";

export type Signal = { hand?: boolean; reaction?: string; expires?: number };

type CamerasMessage = { type: "cameras"; cameras: { id: string; name: string }[]; spotlight: string | null };
type DataMessage = { type: "signal"; hand?: boolean; reaction?: string } | CamerasMessage | { type: "cameras-request" };

const TOPIC = "mesa-data";

function camerasKey(campaignId: string) {
  return `diegesis:cameras:${campaignId}`;
}

function spotlightKey(campaignId: string) {
  return `diegesis:spotlight:${campaignId}`;
}

function loadCameras(key: string): HostCamera[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return (JSON.parse(raw) as HostCamera[]).map((cam) => ({ ...cam, enabled: false }));
  } catch {
    return [];
  }
}

function loadSpotlight(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return raw.startsWith("cam-") ? `cam:${raw}` : raw;
  } catch {
    return null;
  }
}

export type UseLiveKitRoomOptions = {
  campaignId: string;
  channelId: string;
  channelName?: string;
  participantName: string;
  role: "host" | "guest";
  audience?: boolean;
};

// ---- Estado global (singleton de módulo, sobrevive a trocas de rota) ----

export const roomRef: { current: Room | null } = { current: null };

let status: RoomStatus = "idle";
let guests: RemoteGuest[] = [];
let hostCameras: HostCamera[] = [];
let localCameraTracks: Record<string, LocalVideoTrack> = {};
let localScreenTrack: LocalVideoTrack | null = null;
let micOn = true;
let cameraOn = false;
let sharing = false;
let audioBlocked = false;
let signals: Record<string, Signal> = {};
let speakers: string[] = [];
let spotlight: string | null = null;
let cameraErrors: Record<string, string> = {};
let localIdentity = "local";

let activeCampaignId: string | null = null;
let activeChannelId: string | null = null;
let channelName = "";
let role: "host" | "guest" = "guest";
let participantName = "";
let audience = false;

let connecting = false;
let hostCamerasRef: HostCamera[] = [];
let spotlightRef: string | null = null;
let hostIdentityRef: string | null = null;
let rosterRef: { id: string; name: string }[] = [];

export type VoiceSnapshot = {
  status: RoomStatus;
  guests: RemoteGuest[];
  hostCameras: HostCamera[];
  localCameraTracks: Record<string, LocalVideoTrack>;
  localScreenTrack: LocalVideoTrack | null;
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  audioBlocked: boolean;
  signals: Record<string, Signal>;
  speakers: string[];
  spotlight: string | null;
  cameraErrors: Record<string, string>;
  localIdentity: string;
  activeCampaignId: string | null;
  activeChannelId: string | null;
  channelName: string;
  role: "host" | "guest";
  participantName: string;
};

function anyCameraOn(): boolean {
  return role === "host" ? hostCameras.some((c) => c.enabled) : cameraOn;
}

function buildSnapshot(): VoiceSnapshot {
  return {
    status,
    guests,
    hostCameras,
    localCameraTracks,
    localScreenTrack,
    micOn,
    cameraOn: anyCameraOn(),
    sharing,
    audioBlocked,
    signals,
    speakers,
    spotlight,
    cameraErrors,
    localIdentity,
    activeCampaignId,
    activeChannelId,
    channelName,
    role,
    participantName,
  };
}

let snapshot: VoiceSnapshot = buildSnapshot();
const listeners = new Set<() => void>();

function emit() {
  snapshot = buildSnapshot();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): VoiceSnapshot {
  return snapshot;
}

export function useVoiceRoom(): VoiceSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---- Opções de captura (lidas diretamente das preferências globais) ----

/** Restrição de dispositivo: ignora o "default" (deixa o navegador escolher). */
function deviceConstraint(id: string | undefined): { deviceId: { exact: string } } | Record<string, never> {
  return id && id !== "default" ? { deviceId: { exact: id } } : {};
}

function isDeviceMissing(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "OverconstrainedError" || error.name === "NotFoundError");
}

function micOptions() {
  const prefs = getPreferences();
  return {
    echoCancellation: prefs.echoCancellation,
    noiseSuppression: prefs.noiseSuppression,
    autoGainControl: prefs.autoGainControl,
    channelCount: prefs.stereo ? 2 : 1,
    ...(prefs.noiseCancellation === "voice-isolation" ? { voiceIsolation: true } : {}),
    ...deviceConstraint(prefs.microphoneDeviceId),
  };
}

function cameraOptions() {
  const prefs = getPreferences();
  return {
    resolution: qualityPresets[prefs.cameraQuality].preset.resolution,
    ...deviceConstraint(prefs.cameraDeviceId),
  };
}

/** Aplica o dispositivo de saída salvo nas preferências globais. */
async function applySpeakerDevice(room: Room) {
  const speakerDeviceId = getPreferences().speakerDeviceId;
  if (!speakerDeviceId || speakerDeviceId === "default") return;
  try {
    await room.switchActiveDevice("audiooutput", speakerDeviceId);
  } catch {
    // Navegador sem setSinkId ou dispositivo ausente: mantém a saída padrão.
  }
}

/** Liga o microfone; se o dispositivo salvo sumiu, volta ao padrão do sistema. */
async function enableMicWithFallback(room: Room) {
  try {
    await room.localParticipant.setMicrophoneEnabled(micOn, micOptions());
  } catch (error) {
    if (!isDeviceMissing(error)) throw error;
    setPreferences({ microphoneDeviceId: "default" });
    await room.localParticipant.setMicrophoneEnabled(micOn, micOptions());
  }
}

/** Liga a câmera pessoal; se o dispositivo salvo sumiu, volta ao padrão do sistema. */
async function enableCameraWithFallback(room: Room) {
  try {
    await room.localParticipant.setCameraEnabled(true, cameraOptions());
  } catch (error) {
    if (!isDeviceMissing(error)) throw error;
    setPreferences({ cameraDeviceId: "default" });
    await room.localParticipant.setCameraEnabled(true, cameraOptions());
  }
}

// ---- Sincronização de participantes ----

function syncGuests(room: Room) {
  const roster = rosterRef;
  const hostId = hostIdentityRef;
  const list = Array.from(room.remoteParticipants.values())
    .filter((participant) => !isAudience(participant))
    .map((participant) => {
      const cameraPubs = Array.from(participant.trackPublications.values()).filter(
        (pub) => pub.source === Track.Source.Camera,
      );
      const isHost = participant.identity === hostId;
      const cameras: RemoteCamera[] = cameraPubs.map((pub) => ({
        id: pub.trackName,
        name: (isHost && roster.find((c) => c.id === pub.trackName)?.name) || participant.name || participant.identity,
        track: (pub.track as RemoteVideoTrack | undefined) ?? null,
      }));
      const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      return {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isHost,
        photoUrl: parseMetadata(participant.metadata).photo,
        cameras,
        cameraTrack: cameras[0]?.track ?? null,
        screenTrack: (screenPub?.track as RemoteVideoTrack | undefined) ?? null,
        audioTrack: (micPub?.track as RemoteAudioTrack | undefined) ?? null,
      };
    });
  guests = list;
}

function syncLocal(room: Room) {
  const tracks: Record<string, LocalVideoTrack> = {};
  for (const pub of room.localParticipant.trackPublications.values()) {
    if (pub.source === Track.Source.Camera && pub.track) tracks[pub.trackName] = pub.track as LocalVideoTrack;
  }
  localCameraTracks = tracks;
  const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
  localScreenTrack = (screenPub?.track as LocalVideoTrack | undefined) ?? null;
  sharing = Boolean(screenPub?.track && !screenPub.isMuted);
}

function broadcastCameras(cameras: HostCamera[], spot: string | null) {
  const room = roomRef.current;
  if (!room || role !== "host") return;
  const message: CamerasMessage = {
    type: "cameras",
    cameras: cameras.map(({ id, name }) => ({ id, name })),
    spotlight: spot,
  };
  void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)), {
    reliable: true,
    topic: TOPIC,
  });
}

function updateCameras(next: HostCamera[]) {
  hostCameras = next;
  hostCamerasRef = next;
  try {
    if (activeCampaignId) localStorage.setItem(camerasKey(activeCampaignId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  broadcastCameras(next, spotlightRef);
  emit();
}

async function publishCamera(cam: HostCamera) {
  const room = roomRef.current;
  if (!room || room.localParticipant.getTrackPublicationByName(cam.id)) return;
  const { preset, simulcast } = qualityPresets[cam.quality ?? "720"];
  try {
    const track = await createLocalVideoTrack({
      resolution: preset.resolution,
      ...(cam.deviceId && cam.deviceId !== "default" ? { deviceId: { exact: cam.deviceId } } : {}),
    });
    await room.localParticipant.publishTrack(track, {
      source: Track.Source.Camera,
      name: cam.id,
      videoSimulcastLayers: simulcast,
    });
    cameraErrors = (() => {
      if (!(cam.id in cameraErrors)) return cameraErrors;
      const next = { ...cameraErrors };
      delete next[cam.id];
      return next;
    })();
  } catch (error) {
    console.error(error);
    const reason =
      error instanceof DOMException && error.name === "NotReadableError"
        ? "Dispositivo em uso por outro aplicativo ou câmera."
        : error instanceof DOMException && error.name === "OverconstrainedError"
          ? "Dispositivo não encontrado. Escolha outro na lista."
          : "Não foi possível acessar o dispositivo.";
    cameraErrors = { ...cameraErrors, [cam.id]: reason };
  }
  emit();
}

function unpublishCamera(id: string) {
  const room = roomRef.current;
  const track = room?.localParticipant.getTrackPublicationByName(id)?.track;
  if (room && track) {
    room.localParticipant.unpublishTrack(track);
    track.stop();
  }
  cameraErrors = (() => {
    if (!(id in cameraErrors)) return cameraErrors;
    const next = { ...cameraErrors };
    delete next[id];
    return next;
  })();
}

function handleDataMessage(payload: Uint8Array, participant: { identity: string; name?: string }) {
  let data: DataMessage;
  try {
    data = JSON.parse(new TextDecoder().decode(payload)) as DataMessage;
  } catch {
    return;
  }
  if (data.type === "cameras-request") {
    if (role === "host") broadcastCameras(hostCamerasRef, spotlightRef);
    return;
  }
  if (data.type === "cameras") {
    hostIdentityRef = participant.identity;
    rosterRef = data.cameras;
    spotlightRef = data.spotlight;
    spotlight = data.spotlight;
    if (roomRef.current) syncGuests(roomRef.current);
    emit();
    return;
  }
  if (data.type !== "signal") return;
  const identity = participant.identity;
  signals = {
    ...signals,
    [identity]: {
      ...signals[identity],
      ...(typeof data.hand === "boolean" ? { hand: data.hand } : {}),
      ...(typeof data.reaction === "string" ? { reaction: data.reaction, expires: Date.now() + 6000 } : {}),
    },
  };
  emit();
}

// ---- Conexão / desconexão ----

function resetTransient() {
  status = "idle";
  guests = [];
  localCameraTracks = {};
  localScreenTrack = null;
  sharing = false;
  cameraOn = false;
  signals = {};
  speakers = [];
  audioBlocked = false;
  channelName = "";
  hostIdentityRef = null;
  rosterRef = [];
}

export async function connect(opts: UseLiveKitRoomOptions) {
  if (connecting) return;
  const alreadyThere =
    (status === "live" || status === "connecting") &&
    activeChannelId === opts.channelId &&
    activeCampaignId === opts.campaignId;
  if (alreadyThere) return;

  // Move entre canais/campanhas: derruba a sala anterior antes de entrar na nova.
  if (roomRef.current) {
    try {
      await roomRef.current.disconnect();
    } catch {
      /* ignore */
    }
    roomRef.current = null;
    resetTransient();
  }

  connecting = true;
  status = "connecting";
  activeCampaignId = opts.campaignId;
  activeChannelId = opts.channelId;
  channelName = opts.channelName ?? "";
  role = opts.role;
  participantName = opts.participantName;
  audience = opts.audience ?? false;

  if (role === "host") {
    hostCameras = loadCameras(camerasKey(opts.campaignId));
    hostCamerasRef = hostCameras;
    spotlight = loadSpotlight(spotlightKey(opts.campaignId));
    spotlightRef = spotlight;
  } else {
    hostCameras = [];
    hostCamerasRef = [];
    spotlight = null;
    spotlightRef = null;
  }
  cameraErrors = {};
  emit();

  try {
    const session = loadSession();
    const credentials: TokenResponse = await api.getToken({
      channelId: opts.channelId,
      participantName,
      audience,
      profileToken: session ? peekProfileToken(session.campaignId) : undefined,
    });
    const room = new Room({
      dynacast: true,
      publishDefaults: {
        videoCodec: "av1",
        backupCodec: true,
        screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 30 },
        degradationPreference: "maintain-resolution",
      },
    });
    const sync = () => {
      syncGuests(room);
      syncLocal(room);
      emit();
    };
    room.on(RoomEvent.ParticipantConnected, () => {
      sync();
      if (role === "host") {
        broadcastCameras(hostCamerasRef, spotlightRef);
        setTimeout(() => broadcastCameras(hostCamerasRef, spotlightRef), 1500);
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, sync);
    room.on(RoomEvent.TrackPublished, sync);
    room.on(RoomEvent.TrackSubscribed, sync);
    room.on(RoomEvent.TrackUnsubscribed, sync);
    room.on(RoomEvent.TrackMuted, sync);
    room.on(RoomEvent.TrackUnmuted, sync);
    room.on(RoomEvent.LocalTrackPublished, sync);
    room.on(RoomEvent.LocalTrackUnpublished, sync);
    room.on(RoomEvent.ActiveSpeakersChanged, () => {
      speakers = room.activeSpeakers.map((s) => s.identity);
      emit();
    });
    room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (topic !== TOPIC || !participant || payload.length > 4096) return;
      handleDataMessage(payload, participant);
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => {
      audioBlocked = !playing;
      emit();
    });

    await room.connect(credentials.url, credentials.token);
    roomRef.current = room;
    localIdentity = room.localParticipant.identity;
    audioBlocked = !room.canPlaybackAudio;
    await applySpeakerDevice(room);
    await enableMicWithFallback(room);
    if (role === "host") {
      broadcastCameras(hostCamerasRef, spotlightRef);
    } else {
      if (cameraOn) await enableCameraWithFallback(room);
      void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "cameras-request" })), {
        reliable: true,
        topic: TOPIC,
      });
    }
    sync();
    status = "live";
  } catch (error) {
    console.error(error);
    status = "error";
  } finally {
    connecting = false;
    emit();
  }
}

export function disconnect() {
  void roomRef.current?.disconnect();
  roomRef.current = null;
  resetTransient();
  activeCampaignId = null;
  activeChannelId = null;
  emit();
}

// ---- Ações ----

export async function toggleMic() {
  const next = !micOn;
  await roomRef.current?.localParticipant.setMicrophoneEnabled(next, micOptions());
  micOn = next;
  emit();
}

export function enableAudio() {
  void roomRef.current?.startAudio();
}

export async function toggleCamera() {
  const next = !cameraOn;
  const room = roomRef.current;
  if (room) {
    await room.localParticipant.setCameraEnabled(next, cameraOptions());
  }
  cameraOn = next;
  emit();
}

export function setShareQuality(quality: ShareQuality) {
  setPreferences({ shareQuality: quality });
}

export async function toggleShare() {
  const next = !sharing;
  const room = roomRef.current;
  if (room) {
    const prefs = getPreferences();
    const preset = shareQualityPresets[prefs.shareQuality];
    // Aplicado no próximo compartilhamento: trocar qualidade no meio reabriria o seletor do navegador.
    room.options.publishDefaults = {
      ...room.options.publishDefaults,
      screenShareEncoding: { maxBitrate: preset.maxBitrate, maxFramerate: preset.maxFramerate },
    };
    await room.localParticipant.setScreenShareEnabled(next, {
      audio: true,
      contentHint: prefs.contentHint,
      resolution: preset.resolution,
    });
  }
  sharing = next;
  localScreenTrack = (room?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined) ?? null;
  emit();
}

export function sendSignal(data: { hand?: boolean; reaction?: string }) {
  const identity = localIdentity;
  signals = {
    ...signals,
    [identity]: {
      ...signals[identity],
      ...data,
      ...(data.reaction ? { expires: Date.now() + 6000 } : {}),
    },
  };
  void roomRef.current?.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify({ type: "signal", ...data })),
    { reliable: true, topic: TOPIC },
  );
  emit();
}

export async function addCamera(name: string, deviceId: string) {
  const cam: HostCamera = { id: `cam-${crypto.randomUUID().slice(0, 8)}`, name, deviceId, enabled: true };
  updateCameras([...hostCamerasRef, cam]);
  await publishCamera(cam);
}

export function removeCamera(id: string) {
  unpublishCamera(id);
  updateCameras(hostCamerasRef.filter((c) => c.id !== id));
  if (spotlightRef === id) setSpotlight(null);
}

export async function toggleHostCamera(id: string) {
  const cam = hostCamerasRef.find((c) => c.id === id);
  if (!cam) return;
  updateCameras(hostCamerasRef.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  if (cam.enabled) unpublishCamera(id);
  else await publishCamera({ ...cam, enabled: true });
}

export async function updateCamera(id: string, patch: { name?: string; deviceId?: string; quality?: CameraQuality }) {
  const cam = hostCamerasRef.find((c) => c.id === id);
  if (!cam) return;
  const updated = { ...cam, ...patch };
  updateCameras(hostCamerasRef.map((c) => (c.id === id ? updated : c)));
  const captureChanged = (patch.deviceId && patch.deviceId !== cam.deviceId) || (patch.quality && patch.quality !== (cam.quality ?? "720"));
  if (updated.enabled && captureChanged) {
    unpublishCamera(id);
    await publishCamera(updated);
  }
}

export function setSpotlight(id: string | null) {
  spotlight = id;
  spotlightRef = id;
  try {
    if (activeCampaignId) {
      if (id) localStorage.setItem(spotlightKey(activeCampaignId), id);
      else localStorage.removeItem(spotlightKey(activeCampaignId));
    }
  } catch {
    /* ignore */
  }
  broadcastCameras(hostCamerasRef, id);
  emit();
}
