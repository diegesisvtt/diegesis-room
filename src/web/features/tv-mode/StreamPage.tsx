import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Room, RoomEvent, Track } from "livekit-client";
import type { RemoteVideoTrack } from "livekit-client";
import { Loader2, RefreshCw, Sparkles, Volume2 } from "lucide-react";
import { api, wsUrl, type Message } from "@/web/lib/api";
import { animateRoll, parseRollPayload } from "@/web/features/dice/diceBox";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";

type StreamStatus = "connecting" | "live" | "error";

type StreamGuest = {
  identity: string;
  name: string;
  track: RemoteVideoTrack | null;
  photoUrl: string | null;
  speaking: boolean;
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

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const tileVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 140, damping: 20 } },
};

export function StreamPage() {
  const { channelId = "" } = useParams();
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [guests, setGuests] = useState<StreamGuest[]>([]);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const connectingRef = useRef(false);
  const hostIdentityRef = useRef<string | null>(null);
  const rosterRef = useRef<{ id: string; name: string }[]>([]);

  const syncParticipants = useCallback((room: Room) => {
    const list: StreamGuest[] = [];
    const roster = rosterRef.current;
    for (const participant of room.remoteParticipants.values()) {
      const meta = parseMetadata(participant.metadata);
      // Audiência (outras telas de streaming) é subscribe-only: nunca aparece.
      if (participant.permissions?.canPublish === false || meta.audience) continue;
      const photoUrl = meta.photo;
      const cameraPubs = Array.from(participant.trackPublications.values()).filter(
        (pub) => pub.source === Track.Source.Camera,
      );
      if (participant.identity === hostIdentityRef.current && cameraPubs.length > 0) {
        for (const pub of cameraPubs) {
          list.push({
            identity: `cam:${pub.trackName}`,
            name: roster.find((c) => c.id === pub.trackName)?.name || participant.name || participant.identity,
            track: (pub.track as RemoteVideoTrack | undefined) ?? null,
            photoUrl,
            speaking: participant.isSpeaking,
          });
        }
      } else {
        const cameraPub = cameraPubs[0];
        list.push({
          identity: participant.identity,
          name: participant.name || participant.identity,
          track: (cameraPub?.track as RemoteVideoTrack | undefined) ?? null,
          photoUrl,
          speaking: participant.isSpeaking,
        });
      }
      const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
      if (screenPub?.track) {
        list.push({
          identity: `screen:${participant.identity}`,
          name: `${participant.name || participant.identity} · Tela`,
          track: screenPub.track as RemoteVideoTrack,
          photoUrl: null,
          speaking: false,
        });
      }
    }
    setGuests(list);
  }, []);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
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
    } finally {
      connectingRef.current = false;
    }
  }, [channelId, syncParticipants]);

  useEffect(() => {
    void connect();
    return () => void roomRef.current?.disconnect();
  }, [connect]);

  // Escuta o chat do canal para animar as rolagens de dados também no modo streaming.
  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    function open() {
      ws = new WebSocket(wsUrl(channelId, undefined, undefined, true));
      ws.onmessage = (event) => {
        let data: { type?: string; message?: Message };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === "message" && data.message?.kind === "roll") {
          void animateRoll(parseRollPayload(data.message.rollJson));
        }
      };
      ws.onclose = () => {
        if (!disposed) reconnect = setTimeout(open, 1500);
      };
      ws.onerror = () => ws?.close();
    }

    open();
    return () => {
      disposed = true;
      if (reconnect) clearTimeout(reconnect);
      ws?.close();
    };
  }, [channelId]);

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
        <motion.section
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="flex min-h-0 flex-1 gap-3 p-3 lg:gap-4 lg:p-4"
          aria-label="Transmissão da mesa"
        >
          <motion.div variants={tileVariants} className="min-w-0 flex-1">
            <StreamVideoTile guest={featured} />
          </motion.div>
          {others.length > 0 && (
            <aside className="flex w-40 shrink-0 flex-col gap-2 overflow-y-auto lg:w-56">
              {others.map((guest) => (
                <motion.div key={guest.identity} variants={tileVariants} className="aspect-video shrink-0">
                  <StreamVideoTile guest={guest} />
                </motion.div>
              ))}
            </aside>
          )}
        </motion.section>
      ) : (
        <motion.section
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className={cn("grid min-h-0 flex-1 gap-3 p-3 lg:gap-4 lg:p-4", gridClass(guests.length))}
          aria-label="Jogadores remotos"
        >
          {guests.map((guest) => (
            <motion.div key={guest.identity} variants={tileVariants} className="min-h-0">
              <StreamVideoTile guest={guest} />
            </motion.div>
          ))}
        </motion.section>
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
    <article
      className={cn(
        "relative h-full min-h-0 overflow-hidden rounded-lg border bg-card transition-shadow duration-300",
        guest.speaking ? "voice-active border-success" : "border-border-gold/30",
      )}
    >
      {guest.track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={cn("h-full w-full", guest.identity.startsWith("screen:") ? "object-contain" : "object-cover")}
        />
      ) : guest.photoUrl ? (
        <div className="flex h-full items-center justify-center bg-secondary">
          <img src={guest.photoUrl} alt={guest.name} className="size-24 rounded-full object-cover shadow-[var(--shadow-glow-gold)] lg:size-32" />
        </div>
      ) : (
        <div className="font-display flex h-full items-center justify-center bg-secondary text-5xl font-bold text-accent/70">
          {guest.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <StreamLabel name={guest.name} speaking={guest.speaking} />
    </article>
  );
}

function StreamLabel({ name, speaking }: { name: string; speaking: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/50 to-transparent px-5 pt-8 pb-3">
      <span className="font-display truncate text-base font-semibold tracking-wide lg:text-lg">{name}</span>
      {speaking && (
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <span className="animate-pulse-dot size-2 rounded-full bg-success shadow-[0_0_10px_var(--color-success)]" />
          <Volume2 className="size-5" /> Falando
        </div>
      )}
    </div>
  );
}

function StreamLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center"
      >
        <Loader2 className="mx-auto mb-4 size-10 animate-spin text-accent" />
        <p className="font-display text-glow gold-shimmer-text text-lg">Conectando…</p>
      </motion.div>
    </div>
  );
}

function StreamError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
      <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative text-center"
      >
        <p className="font-display text-glow text-2xl font-bold text-danger">Sem conexão</p>
        <p className="mt-2 text-sm text-white/60">
          Não foi possível abrir a transmissão. Verifique a conexão e tente novamente.
        </p>
        <Button variant="outline-gold" className="mt-6" onClick={onRetry}>
          <RefreshCw className="size-4" /> Tentar novamente
        </Button>
      </motion.div>
    </div>
  );
}

function EmptyStream() {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-accent)_6%,transparent),transparent_65%)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative text-center"
      >
        <div className="animate-float mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-accent/30 bg-accent/10 shadow-[var(--shadow-glow-gold)]">
          <Sparkles className="size-8 text-accent" />
        </div>
        <p className="font-display text-glow gold-shimmer-text text-2xl font-bold tracking-wide">
          Aguardando jogadores remotos
        </p>
        <p className="mt-2 text-sm text-white/60">Os vídeos aparecerão aqui assim que entrarem na sala.</p>
      </motion.div>
    </div>
  );
}
