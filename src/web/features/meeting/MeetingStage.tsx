import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import { LayoutGroup, motion } from "framer-motion";
import { Expand, Focus, LayoutGrid } from "lucide-react";
import type { HostCamera, RoomStatus, RemoteGuest, Signal } from "./useLiveKitRoom";
import { VideoTile, type Tile } from "./VideoTile";
import { ParticipantContextMenu } from "./ParticipantContextMenu";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";

type Layout = "spotlight" | "gallery";

const tileTransition = { type: "spring", stiffness: 320, damping: 30 } as const;

export function MeetingStage({
  status,
  statusText,
  guests,
  hostCameras,
  localCameraTracks,
  personalCameraTrack,
  localScreenTrack,
  sharing,
  signals,
  speakers,
  localIdentity,
  localName,
  localPhotoUrl,
  isHost,
  spotlight,
  onSpotlightChange,
  onToggleHostCamera,
  onTogglePersonalCamera,
  onSetVolume,
  volumes,
  onMute,
  onRemove,
}: {
  status: RoomStatus;
  statusText: string;
  guests: RemoteGuest[];
  hostCameras: HostCamera[];
  localCameraTracks: Record<string, LocalVideoTrack>;
  personalCameraTrack: LocalVideoTrack | null;
  localScreenTrack: Tile["track"];
  sharing: boolean;
  signals: Record<string, Signal>;
  speakers: string[];
  localIdentity: string;
  localName: string;
  localPhotoUrl?: string | null;
  isHost: boolean;
  spotlight: string | null;
  onSpotlightChange?: (tile: string | null) => void;
  onToggleHostCamera: (id: string) => void;
  onTogglePersonalCamera: () => void;
  onSetVolume: (identity: string, volume: number) => void;
  volumes: Record<string, number>;
  onMute: (identity: string, muted: boolean) => void;
  onRemove: (identity: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>("spotlight");
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    if (spotlight) setPinned(spotlight);
  }, [spotlight]);

  const tiles = useMemo<Tile[]>(() => {
    // Câmera pessoal (host e guest): mostra o avatar/foto quando desligada.
    const personalTile: Tile = {
      identity: "local",
      name: localName,
      track: personalCameraTrack,
      local: true,
      photoUrl: localPhotoUrl,
      speakerIdentity: localIdentity,
    };
    const localTiles: Tile[] = isHost
      ? [
          personalTile,
          ...hostCameras.map((cam) => ({
            identity: `cam:${cam.id}`,
            name: cam.name,
            track: localCameraTracks[cam.id] ?? null,
            camera: true,
            local: true,
            isHost: true,
            speakerIdentity: localIdentity,
            cameraId: cam.id,
          })),
        ]
      : [personalTile];
    const guestTiles: Tile[] = guests.flatMap((g): Tile[] =>
      g.isHost && g.cameras.length > 0
        ? g.cameras.map((c) => ({ identity: `cam:${c.id}`, name: c.name, track: c.track, camera: true, isHost: true, speakerIdentity: g.identity, cameraId: c.id }))
        : [{ identity: g.identity, name: g.name, track: g.cameraTrack, isHost: g.isHost, photoUrl: g.photoUrl, color: pickColor(g.identity) }],
    );
    const screenTiles: Tile[] = guests
      .filter((g) => g.screenTrack)
      .map((g) => ({ identity: `screen:${g.identity}`, name: `${g.name} · Tela`, track: g.screenTrack, screen: true }));
    const localScreenTile: Tile | null = sharing
      ? { identity: `screen:${localIdentity}`, name: "Sua tela", track: localScreenTrack, screen: true, local: true }
      : null;

    return [...localTiles, ...guestTiles, ...screenTiles, ...(localScreenTile ? [localScreenTile] : [])];
  }, [guests, hostCameras, localCameraTracks, personalCameraTrack, localScreenTrack, sharing, isHost, localName, localPhotoUrl, localIdentity]);

  const focused = tiles.find((t) => t.identity === pinned) ?? tiles.find((t) => t.camera) ?? tiles[0];

  const live = status === "live";

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      /* ignore */
    }
  }

  function pin(tile: Tile | null) {
    setPinned(tile?.identity ?? null);
    if (tile) setLayout("spotlight");
    if (isHost) onSpotlightChange?.(tile?.identity ?? null);
  }

  function signalFor(tile: Tile): Signal | undefined {
    return signals[tile.local ? localIdentity : tile.identity];
  }

  function speakingFor(tile: Tile): boolean {
    if (tile.screen) return false;
    if (!live) return false;
    return speakers.includes(tile.speakerIdentity ?? tile.identity);
  }

  function menuFor(tile: Tile) {
    if (tile.screen) return { name: tile.name };
    if (tile.local) {
      return {
        name: tile.name,
        onToggleOwnCamera: tile.camera
          ? () => onToggleHostCamera(tile.cameraId ?? "")
          : onTogglePersonalCamera,
        cameraOn: tile.camera
          ? (hostCameras.find((c) => c.id === tile.cameraId)?.enabled ?? false)
          : Boolean(personalCameraTrack),
      };
    }
    const identity = tile.speakerIdentity ?? tile.identity;
    const guest = guests.find((g) => g.identity === identity);
    const muted = guest?.micMuted ?? false;
    return {
      name: tile.name,
      onVolumeChange: (v: number) => onSetVolume(identity, v),
      volume: volumes[identity] ?? 1,
      remoteMuted: muted,
      onMuteRemote: isHost ? () => onMute(identity, !muted) : undefined,
      onRemoveRemote: isHost ? () => onRemove(identity) : undefined,
    };
  }

  return (
    <div ref={stageRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="map-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
      />
      <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-accent/5"
      />

      <div className="relative z-10 flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              live ? "animate-pulse-dot bg-success shadow-[0_0_8px_color-mix(in_oklab,var(--color-success)_70%,transparent)]" : "bg-warning",
            )}
          />
          <span className="font-display tracking-wide">{statusText}</span>
          {sharing && <span className="text-success"> · Tela compartilhada</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={layout === "spotlight" ? "secondary" : "ghost"}
            size="sm"
            className={cn(layout === "spotlight" && "shadow-[var(--shadow-glow-violet)]")}
            onClick={() => setLayout("spotlight")}
          >
            <Focus className="size-4" /> Destaque
          </Button>
          <Button
            variant={layout === "gallery" ? "secondary" : "ghost"}
            size="sm"
            className={cn(layout === "gallery" && "shadow-[var(--shadow-glow-violet)]")}
            onClick={() => setLayout("gallery")}
          >
            <LayoutGrid className="size-4" /> Galeria
          </Button>
          <Button variant="ghost" size="icon" className="size-8 hover:text-accent" aria-label="Tela cheia" onClick={() => void fullscreen()}>
            <Expand className="size-4" />
          </Button>
        </div>
      </div>

      <LayoutGroup>
        <div
          className={cn(
            "relative z-10 min-h-0 flex-1 gap-3 overflow-auto p-3 pt-1",
            layout === "gallery" ? "grid grid-cols-1 auto-rows-fr sm:grid-cols-2" : "flex",
          )}
        >
          {layout === "gallery" ? (
            tiles.map((tile) => (
              <ParticipantContextMenu key={tile.identity} {...menuFor(tile)}>
                <motion.div layout transition={tileTransition} className="flex min-h-0">
                  <VideoTile
                    tile={tile}
                    signal={signalFor(tile)}
                    speaking={speakingFor(tile)}
                    pinned={pinned === tile.identity}
                    onPin={() => pin(tile)}
                    onExpand={() => void fullscreen()}
                    large
                  />
                </motion.div>
              </ParticipantContextMenu>
            ))
          ) : (
            <>
              {focused && (
                <ParticipantContextMenu key={focused.identity} {...menuFor(focused)}>
                  <motion.div
                    layoutId={focused.identity}
                    transition={tileTransition}
                    className="flex min-h-0 min-w-0 flex-1"
                  >
                    <VideoTile
                      tile={focused}
                      signal={signalFor(focused)}
                      speaking={speakingFor(focused)}
                      pinned
                      onPin={() => pin(null)}
                      onExpand={() => void fullscreen()}
                      large
                    />
                  </motion.div>
                </ParticipantContextMenu>
              )}
              <aside
                className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto sm:w-36 lg:w-44"
                aria-label="Vídeos dos participantes"
              >
                {tiles
                  .filter((t) => t.identity !== focused?.identity)
                  .map((tile) => (
                    <ParticipantContextMenu key={tile.identity} {...menuFor(tile)}>
                      <motion.div layoutId={tile.identity} transition={tileTransition} className="shrink-0">
                        <VideoTile
                          tile={tile}
                          signal={signalFor(tile)}
                          speaking={speakingFor(tile)}
                          pinned={false}
                          onPin={() => pin(tile)}
                          onExpand={() => void fullscreen()}
                        />
                      </motion.div>
                    </ParticipantContextMenu>
                  ))}
              </aside>
            </>
          )}
        </div>
      </LayoutGroup>
    </div>
  );
}

const palette = ["bg-warning", "bg-accent", "bg-primary", "bg-success", "bg-danger"];
function pickColor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length]!;
}
