import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/web/lib/api";
import { displayName, type Session } from "@/web/lib/session";
import { useLiveKitRoom } from "./useLiveKitRoom";
import { MeetingStage } from "./MeetingStage";
import { Controls } from "./Controls";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { DevicesDialog } from "./DevicesDialog";
import { Loader2, UserX } from "lucide-react";
import { Button } from "@/web/components/ui/button";

export function VoiceStage({
  channelId,
  session,
  onLeave,
}: {
  channelId: string;
  session: Session;
  onLeave: () => void;
}) {
  const isHost = session.role === "host";
  const myName = displayName(session);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);

  const meeting = useLiveKitRoom({
    campaignId: session.campaignId,
    channelId,
    participantName: myName,
    role: session.role,
  });

  // Entrada direta: o palco só é montado quando o usuário clica em "Entrar na voz".
  useEffect(() => {
    if (meeting.status === "idle") void meeting.connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = { idle: "Conectando…", connecting: "Conectando…", live: "Sessão ao vivo", error: "Erro de conexão" }[meeting.status];

  function leave() {
    meeting.disconnect();
    onLeave();
  }

  if (meeting.status === "error") {
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6">
        <div
          aria-hidden
          className="map-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
        />
        <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="relative text-center"
        >
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-destructive/40 bg-secondary shadow-[0_0_28px_rgba(239,68,68,0.3)]">
            <UserX className="size-8 text-danger" />
          </div>
          <p className="font-display text-2xl font-semibold tracking-wide text-glow">Não foi possível conectar</p>
          <p className="mt-2 text-sm text-muted-foreground">Verifique a configuração do LiveKit e tente novamente.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="gold" onClick={() => void meeting.connect()}>Tentar novamente</Button>
            <Button variant="outline-gold" onClick={leave}>Voltar ao chat</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (meeting.status === "idle" || meeting.status === "connecting") {
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6">
        <div
          aria-hidden
          className="map-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
        />
        <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="relative text-center"
        >
          <Loader2 className="mx-auto mb-4 size-10 animate-spin text-accent drop-shadow-[0_0_14px_color-mix(in_oklab,var(--color-accent)_60%,transparent)]" />
          <p className="font-display text-2xl font-semibold tracking-wide text-glow">Convocando a mesa…</p>
          <p className="mt-2 text-sm text-muted-foreground">Preparando áudio, vídeo e a conexão com a sala.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MeetingStage
        status={meeting.status}
        statusText={statusText}
        guests={meeting.guests}
        hostCameras={meeting.hostCameras}
        localCameraTracks={meeting.localCameraTracks}
        localScreenTrack={meeting.localScreenTrack}
        sharing={meeting.sharing}
        signals={meeting.signals}
        speakers={meeting.speakers}
        localIdentity={meeting.localIdentity}
        localName={myName}
        localPhotoUrl={session.photoUrl ?? null}
        isHost={isHost}
        spotlight={meeting.spotlight}
        onSpotlightChange={isHost ? meeting.setSpotlight : undefined}
      />
      <Controls
        status={meeting.status}
        statusText={statusText}
        micOn={meeting.micOn}
        cameraOn={meeting.cameraOn}
        sharing={meeting.sharing}
        handRaised={Boolean(meeting.signals[meeting.localIdentity]?.hand)}
        onMic={() => void meeting.toggleMic()}
        onCamera={isHost ? undefined : () => void meeting.toggleCamera()}
        onShare={() => void meeting.toggleShare()}
        onHand={() => void meeting.sendSignal({ hand: !meeting.signals[meeting.localIdentity]?.hand })}
        onReaction={(reaction) => void meeting.sendSignal({ reaction })}
        onLeave={leave}
        onOpenParticipants={() => setParticipantsOpen(true)}
        onOpenDevices={() => setDevicesOpen(true)}
      />
      <ParticipantsPanel
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        isHost={isHost}
        status={meeting.status}
        guests={meeting.guests}
        localName={myName}
        signals={meeting.signals}
        onMute={(identity, muted) => void api.muteParticipant(channelId, identity, muted)}
        onRemove={(identity) => void api.removeParticipant(channelId, identity)}
      />
      <DevicesDialog
        open={devicesOpen}
        onOpenChange={setDevicesOpen}
        roomRef={meeting.roomRef}
        isHost={isHost}
        cameras={meeting.hostCameras}
        cameraErrors={meeting.cameraErrors}
        spotlight={meeting.spotlight}
        onAddCamera={(name, deviceId) => void meeting.addCamera(name, deviceId)}
        onRemoveCamera={meeting.removeCamera}
        onToggleCamera={(id) => void meeting.toggleHostCamera(id)}
        onUpdateCamera={(id, patch) => void meeting.updateCamera(id, patch)}
        onSetSpotlight={meeting.setSpotlight}
      />
    </div>
  );
}
