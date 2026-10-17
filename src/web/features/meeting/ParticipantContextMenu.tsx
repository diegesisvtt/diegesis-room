import { Mic, MicOff, MoreVertical, UserX, Video, VideoOff, Volume2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/web/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/web/components/ui/dropdown-menu";
import { Slider } from "@/web/components/ui/slider";

export type ParticipantMenuProps = {
  name: string;
  onToggleOwnCamera?: () => void;
  cameraOn?: boolean;
  onVolumeChange?: (v: number) => void;
  volume?: number;
  remoteMuted?: boolean;
  onMuteRemote?: () => void;
  onRemoveRemote?: () => void;
};

type MenuComponents = {
  Item: typeof ContextMenuItem;
  Label: typeof ContextMenuLabel;
  Separator: typeof ContextMenuSeparator;
};

function MenuBody({
  name,
  onToggleOwnCamera,
  cameraOn,
  onVolumeChange,
  volume,
  remoteMuted,
  onMuteRemote,
  onRemoveRemote,
  C,
}: ParticipantMenuProps & { C: MenuComponents }) {
  const hasActions =
    onToggleOwnCamera || onVolumeChange !== undefined || onMuteRemote || onRemoveRemote;

  return (
    <>
      <C.Label className="truncate font-display text-xs tracking-wide text-accent">{name}</C.Label>
      {!hasActions && <C.Item disabled>Sem ações</C.Item>}

      {onToggleOwnCamera && (
        <C.Item onSelect={() => onToggleOwnCamera()}>
          {cameraOn ? <VideoOff className="size-4" /> : <Video className="size-4" />}
          {cameraOn ? "Desligar câmera" : "Ligar câmera"}
        </C.Item>
      )}

      {onVolumeChange !== undefined && (
        <>
          <C.Separator />
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
        <C.Item onSelect={() => onMuteRemote()}>
          {remoteMuted ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          {remoteMuted ? "Desilenciar" : "Silenciar"}
        </C.Item>
      )}

      {onRemoveRemote && (
        <C.Item className="text-danger focus:text-danger" onSelect={() => onRemoveRemote()}>
          <UserX className="size-4" />
          Remover da mesa
        </C.Item>
      )}
    </>
  );
}

const contextComponents: MenuComponents = {
  Item: ContextMenuItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator,
};

const dropdownComponents: MenuComponents = {
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
};

/**
 * Menu contextual (clique direito) sobre um tile de participante, com opções
 * no estilo Discord: volume individual, alternar câmera própria, silenciar e
 * remover (apenas para o host).
 */
export function ParticipantContextMenu({
  children,
  ...menu
}: ParticipantMenuProps & { children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <MenuBody {...menu} C={contextComponents} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Alternativa touch ao clique direito: botão "⋯" que abre as mesmas ações em
 * um dropdown. Renderizado dentro dos controles do VideoTile.
 */
export function ParticipantDropdownMenu(menu: ParticipantMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ações de ${menu.name}`}
          className="flex size-10 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent/15 hover:text-accent sm:size-7"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-60">
        <MenuBody {...menu} C={dropdownComponents} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
