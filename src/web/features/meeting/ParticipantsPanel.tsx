import { Hand, MicOff, Shield, Users, X } from "lucide-react";
import type { RoomStatus, RemoteGuest, Signal } from "./useLiveKitRoom";
import { Button } from "@/web/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/web/components/ui/dialog";

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
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" /> Participantes
          </DialogTitle>
          <DialogDescription>{live ? "Jogadores conectados à mesa" : "Gestão da sala"}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Shield className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{localName}</p>
            <p className="text-xs text-muted-foreground">{isHost ? "Anfitrião" : "Você"}</p>
          </div>
        </div>

        {guests.map((guest) => (
          <div key={guest.identity} className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
              {guest.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{guest.name}</p>
              {signals[guest.identity]?.hand && <p className="text-xs text-warning">Mão levantada</p>}
            </div>
            {signals[guest.identity]?.hand && <Hand className="size-4 text-warning" />}
            {isHost && live && (
              <>
                <IconControl label={`Silenciar ${guest.name}`} onClick={() => onMute(guest.identity, true)}>
                  <MicOff className="size-4" />
                </IconControl>
                <IconControl label={`Remover ${guest.name}`} onClick={() => onRemove(guest.identity)}>
                  <X className="size-4" />
                </IconControl>
              </>
            )}
          </div>
        ))}
        {guests.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum jogador remoto conectado.</p>}
      </DialogContent>
    </Dialog>
  );
}

function IconControl({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={label} onClick={onClick}>
      {children}
    </Button>
  );
}
