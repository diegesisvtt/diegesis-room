import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams, NavLink } from "react-router-dom";
import { loadSession, saveSession, type Session } from "@/web/lib/session";
import { api, type Campaign, type Channel } from "@/web/lib/api";
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
      api.listChannels(campaignId),
    ]);
    setCampaign(camp);
    setChannels(channelList);
  }

  useEffect(() => {
    if (!session) {
      navigate("/");
      return;
    }
    void refresh().catch(() => navigate("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  if (!campaign || !session) return null;

  const context: CampaignContext = { campaign, channels, session, refresh, updateSession };

  return (
    <main className="flex h-dvh min-w-0 bg-background text-foreground">
      <Sidebar context={context} />
      <section className="flex min-w-0 flex-1 flex-col">
        <Outlet context={context} />
      </section>
    </main>
  );
}
