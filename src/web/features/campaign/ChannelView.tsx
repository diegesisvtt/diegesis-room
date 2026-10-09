import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { Hash, MonitorUp, Video } from "lucide-react";
import type { CampaignContext } from "./types";
import { ChannelChat } from "@/web/features/chat/ChannelChat";
import { VoiceStage } from "@/web/features/meeting/VoiceStage";
import { PresenceStack } from "@/web/components/PresenceStack";
import { Button } from "@/web/components/ui/button";
import { cn } from "@/web/lib/utils";

export function ChannelView() {
  const { channelId = "", "*": suffix = "" } = useParams();
  const context = useOutletContext<CampaignContext>();
  const navigate = useNavigate();
  const channel = context.channels.find((c) => c.id === channelId);
  const inVoice = suffix === "voice";

  function enterVoice() {
    navigate(`/campaign/${context.campaign.id}/channel/${channelId}/voice`, { replace: true });
  }

  function leaveVoice() {
    navigate(`/campaign/${context.campaign.id}/channel/${channelId}`, { replace: true });
  }

  if (!channel) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Canal não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" key={channel.id}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-accent/10 bg-card/80 px-4 backdrop-blur">
        <Hash className="size-4 text-accent" />
        <div className="min-w-0 flex-1">
          <h1 className="text-glow truncate font-display text-sm font-semibold text-gold-bright sm:text-base">{channel.name}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">Chat persistente e mesa de voz</p>
        </div>
        <PresenceStack
          participants={context.presence[channel.id] ?? []}
          size="size-7"
          textClass="text-[10px]"
          ringClass="ring-card"
        />
        {!inVoice && (
          <Button variant="gold" size="sm" onClick={enterVoice}>
            <Video className="size-4" /> Entrar na sala de voz
          </Button>
        )}
        <Button
          variant="outline-gold"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => window.open(`/stream/${channel.id}`, "mesa-stream", "popup,width=1280,height=720")}
        >
          <MonitorUp className="size-4" /> Abrir modo streaming
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {inVoice && (
          <div className="flex min-h-[40dvh] flex-1 flex-col lg:min-h-0">
            <VoiceStage channelId={channel.id} channelName={channel.name} session={context.session} onLeave={leaveVoice} />
          </div>
        )}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            inVoice && "border-t border-border lg:w-80 lg:flex-none lg:border-l lg:border-t-0 xl:w-96",
          )}
        >
          <ChannelChat channelId={channel.id} />
        </div>
      </div>
    </div>
  );
}
