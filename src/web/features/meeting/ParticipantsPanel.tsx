import { Crown, Hand, MicOff, Users, X } from "lucide-react";
import { motion } from "framer-motion";
import type { RoomStatus, RemoteGuest, Signal } from "./useLiveKitRoom";
import { Button } from "@/web/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/web/components/ui/dialog";

const list = {
  show: { transition: { staggerChildren: 0.05 } },
};
const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
} as const;

export function ParticipantsPanel({
  open,
  onOpenChange,
  isHost,
  status,
  guests,
  localName,
  signals,
  onMute,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isHost: boolean;
  status: RoomStatus;
  guests: RemoteGuest[];
  localName: string;
  signals: Record<string, Signal>;
  onMute: (identity: string, muted: boolean) => void;
  onRemove: (identity: string) => void;
}) {
  const live = status === "live";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wide">
            <Users className="size-5 text-accent" /> Participantes
          </DialogTitle>
          <DialogDescription>{live ? "Jogadores conectados à mesa" : "Gestão da sala"}</DialogDescription>
        </DialogHeader>

        <motion.div variants={list} initial="hidden" animate="show" className="space-y-2">
          <motion.div variants={row} className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 p-2.5">
            <Crown className="size-5 shrink-0 text-accent drop-shadow-[0_0_6px_color-mix(in_oklab,var(--color-accent)_60%,transparent)]" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{localName}</p>
              <p className="text-xs text-muted-foreground">{isHost ? "Anfitrião" : "Você"}</p>
            </div>
          </motion.div>

          {guests.map((guest) => (
            <motion.div
              key={guest.identity}
              variants={row}
              className="flex items-center gap-2 rounded-lg border border-transparent p-1.5 transition-colors hover:border-accent/15 hover:bg-secondary/60"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold shadow-[var(--shadow-glow-violet)]">
                {guest.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {guest.isHost && <Crown className="size-3.5 shrink-0 text-accent" aria-label="Anfitrião" />}
                  <span className="truncate">{guest.name}</span>
                </p>
                {signals[guest.identity]?.hand && (
                  <p className="flex items-center gap-1 text-xs text-accent">
                    <Hand className="size-3 animate-pulse-dot" /> Mão levantada
                  </p>
                )}
              </div>
              {isHost && live && (
                <>
                  <IconControl label={`Silenciar ${guest.name}`} onClick={() => onMute(guest.identity, true)}>
                    <MicOff className="size-4" />
                  </IconControl>
                  <IconControl label={`Remover ${guest.name}`} danger onClick={() => onRemove(guest.identity)}>
                    <X className="size-4" />
                  </IconControl>
                </>
              )}
            </motion.div>
          ))}
        </motion.div>
        {guests.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum jogador remoto conectado.</p>}
      </DialogContent>
    </Dialog>
  );
}

function IconControl({
  label,
  children,
  onClick,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={
        danger
          ? "size-8 shrink-0 rounded-full hover:text-danger hover:shadow-[0_0_12px_rgba(239,68,68,0.35)]"
          : "size-8 shrink-0 rounded-full hover:text-accent hover:shadow-[var(--shadow-glow-gold)]"
      }
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
