import { useEffect, useRef } from "react";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Expand, Hand, MonitorUp, Pin, PinOff, VideoOff, Volume2 } from "lucide-react";
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
  isHost?: boolean;
  color?: string;
};

const entrance = { type: "spring", stiffness: 260, damping: 25 } as const;

// Tiles remount when the stage switches gallery/spotlight/pin. Track which
// tiles already played their entrance so it doesn't replay on every remount.
const seenTiles = new Set<string>();

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
  const tileKey = `${tile.identity}:${tile.screen ? "screen" : tile.camera ? "cam" : "avatar"}:${tile.track?.sid ?? "none"}`;
  const skipEntrance = useRef(seenTiles.has(tileKey));

  useEffect(() => {
    seenTiles.add(tileKey);
  }, [tileKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !tile.track) return;
    tile.track.attach(el);
    return () => {
      tile.track?.detach(el);
    };
  }, [tile.track]);

  return (
    <motion.article
      initial={skipEntrance.current ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={entrance}
      className={cn(
        "group relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-accent/15 bg-secondary shadow-[var(--shadow-card)]",
        large ? "min-h-48 flex-1" : "aspect-video shrink-0",
        speaking && "voice-active",
      )}
      aria-label={tile.name}
    >
      {speaking && (
        <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-xl shadow-[inset_0_0_28px_color-mix(in_oklab,var(--color-success)_30%,transparent)]" />
      )}
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
              "flex items-center justify-center rounded-full font-bold text-primary-foreground shadow-[var(--shadow-glow-violet)]",
              large ? "size-20 text-2xl" : "size-9 text-xs",
              tile.color || "bg-primary",
            )}
          >
            {tile.screen ? <MonitorUp /> : initials(tile.name)}
          </div>
        </div>
      )}

      <div className="absolute right-1.5 top-1.5 z-20 flex gap-1 rounded-lg border border-accent/20 bg-background/80 p-0.5 opacity-100 backdrop-blur-sm transition-all duration-200 sm:scale-90 sm:opacity-0 sm:group-focus-within:scale-100 sm:group-focus-within:opacity-100 sm:group-hover:scale-100 sm:group-hover:opacity-100">
        <IconButton label={pinned ? `Desafixar ${tile.name}` : `Fixar ${tile.name}`} onClick={onPin}>
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </IconButton>
        {large && onExpand && (
          <IconButton label={`Ampliar ${tile.name}`} onClick={onExpand}>
            <Expand className="size-4" />
          </IconButton>
        )}
      </div>

      <AnimatePresence>
        {signal?.reaction && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" role="status">
            <motion.span
              key={`${signal.reaction}-${signal.expires ?? 0}`}
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -60, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="text-5xl drop-shadow-[0_0_16px_color-mix(in_oklab,var(--color-accent)_60%,transparent)]"
            >
              {signal.reaction}
            </motion.span>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-1.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2.5 pb-1.5 pt-5">
        {tile.isHost && <Crown className="size-3.5 shrink-0 text-accent drop-shadow-[0_0_6px_color-mix(in_oklab,var(--color-accent)_70%,transparent)]" aria-label="Anfitrião" />}
        <span className={cn("min-w-0 flex-1 truncate font-medium", large ? "text-xs sm:text-sm" : "text-[10px]")}>
          {tile.name}
        </span>
        {signal?.hand && <Hand className="size-4 shrink-0 animate-pulse-dot text-accent" aria-label="Mão levantada" />}
        {speaking && <Volume2 className="size-3 shrink-0 animate-pulse text-success" />}
      </div>
    </motion.article>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 rounded-md hover:text-accent" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
