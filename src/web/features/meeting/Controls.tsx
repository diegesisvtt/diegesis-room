import {
  Camera,
  CameraOff,
  ChevronDown,
  Hand,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  Smile,
  Users,
  Video,
} from "lucide-react";
import type { RoomStatus } from "./useLiveKitRoom";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/web/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/web/components/ui/tooltip";

const reactions = [
  { emoji: "👏", label: "Aplausos" },
  { emoji: "👍", label: "Curtir" },
  { emoji: "❤️", label: "Coração" },
  { emoji: "😂", label: "Risos" },
  { emoji: "🎉", label: "Comemorar" },
  { emoji: "😮", label: "Surpresa" },
];

export function Controls({
  status,
  statusText,
  micOn,
  cameraOn,
  sharing,
  handRaised,
  onMic,
  onCamera,
  onShare,
  onHand,
  onReaction,
  onLeave,
  onConnect,
  onOpenParticipants,
  onOpenDevices,
}: {
  status: RoomStatus;
  statusText: string;
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  handRaised: boolean;
  onMic: () => void;
  onCamera?: () => void;
  onShare: () => void;
  onHand: () => void;
  onReaction: (emoji: string) => void;
  onLeave: () => void;
  onConnect?: () => void;
  onOpenParticipants: () => void;
  onOpenDevices: () => void;
}) {
  const live = status === "live";
  const connecting = status === "connecting";

  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-3 py-3">
      <div className="hidden min-w-0 xl:block">
        <p className="text-xs font-semibold">{statusText}</p>
        <p className="text-[10px] text-muted-foreground">Mesa híbrida</p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <IconControl label={micOn ? "Desligar microfone" : "Ligar microfone"} active={!micOn} onClick={onMic}>
          {micOn ? <Mic /> : <MicOff />}
        </IconControl>
        <IconControl label="Opções de áudio e vídeo" onClick={onOpenDevices}>
          <ChevronDown />
        </IconControl>
        {onCamera && (
          <IconControl label={cameraOn ? "Desligar câmera" : "Ligar câmera"} active={cameraOn} onClick={onCamera}>
            {cameraOn ? <Camera /> : <CameraOff />}
          </IconControl>
        )}
        <IconControl label={sharing ? "Parar compartilhamento" : "Compartilhar tela"} active={sharing} onClick={onShare}>
          <MonitorUp />
        </IconControl>
        <IconControl label="Participantes" onClick={onOpenParticipants}>
          <Users />
        </IconControl>
        <IconControl label={handRaised ? "Abaixar mão" : "Levantar mão"} active={handRaised} onClick={onHand}>
          <Hand />
        </IconControl>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 sm:size-9" aria-label="Reações" title="Reações">
              <Smile />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" side="top">
            <p className="mb-3 text-xs font-semibold">Reações</p>
            <div className="grid grid-cols-6 gap-1">
              {reactions.map((r) => (
                <Button key={r.label} variant="ghost" size="icon" aria-label={r.label} onClick={() => onReaction(r.emoji)} className="text-xl">
                  {r.emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        size="sm"
        variant={live ? "destructive" : "default"}
        disabled={connecting || (!onConnect && !live)}
        onClick={live ? onLeave : onConnect}
      >
        {live ? (
          <>
            <LogOut className="size-4" /> Sair
          </>
        ) : (
          <>
            <Video className="size-4" /> {connecting ? "Conectando…" : "Entrar"}
          </>
        )}
      </Button>
    </footer>
  );
}

function IconControl({
  label,
  children,
  onClick,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          aria-label={label}
          onClick={onClick}
          className={cn("size-8 shrink-0 sm:size-9", active && "bg-secondary")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
