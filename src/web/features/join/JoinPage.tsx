import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Dices, Loader2, ScrollText } from "lucide-react";
import { api, type Profile, type ResolvedInvite } from "@/web/lib/api";
import { ensureName, getProfileToken, peekProfileToken, saveSession, setProfileToken } from "@/web/lib/session";
import { Button } from "@/web/components/ui/button";
import { ProfileFields, type ProfileFieldsValue } from "@/web/components/ProfileFields";
import { EmberParticles } from "@/web/components/EmberParticles";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 18 } },
};

export function JoinPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<ResolvedInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileFieldsValue>({
    name: "",
    characterName: "",
    photoDataUrl: null,
    photoUrl: null,
  });
  const [joining, setJoining] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [banned, setBanned] = useState(false);
  const [rejected, setRejected] = useState(false);

  function enter(saved: Profile) {
    saveSession({
      name: saved.name,
      role: saved.role,
      status: saved.status,
      campaignId: invite!.campaign.id,
      characterName: saved.characterName,
      photoUrl: saved.photoUrl,
    });
    navigate(`/campaign/${invite!.campaign.id}`);
  }

  // Enquanto aguarda aprovação, verifica o status a cada 3s.
  useEffect(() => {
    if (!waiting || !invite) return;
    const interval = setInterval(() => {
      void api
        .getProfile(invite.campaign.id, peekProfileToken(invite.campaign.id))
        .then((saved) => {
          if (saved.status === "active") enter(saved);
          else if (saved.status === "banned") {
            setWaiting(false);
            setBanned(true);
          }
        })
        .catch(() => {
          // 404: o host rejeitou (ou expulsou) — o perfil não existe mais.
          setWaiting(false);
          setRejected(true);
        });
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, invite]);

  useEffect(() => {
    async function load() {
      try {
        const resolved = await api.resolveInvite(token);
        setInvite(resolved);
        // Se esse navegador já tem um perfil nesta campanha, pré-preenche.
        // Tenta pelo token local; senão, pelo cookie de sessão (usuário logado
        // com perfil criado no servidor, ex.: dono da campanha).
        let saved = await api
          .getProfile(resolved.campaign.id, peekProfileToken(resolved.campaign.id))
          .catch(() => null);
        if (!saved) saved = await api.getProfile(resolved.campaign.id).catch(() => null);
        if (saved) {
          setProfileToken(resolved.campaign.id, saved.token);
          setProfile({
            name: saved.name,
            characterName: saved.characterName ?? "",
            photoDataUrl: null,
            photoUrl: saved.photoUrl,
          });
          if (saved.status === "banned") setBanned(true);
          else if (saved.status === "pending") setWaiting(true);
        } else {
          setProfile((p) => ({ ...p, name: ensureName() }));
        }
      } catch {
        setError("Convite não encontrado ou expirado.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  async function join() {
    const name = profile.name.trim();
    if (!name || !invite) return;
    setJoining(true);
    setError("");
    try {
      const saved = await api.saveProfile(invite.campaign.id, {
        token: getProfileToken(invite.campaign.id),
        name,
        characterName: profile.characterName.trim() || null,
        photo: profile.photoDataUrl,
        inviteToken: invite.token,
      });
      setProfileToken(invite.campaign.id, saved.token);
      if (saved.status === "active") enter(saved);
      else if (saved.status === "banned") setBanned(true);
      else setWaiting(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <Scene>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center"
        >
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-accent" />
          <p className="font-display text-lg text-glow gold-shimmer-text">Carregando convite…</p>
        </motion.div>
      </Scene>
    );
  }

  if (rejected) {
    return (
      <Scene>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="card-ornate w-full max-w-sm rounded-xl p-8 text-center"
        >
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-danger/40 bg-danger/10">
            <ScrollText className="size-7 text-danger" />
          </div>
          <p className="font-display text-xl text-glow text-foreground">Entrada não aprovada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            O anfitrião não aprovou sua participação desta vez. Você pode tentar entrar de novo.
          </p>
          <Button variant="outline-gold" className="mt-6" onClick={() => setRejected(false)}>
            Tentar novamente
          </Button>
          <Button variant="ghost" className="mt-2 text-muted-foreground" onClick={() => navigate("/")}>
            Voltar ao início
          </Button>
        </motion.div>
      </Scene>
    );
  }

  if (banned) {
    return (
      <Scene>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="card-ornate w-full max-w-sm rounded-xl p-8 text-center"
        >
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-danger/40 bg-danger/10">
            <ScrollText className="size-7 text-danger" />
          </div>
          <p className="font-display text-xl text-glow text-foreground">Acesso bloqueado</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Você foi banido desta campanha. Fale com o anfitrião se acha que isso é um engano.
          </p>
          <Button variant="outline-gold" className="mt-6" onClick={() => navigate("/")}>
            <ArrowLeft className="size-4" />
            Voltar ao início
          </Button>
        </motion.div>
      </Scene>
    );
  }

  if (waiting && invite) {
    return (
      <Scene>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="card-ornate w-full max-w-sm rounded-xl p-8 text-center"
        >
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-accent" />
          <p className="font-display text-xl text-glow text-foreground">Aguardando aprovação</p>
          <p className="mt-2 text-sm text-muted-foreground">
            O anfitrião de <strong className="text-foreground">{invite.campaign.name}</strong> precisa
            aprovar sua entrada. Esta página atualiza sozinha.
          </p>
          <Button variant="ghost" className="mt-6 text-muted-foreground" onClick={() => navigate("/")}>
            <ArrowLeft className="size-4" />
            Desistir
          </Button>
        </motion.div>
      </Scene>
    );
  }

  if (!invite) {
    return (
      <Scene>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="card-ornate w-full max-w-sm rounded-xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.15 }}
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-danger/40 bg-danger/10"
          >
            <ScrollText className="size-7 text-danger" />
          </motion.div>
          <p className="font-display text-xl text-glow text-foreground">Convite inválido</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline-gold" className="mt-6" onClick={() => navigate("/")}>
            <ArrowLeft className="size-4" />
            Voltar ao início
          </Button>
        </motion.div>
      </Scene>
    );
  }

  return (
    <Scene>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="card-ornate w-full max-w-sm rounded-xl p-7"
      >
        <motion.div variants={itemVariants} className="mb-1 flex justify-center">
          <div className="animate-glow-pulse flex size-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
            <Dices className="size-7" />
          </div>
        </motion.div>
        <motion.h1
          variants={itemVariants}
          className="font-display text-glow gold-shimmer-text text-center text-2xl font-bold tracking-wide"
        >
          {invite.campaign.name}
        </motion.h1>
        <motion.p variants={itemVariants} className="mt-1 mb-6 text-center text-xs tracking-widest text-muted-foreground uppercase">
          {invite.role === "host" ? "Convite de anfitrião" : "Convite de jogador"}
        </motion.p>

        <motion.div variants={itemVariants}>
          <ProfileFields value={profile} onChange={setProfile} autoFocusName />
        </motion.div>

        {error && (
          <motion.p variants={itemVariants} className="mt-3 text-sm text-danger">
            {error}
          </motion.p>
        )}

        <motion.div variants={itemVariants}>
          <Button
            variant="gold"
            size="lg"
            className="mt-6 w-full text-base"
            disabled={joining || !profile.name.trim()}
            onClick={() => void join()}
          >
            {joining ? <Loader2 className="size-5 animate-spin" /> : <Dices className="size-5" />}
            Entrar na mesa
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Seu perfil fica salvo nesta campanha para as próximas sessões.
          </p>
        </motion.div>
      </motion.div>
    </Scene>
  );
}

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-full items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-primary)_14%,transparent),transparent_60%),radial-gradient(ellipse_at_bottom,color-mix(in_oklab,var(--color-accent)_8%,transparent),transparent_60%)]"
      />
      <div aria-hidden className="map-grid absolute inset-0 opacity-40" />
      <EmberParticles count={22} />
      <div aria-hidden className="vignette pointer-events-none absolute inset-0" />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </main>
  );
}
