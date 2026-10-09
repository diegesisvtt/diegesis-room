import { Mic, MicOff, UserX, Video, VideoOff, Volume2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/web/components/ui/context-menu";
import { Slider } from "@/web/components/ui/slider";

/**
 * Menu contextual (clique direito) sobre um tile de participante, com opções
 * no estilo Discord: volume individual, alternar câmera própria, silenciar e
 * remover (apenas para o host).
 */
export function ParticipantContextMenu({
  children,
  name,
  onToggleOwnCamera,
  cameraOn,
  onVolumeChange,
  volume,
  remoteMuted,
  onMuteRemote,
  onRemoveRemote,
}: {
  children: React.ReactNode;
  name: string;
  onToggleOwnCamera?: () => void;
  cameraOn?: boolean;
  onVolumeChange?: (v: number) => void;
  volume?: number;
  remoteMuted?: boolean;
  onMuteRemote?: () => void;
  onRemoveRemote?: () => void;
}) {
  const hasActions =
    onToggleOwnCamera || onVolumeChange !== undefined || onMuteRemote || onRemoveRemote;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuLabel className="truncate font-display text-xs tracking-wide text-accent">{name}</ContextMenuLabel>
        {!hasActions && <ContextMenuItem disabled>Sem ações</ContextMenuItem>}

        {onToggleOwnCamera && (
          <ContextMenuItem onSelect={() => onToggleOwnCamera()}>
            {cameraOn ? <VideoOff className="size-4" /> : <Video className="size-4" />}
            {cameraOn ? "Desligar câmera" : "Ligar câmera"}
          </ContextMenuItem>
        )}

        {onVolumeChange !== undefined && (
          <>
            <ContextMenuSeparator />
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Volume2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="w-12 shrink-0 text-xs text-muted-foreground">Volume</span>
              <Slider
                className="flex-1"
                value={[Math.round((volume ?? 1) * 100)]}
                max={100}
                step={1}
                aria-label={`Volume de ${name}`}
                onValueChange={(val) => {
                  const v = val[0];
                  if (v !== undefined) onVolumeChange(v / 100);
                }}
              />
            </div>
          </>
        )}

        {onMuteRemote && (
          <ContextMenuItem onSelect={() => onMuteRemote()}>
            {remoteMuted ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            {remoteMuted ? "Desilenciar" : "Silenciar"}
          </ContextMenuItem>
        )}

        {onRemoveRemote && (
          <ContextMenuItem className="text-danger focus:text-danger" onSelect={() => onRemoveRemote()}>
            <UserX className="size-4" />
            Remover da mesa
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
