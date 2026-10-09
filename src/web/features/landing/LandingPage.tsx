import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { Crown, Loader2, LogIn, LogOut, Pencil, Plus, Scroll, Settings, Sparkles, Trash2, UserPlus, Users } from "lucide-react";
import { api, type Campaign, type CampaignEntry } from "@/web/lib/api";
import { clearSession, loadSession, peekProfileToken, saveSession, setProfileToken } from "@/web/lib/session";
import { setAuthUser, useAuth } from "@/web/features/auth/useAuth";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/web/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/web/components/ui/context-menu";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { EmberParticles } from "@/web/components/EmberParticles";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 16 },
  },
};

export function LandingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignEntry[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [renameTarget, setRenameTarget] = useState<Campaign | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  async function reloadCampaigns() {
    const list = await api.listCampaigns().catch(() => [] as CampaignEntry[]);
    setCampaigns(list);
  }

  useEffect(() => {
    if (user) void reloadCampaigns();
    else setCampaigns([]);
  }, [user]);

  async function renameCampaign() {
    const trimmed = renameName.trim();
    if (!renameTarget || !trimmed) return;
    setRenaming(true);
    try {
      await api.updateCampaign(renameTarget.id, trimmed);
      await reloadCampaigns();
      setRenameTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao renomear campanha");
    } finally {
      setRenaming(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    await api.deleteCampaign(campaign.id);
    if (loadSession()?.campaignId === campaign.id) clearSession();
    await reloadCampaigns();
  }

  async function createCampaign() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!user) {
      navigate("/login");
      return;
    }
    setCreating(true);
    try {
      const campaign = await api.createCampaign(trimmed);
      await enterCampaign({ ...campaign, isOwner: true, myRole: "host", myStatus: "active" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha");
    } finally {
      setCreating(false);
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    setAuthUser(null);
    clearSession();
  }

  function openInvite() {
    const trimmed = inviteUrl.trim();
    if (!trimmed) return;
    const token = extractToken(trimmed);
    if (token) navigate(`/join/${token}`);
    else setError("Link de convite inválido.");
  }

  async function enterCampaign(campaign: CampaignEntry) {
    // Perfil: pelo token local ou pelo cookie (perfil do dono criado no servidor).
    const profile =
      (await api.getProfile(campaign.id, peekProfileToken(campaign.id)).catch(() => null))?.profile ??
      null;
    if (profile) setProfileToken(campaign.id, profile.token);
    saveSession({
      name: profile?.name ?? user?.name ?? "Jogador",
      role: profile?.role ?? (campaign.isOwner ? "host" : campaign.myRole ?? "guest"),
      status: profile?.status ?? campaign.myStatus ?? "active",
      campaignId: campaign.id,
      characterName: profile?.characterName ?? null,
      photoUrl: profile?.photoUrl ?? null,
    });
    navigate(`/campaign/${campaign.id}`);
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-30" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 0%, color-mix(in oklab, var(--color-accent) 10%, transparent), transparent 70%), radial-gradient(ellipse 55% 45% at 85% 100%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 70%), radial-gradient(ellipse 55% 45% at 10% 90%, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent 70%)",
        }}
      />
      <EmberParticles count={22} />
      <div className="vignette pointer-events-none absolute inset-0" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-accent/10 ring-1 ring-accent/40">
            <Crown className="size-4 text-accent" />
          </div>
          <span className="font-display text-sm font-semibold tracking-wide text-foreground/90">
            Diegesis Room
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-accent">
            <Link to="/settings">
              <Settings className="size-4" /> Configurações
            </Link>
          </Button>
          {authLoading ? null : user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Olá, <span className="text-foreground">{user.name}</span>
              </span>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger" onClick={() => void logout()}>
                <LogOut className="size-4" /> Sair
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-accent">
                <Link to="/login">
                  <LogIn className="size-4" /> Entrar
                </Link>
              </Button>
              <Button asChild variant="outline-gold" size="sm">
                <Link to="/register">
                  <UserPlus className="size-4" /> Criar conta
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-7 px-6 pb-10 pt-4"
      >
        <motion.div variants={item} className="text-center">
          <Sparkles
            className="animate-float mx-auto mb-4 size-9 text-accent"
            style={{ filter: "drop-shadow(0 0 12px color-mix(in oklab, var(--color-accent) 65%, transparent))" }}
          />
          <motion.h1
            variants={item}
            className="gold-shimmer-text font-display text-5xl font-bold tracking-wide sm:text-6xl"
          >
            Diegesis Room
          </motion.h1>
          <motion.div variants={item} className="mx-auto mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-20 bg-gradient-to-r from-transparent to-accent/70" />
            <span className="size-1.5 rotate-45 bg-accent shadow-[var(--shadow-glow-gold)]" />
            <span className="h-px w-20 bg-gradient-to-l from-transparent to-accent/70" />
          </motion.div>
          <motion.p variants={item} className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Jogue RPG online ou híbrido — vídeo, voz, câmera dedicada ao mapa, chat, dados e modo streaming,
            como Zoom e Discord, feitos para a mesa.
          </motion.p>
        </motion.div>

        <motion.section
          variants={item}
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="card-ornate group rounded-xl p-6 transition-[border-color,box-shadow] duration-300 hover:border-accent/50 hover:shadow-[var(--shadow-glow-gold)]"
        >
          <h2 className="mb-4 flex items-center gap-3 font-display text-sm font-semibold tracking-wide text-accent">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/40 transition-shadow duration-300 group-hover:shadow-[var(--shadow-glow-gold)]">
              <Plus className="size-4" />
            </span>
            Nova campanha
          </h2>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da campanha (ex.: Crônicas de Astar)"
              onKeyDown={(e) => e.key === "Enter" && void createCampaign()}
            />
            <Button variant="gold" onClick={() => void createCampaign()} disabled={creating || !name.trim()}>
              Criar
            </Button>
          </div>
          {!authLoading && !user && (
            <p className="mt-3 text-xs text-muted-foreground">
              Para criar e mestrar campanhas você precisa de{" "}
              <Link to="/register" className="text-accent hover:underline">uma conta</Link>.
              Jogadores entram só pelo link de convite.
            </p>
          )}
        </motion.section>

        {campaigns.length > 0 && (
          <motion.section
            variants={item}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="card-ornate group rounded-xl p-6 transition-[border-color,box-shadow] duration-300 hover:border-accent/50 hover:shadow-[var(--shadow-glow-gold)]"
          >
            <h2 className="mb-4 flex items-center gap-3 font-display text-sm font-semibold tracking-wide text-accent">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/40 transition-shadow duration-300 group-hover:shadow-[var(--shadow-glow-gold)]">
                <Users className="size-4" />
              </span>
              Suas campanhas
            </h2>
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <ContextMenu key={campaign.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => void enterCampaign(campaign)}
                      className="flex w-full items-center justify-between rounded-md border border-border bg-background/40 px-4 py-3 text-left transition-all duration-300 hover:translate-x-1 hover:border-accent/40 hover:bg-secondary hover:text-accent"
                    >
                      <span className="font-medium">{campaign.name}</span>
                      <span className="text-xs text-muted-foreground transition-colors group-hover:text-accent/80">
                        {campaign.myStatus === "pending"
                          ? "Aguardando aprovação…"
                          : campaign.myRole === "host" || campaign.isOwner
                            ? "Entrar como anfitrião →"
                            : "Entrar como jogador →"}
                      </span>
                    </button>
                  </ContextMenuTrigger>
                  {campaign.isOwner && (
                    <ContextMenuContent className="w-52">
                      <ContextMenuItem
                        onSelect={() => {
                          setRenameName(campaign.name);
                          setRenameTarget(campaign);
                        }}
                      >
                        <Pencil /> Renomear campanha
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => setDeleteTarget(campaign)}
                        className="text-danger focus:bg-danger/10 focus:text-danger"
                      >
                        <Trash2 /> Excluir campanha
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              ))}
            </div>
          </motion.section>
        )}

        <motion.section
          variants={item}
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="card-ornate group rounded-xl p-6 transition-[border-color,box-shadow] duration-300 hover:border-accent/50 hover:shadow-[var(--shadow-glow-gold)]"
        >
          <h2 className="mb-4 flex items-center gap-3 font-display text-sm font-semibold tracking-wide text-accent">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/40 transition-shadow duration-300 group-hover:shadow-[var(--shadow-glow-gold)]">
              <Scroll className="size-4" />
            </span>
            Entrar com link de convite
          </h2>
          <div className="flex gap-2">
            <Input
              value={inviteUrl}
              onChange={(e) => setInviteUrl(e.target.value)}
              placeholder="Cole o link de convite"
              onKeyDown={(e) => e.key === "Enter" && openInvite()}
            />
            <Button variant="outline-gold" onClick={openInvite}>
              Entrar
            </Button>
          </div>
        </motion.section>

        {error && (
          <motion.p variants={item} className="text-center text-sm text-danger">
            {error}
          </motion.p>
        )}
      </motion.div>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
          <motion.div variants={container} initial="hidden" animate="show" className="contents">
            <motion.div variants={item}>
              <DialogHeader>
                <DialogTitle>Renomear campanha</DialogTitle>
                <DialogDescription>O novo nome aparece para todos os participantes.</DialogDescription>
              </DialogHeader>
            </motion.div>
            <motion.div variants={item}>
              <Input
                value={renameName}
                maxLength={64}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="Nome da campanha"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void renameCampaign()}
              />
            </motion.div>
            <motion.div variants={item}>
              <Button variant="gold" className="w-full" onClick={() => void renameCampaign()} disabled={renaming || !renameName.trim()}>
                {renaming ? <Loader2 className="size-4 animate-spin" /> : null}
                Salvar
              </Button>
            </motion.div>
          </motion.div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir campanha"
        description={deleteTarget ? `Excluir "${deleteTarget.name}"? Todos os canais, mensagens e perfis serão removidos permanentemente.` : ""}
        onConfirm={() => deleteCampaign(deleteTarget!)}
      />
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
