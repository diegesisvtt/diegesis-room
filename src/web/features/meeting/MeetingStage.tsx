import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import { LayoutGroup, motion } from "framer-motion";
import { Expand, Focus, LayoutGrid } from "lucide-react";
import type { HostCamera, RoomStatus, RemoteGuest, Signal } from "./useLiveKitRoom";
import { VideoTile, type Tile } from "./VideoTile";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";

type Layout = "spotlight" | "gallery";

const tileTransition = { type: "spring", stiffness: 350, damping: 32 } as const;

export function MeetingStage({
  status,
  statusText,
  guests,
  hostCameras,
  localCameraTracks,
  localScreenTrack,
  sharing,
  signals,
  speakers,
  localIdentity,
  localName,
  isHost,
  spotlight,
  onSpotlightChange,
}: {
  status: RoomStatus;
  statusText: string;
  guests: RemoteGuest[];
  hostCameras: HostCamera[];
  localCameraTracks: Record<string, LocalVideoTrack>;
  localScreenTrack: Tile["track"];
  sharing: boolean;
  signals: Record<string, Signal>;
  speakers: string[];
  localIdentity: string;
  localName: string;
  isHost: boolean;
  spotlight: string | null;
  onSpotlightChange?: (tile: string | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>("spotlight");
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    if (spotlight) setPinned(spotlight);
  }, [spotlight]);

  const tiles = useMemo<Tile[]>(() => {
    const localTiles: Tile[] = isHost
      ? hostCameras.map((cam) => ({
          identity: `cam:${cam.id}`,
          name: cam.name,
          track: localCameraTracks[cam.id] ?? null,
          camera: true,
          local: true,
        }))
      : [{ identity: "local", name: localName, track: Object.values(localCameraTracks)[0] ?? null, local: true }];
    const guestTiles: Tile[] = guests.flatMap((g): Tile[] =>
      g.isHost && g.cameras.length > 0
        ? g.cameras.map((c) => ({ identity: `cam:${c.id}`, name: c.name, track: c.track, camera: true }))
        : [{ identity: g.identity, name: g.name, track: g.cameraTrack, color: pickColor(g.identity) }],
    );
    const screenTiles: Tile[] = guests
      .filter((g) => g.screenTrack)
      .map((g) => ({ identity: `screen:${g.identity}`, name: `${g.name} · Tela`, track: g.screenTrack, screen: true }));
    const localScreenTile: Tile | null = sharing
      ? { identity: `screen:${localIdentity}`, name: "Sua tela", track: localScreenTrack, screen: true, local: true }
      : null;

    return [...localTiles, ...guestTiles, ...screenTiles, ...(localScreenTile ? [localScreenTile] : [])];
  }, [guests, hostCameras, localCameraTracks, localScreenTrack, sharing, isHost, localName, localIdentity]);

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
    if (tile.local || tile.camera || tile.screen) return false;
    if (!live) return false;
    return speakers.includes(tile.identity);
  }

  return (
    <div ref={stageRef} className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", live ? "bg-success" : "bg-warning")} />
            {statusText}
            {sharing && <span className="text-success"> · Tela compartilhada</span>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant={layout === "spotlight" ? "secondary" : "ghost"} size="sm" onClick={() => setLayout("spotlight")}>
              <Focus className="size-4" /> Destaque
            </Button>
            <Button variant={layout === "gallery" ? "secondary" : "ghost"} size="sm" onClick={() => setLayout("gallery")}>
              <LayoutGrid className="size-4" /> Galeria
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Tela cheia" onClick={() => void fullscreen()}>
              <Expand className="size-4" />
            </Button>
          </div>
        </div>

        <LayoutGroup>
        <div
          className={cn(
            "min-h-0 flex-1 gap-3 overflow-auto p-3 pt-1",
            layout === "gallery" ? "grid grid-cols-1 auto-rows-fr sm:grid-cols-2" : "flex",
          )}
        >
          {layout === "gallery" ? (
            tiles.map((tile) => (
              <motion.div key={tile.identity} layout transition={tileTransition} className="flex min-h-0">
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
            ))
          ) : (
            <>
              {focused && (
                <motion.div
                  key={focused.identity}
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
              )}
              <aside className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto sm:w-36 lg:w-44" aria-label="Vídeos dos participantes">
                {tiles
                  .filter((t) => t.identity !== focused?.identity)
                  .map((tile) => (
                    <motion.div key={tile.identity} layoutId={tile.identity} transition={tileTransition} className="shrink-0">
                      <VideoTile
                        tile={tile}
                        signal={signalFor(tile)}
                        speaking={speakingFor(tile)}
                        pinned={false}
                        onPin={() => pin(tile)}
                        onExpand={() => void fullscreen()}
                      />
                    </motion.div>
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
