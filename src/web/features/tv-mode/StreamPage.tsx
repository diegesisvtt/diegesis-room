import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import type { RemoteVideoTrack } from "livekit-client";
import { RefreshCw, Users, Volume2 } from "lucide-react";
import { api } from "@/web/lib/api";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";

type StreamStatus = "connecting" | "live" | "error";

type StreamGuest = {
  identity: string;
  name: string;
  track: RemoteVideoTrack | null;
  speaking: boolean;
};

export function StreamPage() {
  const { channelId = "" } = useParams();
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [guests, setGuests] = useState<StreamGuest[]>([]);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const hostIdentityRef = useRef<string | null>(null);
  const rosterRef = useRef<{ id: string; name: string }[]>([]);

  const syncParticipants = useCallback((room: Room) => {
    const list: StreamGuest[] = [];
    const roster = rosterRef.current;
    for (const participant of room.remoteParticipants.values()) {
      const cameraPubs = Array.from(participant.trackPublications.values()).filter(
        (pub) => pub.source === Track.Source.Camera,
      );
      if (participant.identity === hostIdentityRef.current) {
        for (const pub of cameraPubs) {
          list.push({
            identity: `cam:${pub.trackName}`,
            name: roster.find((c) => c.id === pub.trackName)?.name || participant.name || participant.identity,
            track: (pub.track as RemoteVideoTrack | undefined) ?? null,
            speaking: participant.isSpeaking,
          });
        }
      } else {
        const cameraPub = cameraPubs[0];
        if (cameraPub?.track) {
          list.push({
            identity: participant.identity,
            name: participant.name || participant.identity,
            track: cameraPub.track as RemoteVideoTrack,
            speaking: participant.isSpeaking,
          });
        }
      }
      const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
      if (screenPub?.track) {
        list.push({
          identity: `screen:${participant.identity}`,
          name: `${participant.name || participant.identity} · Tela`,
          track: screenPub.track as RemoteVideoTrack,
          speaking: false,
        });
      }
    }
    setGuests(list);
  }, []);

  const connect = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus("connecting");
    try {
      const credentials = await api.getToken({
        channelId,
        participantName: "Tela da mesa",
        audience: true,
      });
      const room = new Room({ dynacast: true });
      const sync = () => syncParticipants(room);
      room.on(RoomEvent.ParticipantConnected, sync);
      room.on(RoomEvent.ParticipantDisconnected, sync);
      room.on(RoomEvent.TrackPublished, sync);
      room.on(RoomEvent.TrackSubscribed, sync);
      room.on(RoomEvent.TrackUnsubscribed, sync);
      room.on(RoomEvent.ActiveSpeakersChanged, sync);
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (topic !== "mesa-data" || !participant) return;
        try {
          const data = JSON.parse(new TextDecoder().decode(payload)) as {
            type: string;
            cameras?: { id: string; name: string }[];
            spotlight?: string | null;
          };
          if (data.type !== "cameras") return;
          hostIdentityRef.current = participant.identity;
          rosterRef.current = data.cameras ?? [];
          setSpotlight(data.spotlight ?? null);
          sync();
        } catch {
          /* ignore */
        }
      });
      await room.connect(credentials.url, credentials.token);
      roomRef.current = room;
      sync();
      setStatus("live");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }, [channelId, syncParticipants]);

  useEffect(() => {
    void connect();
    return () => void roomRef.current?.disconnect();
  }, [connect]);

  const featured = (spotlight && guests.find((g) => g.identity === spotlight && g.track)) || null;
  const others = featured ? guests.filter((g) => g.identity !== featured.identity) : [];

  return (
    <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-black text-foreground">
      {status === "connecting" ? (
        <StreamLoading />
      ) : status === "error" ? (
        <StreamError onRetry={() => void connect()} />
      ) : guests.length === 0 ? (
        <EmptyStream />
      ) : featured ? (
        <section className="flex min-h-0 flex-1 gap-3 p-3 lg:gap-4 lg:p-4" aria-label="Transmissão da mesa">
          <div className="min-w-0 flex-1">
            <StreamVideoTile guest={featured} />
          </div>
          {others.length > 0 && (
            <aside className="flex w-40 shrink-0 flex-col gap-2 overflow-y-auto lg:w-56">
              {others.map((guest) => (
                <div key={guest.identity} className="aspect-video shrink-0">
                  <StreamVideoTile guest={guest} />
                </div>
              ))}
            </aside>
          )}
        </section>
      ) : (
        <section
          className={cn("grid min-h-0 flex-1 gap-3 p-3 lg:gap-4 lg:p-4", gridClass(guests.length))}
          aria-label="Jogadores remotos"
        >
          {guests.map((guest) => (
            <StreamVideoTile key={guest.identity} guest={guest} />
          ))}
        </section>
      )}
    </main>
  );
}

function gridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  return "grid-cols-3";
}

function StreamVideoTile({ guest }: { guest: StreamGuest }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !guest.track) return;
    guest.track.attach(element);
    return () => {
      guest.track?.detach(element);
    };
  }, [guest.track]);

  return (
    <article className={cn("relative h-full min-h-0 overflow-hidden rounded-md border bg-card", guest.speaking ? "voice-active border-success" : "border-border")}>
      {guest.track ? (
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center bg-secondary text-5xl font-bold">{guest.name.slice(0, 2).toUpperCase()}</div>
      )}
      <StreamLabel name={guest.name} speaking={guest.speaking} />
    </article>
  );
}

function StreamLabel({ name, speaking }: { name: string; speaking: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/75 px-5 py-3 backdrop-blur-sm">
      <span className="truncate text-base font-semibold lg:text-lg">{name}</span>
      {speaking && (
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <Volume2 className="size-5" /> Falando
        </div>
      )}
    </div>
  );
}

function StreamLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-sm font-medium text-white/70">Conectando…</p>
      </div>
    </div>
  );
}

function StreamError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6">
      <div className="text-center">
        <p className="text-lg font-semibold text-white">Sem conexão</p>
        <p className="mt-1 text-sm text-white/60">Não foi possível abrir a transmissão. Verifique a conexão e tente novamente.</p>
        <Button className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-4" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function EmptyStream() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6">
      <div className="text-center">
        <Users className="mx-auto mb-3 size-8 text-white/60" />
        <p className="text-lg font-semibold text-white">Aguardando jogadores remotos</p>
        <p className="mt-1 text-sm text-white/60">Os vídeos aparecerão aqui assim que entrarem na sala.</p>
      </div>
    </div>
  );
}
