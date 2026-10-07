import { useCallback, useEffect, useRef, useState } from "react";
import { createLocalVideoTrack, Room, RoomEvent, Track, VideoPresets } from "livekit-client";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { api, type TokenResponse } from "@/web/lib/api";

export type RoomStatus = "idle" | "connecting" | "live" | "error";

export type RemoteCamera = { id: string; name: string; track: RemoteVideoTrack | null };

export type RemoteGuest = {
  identity: string;
  name: string;
  isHost: boolean;
  cameras: RemoteCamera[];
  cameraTrack: RemoteVideoTrack | null;
  screenTrack: RemoteVideoTrack | null;
};

export type CameraQuality = "360" | "540" | "720";

export type HostCamera = { id: string; name: string; deviceId: string; enabled: boolean; quality?: CameraQuality };

export type Signal = { hand?: boolean; reaction?: string; expires?: number };

type CamerasMessage = { type: "cameras"; cameras: { id: string; name: string }[]; spotlight: string | null };
type DataMessage = { type: "signal"; hand?: boolean; reaction?: string } | CamerasMessage | { type: "cameras-request" };

const TOPIC = "mesa-data";
const CAMERAS_KEY = "diegesis:cameras";
const SPOTLIGHT_KEY = "diegesis:spotlight";

function loadCameras(): HostCamera[] {
  try {
    const raw = localStorage.getItem(CAMERAS_KEY);
    return raw ? (JSON.parse(raw) as HostCamera[]) : [];
  } catch {
    return [];
  }
}

function loadSpotlight(): string | null {
  try {
    const raw = localStorage.getItem(SPOTLIGHT_KEY);
    if (!raw) return null;
    return raw.startsWith("cam-") ? `cam:${raw}` : raw;
  } catch {
    return null;
  }
}

export type UseLiveKitRoomOptions = {
  channelId: string;
  participantName: string;
  role: "host" | "guest";
  audience?: boolean;
};

export function useLiveKitRoom({ channelId, participantName, role, audience = false }: UseLiveKitRoomOptions) {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [guests, setGuests] = useState<RemoteGuest[]>([]);
  const [hostCameras, setHostCameras] = useState<HostCamera[]>(() => (role === "host" ? loadCameras() : []));
  const [localCameraTracks, setLocalCameraTracks] = useState<Record<string, LocalVideoTrack>>({});
  const [localScreenTrack, setLocalScreenTrack] = useState<LocalVideoTrack | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [signals, setSignals] = useState<Record<string, Signal>>({});
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [spotlight, setSpotlightState] = useState<string | null>(() => (role === "host" ? loadSpotlight() : null));
  const [cameraErrors, setCameraErrors] = useState<Record<string, string>>({});
  const localIdentityRef = useRef("local");
  const hostCamerasRef = useRef(hostCameras);
  const spotlightRef = useRef(spotlight);
  const hostIdentityRef = useRef<string | null>(null);
  const rosterRef = useRef<{ id: string; name: string }[]>([]);

  const syncGuests = useCallback((room: Room) => {
    const roster = rosterRef.current;
    const hostId = hostIdentityRef.current;
    const list = Array.from(room.remoteParticipants.values()).map((participant) => {
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
      return {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isHost,
        cameras,
        cameraTrack: cameras[0]?.track ?? null,
        screenTrack: (screenPub?.track as RemoteVideoTrack | undefined) ?? null,
      };
    });
    setGuests(list);
  }, []);

  const syncLocal = useCallback((room: Room) => {
    const tracks: Record<string, LocalVideoTrack> = {};
    for (const pub of room.localParticipant.trackPublications.values()) {
      if (pub.source === Track.Source.Camera && pub.track) tracks[pub.trackName] = pub.track as LocalVideoTrack;
    }
    setLocalCameraTracks(tracks);
    const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    setLocalScreenTrack((screenPub?.track as LocalVideoTrack | undefined) ?? null);
    setSharing(Boolean(screenPub?.track && !screenPub.isMuted));
  }, []);

  const broadcastCameras = useCallback((cameras: HostCamera[], spot: string | null) => {
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
  }, [role]);

  const updateCameras = useCallback(
    (next: HostCamera[]) => {
      setHostCameras(next);
      hostCamerasRef.current = next;
      try {
        localStorage.setItem(CAMERAS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      broadcastCameras(next, spotlightRef.current);
    },
    [broadcastCameras],
  );

  async function publishCamera(cam: HostCamera) {
    const room = roomRef.current;
    if (!room || room.localParticipant.getTrackPublicationByName(cam.id)) return;
    const quality = cam.quality ?? "720";
    const preset = { "360": VideoPresets.h360, "540": VideoPresets.h540, "720": VideoPresets.h720 }[quality];
    const simulcastLayers = { "360": [VideoPresets.h180], "540": [VideoPresets.h180], "720": [VideoPresets.h360, VideoPresets.h180] }[quality];
    try {
      const track = await createLocalVideoTrack({
        resolution: preset.resolution,
        ...(cam.deviceId && cam.deviceId !== "default" ? { deviceId: { exact: cam.deviceId } } : {}),
      });
      await room.localParticipant.publishTrack(track, {
        source: Track.Source.Camera,
        name: cam.id,
        videoSimulcastLayers: simulcastLayers,
      });
      setCameraErrors((current) => {
        if (!(cam.id in current)) return current;
        const next = { ...current };
        delete next[cam.id];
        return next;
      });
    } catch (error) {
      console.error(error);
      const reason =
        error instanceof DOMException && error.name === "NotReadableError"
          ? "Dispositivo em uso por outro aplicativo ou câmera."
          : error instanceof DOMException && error.name === "OverconstrainedError"
            ? "Dispositivo não encontrado. Escolha outro na lista."
            : "Não foi possível acessar o dispositivo.";
      setCameraErrors((current) => ({ ...current, [cam.id]: reason }));
    }
  }

  function unpublishCamera(id: string) {
    const room = roomRef.current;
    const track = room?.localParticipant.getTrackPublicationByName(id)?.track;
    if (room && track) {
      room.localParticipant.unpublishTrack(track);
      track.stop();
    }
    setCameraErrors((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  const connect = useCallback(async () => {
    if (status === "connecting" || status === "live") return;
    setStatus("connecting");
    try {
      const credentials: TokenResponse = await api.getToken({
        channelId,
        participantName,
        role,
        audience,
      });
      const room = new Room({ dynacast: true });
      const sync = () => {
        syncGuests(room);
        syncLocal(room);
      };
      room.on(RoomEvent.ParticipantConnected, () => {
        sync();
        if (role === "host") {
          broadcastCameras(hostCamerasRef.current, spotlightRef.current);
          setTimeout(() => broadcastCameras(hostCamerasRef.current, spotlightRef.current), 1500);
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
      room.on(RoomEvent.ActiveSpeakersChanged, () => setSpeakers(room.activeSpeakers.map((s) => s.identity)));
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (topic !== TOPIC || !participant || payload.length > 4096) return;
        handleDataMessage(payload, participant);
      });

      await room.connect(credentials.url, credentials.token);
      roomRef.current = room;
      localIdentityRef.current = room.localParticipant.identity;
      await room.localParticipant.setMicrophoneEnabled(micOn);
      if (role === "host") {
        for (const cam of hostCamerasRef.current) {
          if (cam.enabled) await publishCamera(cam);
        }
        broadcastCameras(hostCamerasRef.current, spotlightRef.current);
      } else {
        if (cameraOn) await room.localParticipant.setCameraEnabled(true);
        void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "cameras-request" })), {
          reliable: true,
          topic: TOPIC,
        });
      }
      sync();
      setStatus("live");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }, [status, channelId, participantName, role, audience, micOn, cameraOn, syncGuests, syncLocal, broadcastCameras]);

  const disconnect = useCallback(() => {
    void roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus("idle");
    setGuests([]);
    setLocalCameraTracks({});
    setLocalScreenTrack(null);
    setSharing(false);
    setCameraOn(false);
    setSignals({});
    hostIdentityRef.current = null;
    rosterRef.current = [];
  }, []);

  useEffect(() => () => void roomRef.current?.disconnect(), []);

  // ---- Data message handling (signals + host camera roster) ----
  function handleDataMessage(payload: Uint8Array, participant: { identity: string; name?: string }) {
    let data: DataMessage;
    try {
      data = JSON.parse(new TextDecoder().decode(payload)) as DataMessage;
    } catch {
      return;
    }
    if (data.type === "cameras-request") {
      if (role === "host") broadcastCameras(hostCamerasRef.current, spotlightRef.current);
      return;
    }
    if (data.type === "cameras") {
      hostIdentityRef.current = participant.identity;
      rosterRef.current = data.cameras;
      spotlightRef.current = data.spotlight;
      setSpotlightState(data.spotlight);
      if (roomRef.current) syncGuests(roomRef.current);
      return;
    }
    if (data.type !== "signal") return;
    const identity = participant.identity;
    setSignals((current) => ({
      ...current,
      [identity]: {
        ...current[identity],
        ...(typeof data.hand === "boolean" ? { hand: data.hand } : {}),
        ...(typeof data.reaction === "string" ? { reaction: data.reaction, expires: Date.now() + 6000 } : {}),
      },
    }));
  }

  // ---- Camera actions (host multi-camera) ----
  const addCamera = useCallback(
    async (name: string, deviceId: string) => {
      const cam: HostCamera = { id: `cam-${crypto.randomUUID().slice(0, 8)}`, name, deviceId, enabled: true };
      updateCameras([...hostCamerasRef.current, cam]);
      await publishCamera(cam);
    },
    [updateCameras],
  );

  const removeCamera = useCallback(
    (id: string) => {
      unpublishCamera(id);
      updateCameras(hostCamerasRef.current.filter((c) => c.id !== id));
      if (spotlightRef.current === id) setSpotlight(null);
    },
    [updateCameras],
  );

  const toggleHostCamera = useCallback(
    async (id: string) => {
      const cam = hostCamerasRef.current.find((c) => c.id === id);
      if (!cam) return;
      updateCameras(hostCamerasRef.current.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
      if (cam.enabled) unpublishCamera(id);
      else await publishCamera({ ...cam, enabled: true });
    },
    [updateCameras],
  );

  const updateCamera = useCallback(
    async (id: string, patch: { name?: string; deviceId?: string; quality?: CameraQuality }) => {
      const cam = hostCamerasRef.current.find((c) => c.id === id);
      if (!cam) return;
      const updated = { ...cam, ...patch };
      updateCameras(hostCamerasRef.current.map((c) => (c.id === id ? updated : c)));
      const captureChanged = (patch.deviceId && patch.deviceId !== cam.deviceId) || (patch.quality && patch.quality !== (cam.quality ?? "720"));
      if (updated.enabled && captureChanged) {
        unpublishCamera(id);
        await publishCamera(updated);
      }
    },
    [updateCameras],
  );

  const setSpotlight = useCallback(
    (id: string | null) => {
      setSpotlightState(id);
      spotlightRef.current = id;
      try {
        if (id) localStorage.setItem(SPOTLIGHT_KEY, id);
        else localStorage.removeItem(SPOTLIGHT_KEY);
      } catch {
        /* ignore */
      }
      broadcastCameras(hostCamerasRef.current, id);
    },
    [broadcastCameras],
  );

  // ---- Actions (shared) ----
  const toggleMic = useCallback(async () => {
    const next = !micOn;
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCamera = useCallback(async () => {
    const next = !cameraOn;
    const room = roomRef.current;
    if (room) {
      await room.localParticipant.setCameraEnabled(next);
    }
    setCameraOn(next);
  }, [cameraOn]);

  const toggleShare = useCallback(async () => {
    const next = !sharing;
    const room = roomRef.current;
    if (room) {
      await room.localParticipant.setScreenShareEnabled(next, { audio: true });
    }
    setSharing(next);
    setLocalScreenTrack((room?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined) ?? null);
  }, [sharing]);

  const sendSignal = useCallback((data: { hand?: boolean; reaction?: string }) => {
    const identity = localIdentityRef.current;
    setSignals((current) => ({
      ...current,
      [identity]: {
        ...current[identity],
        ...data,
        ...(data.reaction ? { expires: Date.now() + 6000 } : {}),
      },
    }));
    void roomRef.current?.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: "signal", ...data })),
      { reliable: true, topic: TOPIC },
    );
  }, []);

  const anyCameraOn = role === "host" ? hostCameras.some((c) => c.enabled) : cameraOn;

  return {
    roomRef,
    status,
    guests,
    hostCameras,
    localCameraTracks,
    localScreenTrack,
    micOn,
    cameraOn: anyCameraOn,
    sharing,
    signals,
    speakers,
    spotlight,
    cameraErrors,
    localIdentity: localIdentityRef.current,
    connect,
    disconnect,
    toggleMic,
    toggleCamera,
    toggleShare,
    sendSignal,
    addCamera,
    removeCamera,
    toggleHostCamera,
    updateCamera,
    setSpotlight,
  };
}
