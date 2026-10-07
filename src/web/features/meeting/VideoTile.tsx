import { useEffect, useRef } from "react";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { Expand, Hand, MonitorUp, Pin, PinOff, VideoOff, Volume2 } from "lucide-react";
import type { Signal } from "./useLiveKitRoom";
import { cn, initials } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/web/components/ui/tooltip";

export type Tile = {
  identity: string;
  name: string;
  track: LocalVideoTrack | RemoteVideoTrack | null;
  camera?: boolean;
  local?: boolean;
  screen?: boolean;
  color?: string;
};

export function VideoTile({
  tile,
  signal,
  speaking,
  pinned,
  onPin,
  onExpand,
  large,
}: {
  tile: Tile;
  signal?: Signal;
  speaking?: boolean;
  pinned: boolean;
  onPin: () => void;
  onExpand?: () => void;
  large?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !tile.track) return;
    tile.track.attach(el);
    return () => {
      tile.track?.detach(el);
    };
  }, [tile.track]);

  return (
    <article
      className={cn(
        "group relative min-h-0 min-w-0 overflow-hidden rounded-md border bg-secondary",
        large ? "min-h-48 flex-1" : "aspect-video shrink-0",
        speaking ? "border-success" : "border-border",
      )}
      aria-label={tile.name}
    >
      {tile.track ? (
        <video ref={ref} autoPlay playsInline muted className="h-full w-full object-contain" />
      ) : tile.camera ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-muted">
          <VideoOff className="size-10 text-muted-foreground" />
          <span className="mt-2 text-xs text-muted-foreground">Câmera desligada</span>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-bold text-primary-foreground",
              large ? "size-20 text-2xl" : "size-9 text-xs",
              tile.color || "bg-primary",
            )}
          >
            {tile.screen ? <MonitorUp /> : initials(tile.name)}
          </div>
        </div>
      )}

      <div className="absolute right-1 top-1 flex gap-0.5 rounded-md bg-background/80 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <IconButton label={pinned ? `Desafixar ${tile.name}` : `Fixar ${tile.name}`} onClick={onPin}>
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </IconButton>
        {large && onExpand && (
          <IconButton label={`Ampliar ${tile.name}`} onClick={onExpand}>
            <Expand className="size-4" />
          </IconButton>
        )}
      </div>

      {signal?.reaction && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl" role="status">
          {signal.reaction}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-background/80 px-2 py-1.5">
        <span className={cn("min-w-0 flex-1 truncate font-medium", large ? "text-xs sm:text-sm" : "text-[10px]")}>
          {tile.name}
        </span>
        {signal?.hand && <Hand className="size-4 shrink-0 text-warning" />}
        {speaking && <Volume2 className="size-3 shrink-0 text-success" />}
      </div>
    </article>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
