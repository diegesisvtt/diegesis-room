import { useSyncExternalStore } from "react";
import { createLocalVideoTrack, LocalVideoTrack, Room, RoomEvent, Track, VideoPresets } from "livekit-client";
import type { RemoteAudioTrack, RemoteVideoTrack } from "livekit-client";
import { api, type TokenResponse } from "@/web/lib/api";
import { loadSession, peekProfileToken } from "@/web/lib/session";
import { getPreferences, setPreferences, shareQualityPresets, type AdditionalCamera, type CameraBackground, type ShareQuality } from "@/web/lib/preferences";
import { createBackgroundPipeline, type BackgroundPipeline } from "./backgroundPipeline";

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
  micMuted: boolean;
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

/** Nome fixo da publicação da câmera pessoal (host e guest). */
const PERSONAL_CAMERA_NAME = "personal";

function spotlightKey(campaignId: string) {
  return `diegesis:spotlight:${campaignId}`;
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
let personalCameraTrack: LocalVideoTrack | null = null;
let localScreenTrack: LocalVideoTrack | null = null;
let micOn = true;
let cameraOn = false;
let personalCameraPipeline: BackgroundPipeline | null = null;
let sharing = false;
let audioBlocked = false;
let signals: Record<string, Signal> = {};
let speakers: string[] = [];
let spotlight: string | null = null;
let cameraErrors: Record<string, string> = {};
let localIdentity = "local";
let volumes: Record<string, number> = {};

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
  personalCameraTrack: LocalVideoTrack | null;
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
  volumes: Record<string, number>;
  activeCampaignId: string | null;
  activeChannelId: string | null;
  channelName: string;
  role: "host" | "guest";
  participantName: string;
};

function buildSnapshot(): VoiceSnapshot {
  return {
    status,
    guests,
    hostCameras,
    localCameraTracks,
    personalCameraTrack,
    localScreenTrack,
    micOn,
    cameraOn,
    sharing,
    audioBlocked,
    signals,
    speakers,
    spotlight,
    cameraErrors,
    localIdentity,
    volumes,
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

/** Traduz erros comuns de acesso à câmera para uma mensagem legível. */
function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Permissão de câmera negada pelo navegador.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "Nenhuma câmera encontrada neste dispositivo.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "Câmera em uso por outro aplicativo.";
    }
    if (error.name === "OverconstrainedError") {
      return "A câmera escolhida não suporta a configuração solicitada.";
    }
  }
  return error instanceof Error && error.message ? error.message : "Não foi possível acessar a câmera.";
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

/** Publica a câmera pessoal (host e guest), com fallback de dispositivo e fundo virtual. */
async function publishPersonalCamera(room: Room, background: CameraBackground) {
  const prefs = getPreferences();
  const resolution = qualityPresets[prefs.cameraQuality].preset.resolution;

  async function acquire(deviceId: string): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      video: {
        ...(deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : {}),
        width: resolution.width,
        height: resolution.height,
      },
      audio: false,
    });
  }

  let stream: MediaStream;
  try {
    stream = await acquire(prefs.cameraDeviceId);
  } catch (error) {
    if (!isDeviceMissing(error)) throw error;
    setPreferences({ cameraDeviceId: "default" });
    stream = await acquire("default");
  }

  let track: LocalVideoTrack;
  if (background.mode === "none") {
    track = new LocalVideoTrack(stream.getVideoTracks()[0]!, undefined, true);
  } else {
    const pipeline = await createBackgroundPipeline({
      stream,
      background,
      width: resolution.width,
      height: resolution.height,
    });
    personalCameraPipeline = pipeline;
    track = new LocalVideoTrack(pipeline.track, undefined, true);
  }
  await room.localParticipant.publishTrack(track, {
    source: Track.Source.Camera,
    name: PERSONAL_CAMERA_NAME,
  });
}

/** Desliga/despublica a câmera pessoal (processada ou não). */
async function disablePersonalCamera(room: Room) {
  // Captura a referência antes de despublicar: `unpublishTrack` limpa o
  // `publication.track` sincronamente, o que tornaria o acesso posterior indefinido.
  const track = room.localParticipant.getTrackPublicationByName(PERSONAL_CAMERA_NAME)?.track;
  if (track) {
    await room.localParticipant.unpublishTrack(track);
    track.stop();
  }
  personalCameraPipeline?.stop();
  personalCameraPipeline = null;
}

/** Liga a câmera pessoal aplicando o fundo salvo, com mensagem de erro amigável. */
async function enablePersonalCamera(room: Room, background: CameraBackground) {
  try {
    await publishPersonalCamera(room, background);
  } catch (error) {
    throw new Error(cameraErrorMessage(error));
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
        micMuted: Boolean(micPub?.isMuted),
      };
    });
  guests = list;
  applyVolumes();
}

function applyVolumes() {
  for (const guest of guests) {
    const vol = volumes[guest.identity];
    if (vol !== undefined && guest.audioTrack) guest.audioTrack.setVolume(vol);
  }
}

function syncLocal(room: Room) {
  const tracks: Record<string, LocalVideoTrack> = {};
  let personal: LocalVideoTrack | null = null;
  for (const pub of room.localParticipant.trackPublications.values()) {
    if (pub.source === Track.Source.Camera && pub.track) {
      const track = pub.track as LocalVideoTrack;
      if (pub.trackName === PERSONAL_CAMERA_NAME) personal = track;
      else tracks[pub.trackName] = track;
    }
  }
  localCameraTracks = tracks;
  personalCameraTrack = personal;
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
  personalCameraTrack = null;
  localScreenTrack = null;
  sharing = false;
  cameraOn = false;
  personalCameraPipeline?.stop();
  personalCameraPipeline = null;
  signals = {};
  speakers = [];
  audioBlocked = false;
  channelName = "";
  hostIdentityRef = null;
  rosterRef = [];
  volumes = {};
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
    hostCameras = getPreferences().cameras.map((cam: AdditionalCamera) => ({ ...cam, enabled: false }));
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
    // Câmera pessoal vale para host e guest; o host ainda tem as câmeras da mesa.
    if (cameraOn) await enablePersonalCamera(room, getPreferences().cameraBackground);
    if (role === "host") {
      broadcastCameras(hostCamerasRef, spotlightRef);
    } else {
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
    if (next) await enablePersonalCamera(room, getPreferences().cameraBackground);
    else await disablePersonalCamera(room);
  }
  cameraOn = next;
  emit();
}

/** Aplica dispositivo, qualidade e fundo, ligando (ou reiniciando) a câmera pessoal. */
export async function enableCameraWithSettings(opts: {
  deviceId?: string;
  quality?: CameraQuality;
  background?: CameraBackground;
}) {
  if (opts.deviceId !== undefined) setPreferences({ cameraDeviceId: opts.deviceId });
  if (opts.quality !== undefined) setPreferences({ cameraQuality: opts.quality });
  if (opts.background !== undefined) setPreferences({ cameraBackground: opts.background });

  const room = roomRef.current;
  if (!room) return;

  if (cameraOn) await disablePersonalCamera(room);
  await enablePersonalCamera(room, getPreferences().cameraBackground);
  cameraOn = true;
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

export async function toggleHostCamera(id: string) {
  const cam = hostCamerasRef.find((c) => c.id === id);
  if (!cam) return;
  updateCameras(hostCamerasRef.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  if (cam.enabled) unpublishCamera(id);
  else await publishCamera({ ...cam, enabled: true });
}

/** Liga/desliga todas as câmeras do host de uma vez (ícone de câmera). */
export async function toggleAllHostCameras() {
  const anyOn = hostCamerasRef.some((c) => c.enabled);
  const next = hostCamerasRef.map((c) => ({ ...c, enabled: !anyOn }));
  updateCameras(next);
  for (const cam of next) {
    if (cam.enabled) await publishCamera(cam);
    else unpublishCamera(cam.id);
  }
}

/** Ajusta o volume individual de um participante remoto (0..1). */
export function setParticipantVolume(identity: string, volume: number) {
  volumes = { ...volumes, [identity]: volume };
  const guest = guests.find((g) => g.identity === identity);
  guest?.audioTrack?.setVolume(volume);
  emit();
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
