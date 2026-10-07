import { useEffect, useState } from "react";
import { api } from "@/web/lib/api";
import { displayName, type Session } from "@/web/lib/session";
import { useLiveKitRoom } from "./useLiveKitRoom";
import { MeetingStage } from "./MeetingStage";
import { Controls } from "./Controls";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { DevicesDialog } from "./DevicesDialog";
import { UserX } from "lucide-react";
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
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-secondary">
            <UserX className="size-6 text-danger" />
          </div>
          <p className="text-lg font-semibold">Não foi possível conectar</p>
          <p className="mt-1 text-sm text-muted-foreground">Verifique a configuração do LiveKit e tente novamente.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => void meeting.connect()}>Tentar novamente</Button>
            <Button variant="outline" onClick={leave}>Voltar ao chat</Button>
          </div>
        </div>
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
