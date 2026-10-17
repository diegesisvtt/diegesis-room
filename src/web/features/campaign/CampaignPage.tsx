import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, Menu, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogOverlay, DialogPortal } from "@/web/components/ui/dialog";
import { useIsDesktop } from "@/web/lib/useMediaQuery";
import {
  clearSession,
  loadSession,
  peekProfileToken,
  saveSession,
  setProfileToken,
  type Session,
} from "@/web/lib/session";
import { api, type Campaign, type Channel, type VoiceParticipant } from "@/web/lib/api";
import { Button } from "@/web/components/ui/button";
import { EmberParticles } from "@/web/components/EmberParticles";
import { disconnect as disconnectVoice } from "@/web/features/meeting/voiceStore";
import { Sidebar } from "./Sidebar";
import type { CampaignContext } from "./types";

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [presence, setPresence] = useState<Record<string, VoiceParticipant[]>>({});
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Fecha o drawer mobile ao navegar (seleção de canal, membros, etc.).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  function updateSession(patch: Partial<Session>) {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      saveSession(next);
      return next;
    });
  }

  async function refresh() {
    const [camp, channelList, channelPresence] = await Promise.all([
      api.getCampaign(campaignId),
      api.listChannels(campaignId, peekProfileToken(campaignId)),
      api.listChannelPresence(campaignId, peekProfileToken(campaignId)),
    ]);
    setCampaign(camp);
    setChannels(channelList);
    setPresence(channelPresence);
  }

  useEffect(() => {
    if (!session || session.campaignId !== campaignId) {
      disconnectVoice();
      navigate("/");
      return;
    }
    void refresh().catch(() => navigate("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Atualiza periodicamente a presença nos canais de voz (quem está em cada mesa).
  useEffect(() => {
    if (!session) return;
    const poll = () => {
      void api
        .listChannelPresence(campaignId, peekProfileToken(campaignId))
        .then(setPresence)
        .catch(() => {
          // Falha de rede: mantém o último estado e tenta de novo no próximo intervalo.
        });
    };
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, session === null]);

  // Sincroniza status do perfil (aprovação/banimento acontecem no servidor).
  useEffect(() => {
    if (!session) return;
    const check = () => {
      void api
        .getProfile(campaignId, peekProfileToken(campaignId))
        .then(({ profile }) => {
          // Perfil nulo: expulso/rejeitado — encerra a sessão local.
          if (!profile) {
            disconnectVoice();
            clearSession();
            navigate("/");
            return;
          }
          setProfileToken(campaignId, profile.token);
          updateSession({ status: profile.status, role: profile.role });
        })
        .catch(() => {
          // Falha de rede: mantém e tenta de novo no próximo intervalo.
        });
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, session === null]);

  if (!campaign || !session) return null;

  if (session.status === "banned") {
    return <GateScene title="Acesso bloqueado" description="Você foi banido desta campanha." onLeave={() => { clearSession(); navigate("/"); }} />;
  }

  if (session.status === "pending") {
    return (
      <GateScene
        title="Aguardando aprovação"
        description={`O anfitrião de ${campaign.name} precisa aprovar sua entrada. Esta página atualiza sozinha.`}
        waiting
        onLeave={() => { clearSession(); navigate("/"); }}
      />
    );
  }

  const context: CampaignContext = { campaign, channels, presence, session, refresh, updateSession };

  return (
    <main className="flex h-dvh min-w-0 bg-background text-foreground">
      {isDesktop ? (
        <Sidebar context={context} />
      ) : (
        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-card outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=closed]:duration-200"
            >
              <DialogPrimitive.Title className="sr-only">
                Menu de {campaign.name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
              <Sidebar context={context} className="safe-top w-full flex-1 border-r-0" />
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      )}
      <section className="relative flex min-w-0 flex-1 flex-col">
        <div aria-hidden className="map-grid pointer-events-none absolute inset-0 opacity-25" />
        <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
        {!isDesktop && (
          <div className="safe-top relative z-20 flex h-12 shrink-0 items-center gap-1 border-b border-accent/10 bg-card/80 px-2 backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Abrir menu da campanha"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <span className="truncate font-display text-sm font-semibold text-gold-bright">
              {campaign.name}
            </span>
          </div>
        )}
        <Outlet context={context} />
      </section>
    </main>
  );
}

function GateScene({
  title,
  description,
  waiting,
  onLeave,
}: {
  title: string;
  description: string;
  waiting?: boolean;
  onLeave: () => void;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div aria-hidden className="map-grid absolute inset-0 opacity-40" />
      <EmberParticles count={22} />
      <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
      <div className="card-ornate relative z-10 w-full max-w-sm rounded-xl p-8 text-center">
        {waiting && <Loader2 className="mx-auto mb-4 size-8 animate-spin text-accent" />}
        <p className="font-display text-xl text-glow text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Button variant="ghost" className="mt-6 text-muted-foreground" onClick={onLeave}>
          Sair
        </Button>
      </div>
    </main>
  );
}
