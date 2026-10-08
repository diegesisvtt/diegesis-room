import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  clearSession,
  loadSession,
  peekProfileToken,
  saveSession,
  setProfileToken,
  type Session,
} from "@/web/lib/session";
import { api, type Campaign, type Channel } from "@/web/lib/api";
import { Button } from "@/web/components/ui/button";
import { EmberParticles } from "@/web/components/EmberParticles";
import { Sidebar } from "./Sidebar";
import type { CampaignContext } from "./types";

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [session, setSession] = useState<Session | null>(() => loadSession());

  function updateSession(patch: Partial<Session>) {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      saveSession(next);
      return next;
    });
  }

  async function refresh() {
    const [camp, channelList] = await Promise.all([
      api.getCampaign(campaignId),
      api.listChannels(campaignId, peekProfileToken(campaignId)),
    ]);
    setCampaign(camp);
    setChannels(channelList);
  }

  useEffect(() => {
    if (!session || session.campaignId !== campaignId) {
      navigate("/");
      return;
    }
    void refresh().catch(() => navigate("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Sincroniza status do perfil (aprovação/banimento acontecem no servidor).
  useEffect(() => {
    if (!session) return;
    const check = () => {
      void api
        .getProfile(campaignId, peekProfileToken(campaignId))
        .then((profile) => {
          setProfileToken(campaignId, profile.token);
          updateSession({ status: profile.status, role: profile.role });
        })
        .catch(() => {
          // 404: perfil expulso/rejeitado — encerra a sessão local.
          clearSession();
          navigate("/");
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

  const context: CampaignContext = { campaign, channels, session, refresh, updateSession };

  return (
    <main className="flex h-dvh min-w-0 bg-background text-foreground">
      <Sidebar context={context} />
      <section className="relative flex min-w-0 flex-1 flex-col">
        <div aria-hidden className="map-grid pointer-events-none absolute inset-0 opacity-25" />
        <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
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
