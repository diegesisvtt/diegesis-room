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
import { motion } from "framer-motion";
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
    <motion.footer
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="mx-3 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/20 bg-card/80 px-3 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-md"
    >
      <div className="hidden min-w-0 xl:block">
        <p className="font-display text-xs font-semibold tracking-wide text-glow">{statusText}</p>
        <p className="text-[10px] text-muted-foreground">Mesa híbrida</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <IconControl
          label={micOn ? "Desligar microfone" : "Ligar microfone"}
          tone={!micOn ? "danger" : "default"}
          onClick={onMic}
        >
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
        <IconControl label={handRaised ? "Abaixar mão" : "Levantar mão"} tone={handRaised ? "gold" : "default"} onClick={onHand}>
          <Hand />
        </IconControl>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full sm:size-9"
              aria-label="Reações"
              title="Reações"
            >
              <Smile />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" side="top">
            <p className="mb-3 font-display text-xs font-semibold tracking-wide text-accent">Reações</p>
            <div className="grid grid-cols-6 gap-1">
              {reactions.map((r) => (
                <motion.button
                  key={r.label}
                  type="button"
                  whileTap={{ scale: 1.4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  aria-label={r.label}
                  onClick={() => onReaction(r.emoji)}
                  className="flex size-9 items-center justify-center rounded-full text-xl transition-transform duration-150 hover:scale-125 hover:bg-secondary"
                >
                  {r.emoji}
                </motion.button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        size="sm"
        variant={live ? "destructive" : "gold"}
        disabled={connecting || (!onConnect && !live)}
        onClick={live ? onLeave : onConnect}
        className={cn("rounded-full px-4", live && "shadow-[0_0_16px_rgba(239,68,68,0.35)]")}
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
    </motion.footer>
  );
}

type Tone = "default" | "gold" | "danger";

function IconControl({
  label,
  children,
  onClick,
  active,
  tone = "default",
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  tone?: Tone;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "size-8 shrink-0 rounded-full sm:size-9",
            tone === "danger" &&
              "bg-destructive text-destructive-foreground shadow-[0_0_14px_rgba(239,68,68,0.35)] hover:bg-destructive/90 hover:text-destructive-foreground",
            tone === "gold" && "animate-glow-pulse bg-accent text-accent-foreground hover:bg-gold-bright hover:text-accent-foreground",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
