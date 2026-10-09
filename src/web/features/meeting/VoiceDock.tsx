import { useLocation, useNavigate } from "react-router-dom";
import { Camera, CameraOff, Hash, Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { useVoiceRoom, disconnect, toggleCamera, toggleMic } from "./voiceStore";
import { Button } from "@/web/components/ui/button";
import { cn } from "@/web/lib/utils";

function useLeave() {
  const navigate = useNavigate();
  const voice = useVoiceRoom();
  return () => {
    const campaignId = voice.activeCampaignId;
    const channelId = voice.activeChannelId;
    disconnect();
    if (campaignId && channelId) {
      navigate(`/campaign/${campaignId}/channel/${channelId}`, { replace: true });
    }
  };
}

function statusLabel(status: "idle" | "connecting" | "live" | "error") {
  switch (status) {
    case "live":
      return { label: "Voz conectada", live: true };
    case "connecting":
      return { label: "Conectando…", live: false };
    default:
      return { label: "Erro de conexão", live: false };
  }
}

/**
 * Painel de voz persistente (estilo Discord), renderizado na Sidebar acima do
 * botão do usuário. Some automaticamente quando não há conexão ativa.
 */
export function VoiceDock() {
  const voice = useVoiceRoom();
  const navigate = useNavigate();
  const leave = useLeave();

  if (!voice.activeChannelId) return null;

  const status = statusLabel(voice.status);

  function open() {
    const campaignId = voice.activeCampaignId;
    const channelId = voice.activeChannelId;
    if (campaignId && channelId) {
      navigate(`/campaign/${campaignId}/channel/${channelId}/voice`);
    }
  }

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-accent/25 bg-secondary/60 shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-accent/10"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/15">
          <Hash className="size-4 text-accent" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{voice.channelName || "Mesa de voz"}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {status.live ? (
              <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
            ) : voice.status === "connecting" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : null}
            {status.label}
          </span>
        </span>
      </button>

      <div className="flex items-center justify-center gap-1.5 border-t border-accent/10 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 rounded-full",
            !voice.micOn && "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground",
          )}
          aria-label={voice.micOn ? "Desligar microfone" : "Ligar microfone"}
          onClick={() => void toggleMic()}
        >
          {voice.micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </Button>
        {voice.role !== "host" && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8 rounded-full", voice.cameraOn && "bg-accent text-accent-foreground hover:bg-accent/90")}
            aria-label={voice.cameraOn ? "Desligar câmera" : "Ligar câmera"}
            onClick={() => void toggleCamera()}
          >
            {voice.cameraOn ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-danger hover:bg-danger/15 hover:text-danger"
          aria-label="Sair da sala de voz"
          onClick={leave}
        >
          <PhoneOff className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Versão flutuante exibida fora das rotas de campanha (ex.: /settings), onde a
 * Sidebar não está presente. Mantém microfone/câmera/sair acessíveis.
 */
export function FloatingVoiceDock() {
  const voice = useVoiceRoom();
  const navigate = useNavigate();
  const location = useLocation();
  const leave = useLeave();

  if (!voice.activeChannelId) return null;
  if (location.pathname.startsWith("/campaign/")) return null;
  if (location.pathname.startsWith("/stream/")) return null;

  const status = statusLabel(voice.status);

  function open() {
    const campaignId = voice.activeCampaignId;
    const channelId = voice.activeChannelId;
    if (campaignId && channelId) {
      navigate(`/campaign/${campaignId}/channel/${channelId}/voice`);
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-accent/30 bg-card/90 py-2 pl-3 pr-2 shadow-[var(--shadow-card)] backdrop-blur-md">
      <button type="button" onClick={open} className="flex items-center gap-2">
        <span className="relative flex size-8 items-center justify-center rounded-full bg-accent/15">
          <Hash className="size-4 text-accent" />
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 animate-pulse-dot rounded-full border-2 border-card bg-success" />
        </span>
        <span className="hidden max-w-44 sm:block">
          <span className="block truncate text-sm font-medium">{voice.channelName || "Mesa de voz"}</span>
          <span className="block text-[11px] text-muted-foreground">{status.label}</span>
        </span>
      </button>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 rounded-full",
            !voice.micOn && "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground",
          )}
          aria-label={voice.micOn ? "Desligar microfone" : "Ligar microfone"}
          onClick={() => void toggleMic()}
        >
          {voice.micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-danger hover:bg-danger/15 hover:text-danger"
          aria-label="Sair da sala de voz"
          onClick={leave}
        >
          <PhoneOff className="size-4" />
        </Button>
      </div>
    </div>
  );
}
