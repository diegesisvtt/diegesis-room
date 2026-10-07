import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dices, Plus, Settings, Sparkles, Users } from "lucide-react";
import { api, type Campaign } from "@/web/lib/api";
import { getProfileToken, saveSession } from "@/web/lib/session";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";

export function LandingPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api.listCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  async function createCampaign() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const campaign = await api.createCampaign(trimmed);
      saveSession({ name: "Mestre", role: "host", campaignId: campaign.id });
      navigate(`/campaign/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha");
    } finally {
      setCreating(false);
    }
  }

  function openInvite() {
    const trimmed = inviteUrl.trim();
    if (!trimmed) return;
    const token = extractToken(trimmed);
    if (token) navigate(`/join/${token}`);
    else setError("Link de convite inválido.");
  }

  async function enterCampaign(campaign: Campaign) {
    // Recupera o perfil salvo deste navegador (nome, personagem, foto), se houver.
    const profile = await api.getProfile(campaign.id, getProfileToken(campaign.id)).catch(() => null);
    saveSession({
      name: profile?.name ?? "Mestre",
      role: "host",
      campaignId: campaign.id,
      characterName: profile?.characterName ?? null,
      photoUrl: profile?.photoUrl ?? null,
    });
    navigate(`/campaign/${campaign.id}`);
  }

  return (
    <main className="flex min-h-full flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Dices className="size-5" />
          </div>
          <div>
            <h1 className="font-display font-semibold">Diegesis Room</h1>
            <p className="text-xs text-muted-foreground">Mesa híbrida de RPG</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings">
            <Settings className="size-4" /> Configurações
          </Link>
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-12">
        <div className="text-center">
          <Sparkles className="mx-auto mb-3 size-8 text-accent" />
          <h2 className="font-display text-2xl font-bold">Jogue RPG online ou híbrido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vídeo, voz, câmera dedicada ao mapa, chat, dados e modo TV — como Zoom e Discord, feitos para a mesa.
          </p>
        </div>

        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus className="size-4 text-primary" /> Nova campanha
          </h3>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da campanha (ex.: Crônicas de Astar)"
              onKeyDown={(e) => e.key === "Enter" && void createCampaign()}
            />
            <Button onClick={() => void createCampaign()} disabled={creating || !name.trim()}>
              Criar
            </Button>
          </div>
        </section>

        {campaigns.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" /> Suas campanhas
            </h3>
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => void enterCampaign(campaign)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-background/40 px-4 py-3 text-left transition-colors hover:bg-secondary"
                >
                  <span className="font-medium">{campaign.name}</span>
                  <span className="text-xs text-muted-foreground">Entrar como anfitrião →</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Entrar com link de convite</h3>
          <div className="flex gap-2">
            <Input
              value={inviteUrl}
              onChange={(e) => setInviteUrl(e.target.value)}
              placeholder="Cole o link de convite"
              onKeyDown={(e) => e.key === "Enter" && openInvite()}
            />
            <Button variant="secondary" onClick={openInvite}>
              Entrar
            </Button>
          </div>
        </section>

        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    </main>
  );
}

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/join\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1]!;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}
