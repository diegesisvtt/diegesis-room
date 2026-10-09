import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  Check,
  ChevronDown,
  Copy,
  Dices,
  Hash,
  Link2,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { api, type Channel, type Invite, type VoiceParticipant } from "@/web/lib/api";
import { clearSession, getProfileToken, type Session } from "@/web/lib/session";
import { useAuth } from "@/web/features/auth/useAuth";
import { VoiceDock } from "@/web/features/meeting/VoiceDock";
import { disconnect as disconnectVoice } from "@/web/features/meeting/voiceStore";
import { ProfileFields, type ProfileFieldsValue } from "@/web/components/ProfileFields";
import { cn, initials } from "@/web/lib/utils";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/web/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/web/components/ui/context-menu";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/web/components/ui/avatar";
import { PresenceStack } from "@/web/components/PresenceStack";
import { Separator } from "@/web/components/ui/separator";
import { ScrollArea } from "@/web/components/ui/scroll-area";
import type { CampaignContext } from "./types";

const dialogStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const dialogItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function Sidebar({ context }: { context: CampaignContext }) {
  const { campaign, channels, presence, session, refresh, updateSession } = context;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Channel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);

  async function createChannel() {
    if (!newName.trim()) return;
    const channel = await api.createChannel(campaign.id, newName.trim());
    setNewName("");
    setCreateOpen(false);
    await refresh();
    navigate(`/campaign/${campaign.id}/channel/${channel.id}`);
  }

  async function deleteChannel(channel: Channel) {
    await api.deleteChannel(channel.id);
    await refresh();
    if (window.location.pathname.includes(`/channel/${channel.id}`)) {
      navigate(`/campaign/${campaign.id}`);
    }
  }

  function leave() {
    disconnectVoice();
    clearSession();
    navigate("/");
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-accent/15 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-accent)_7%,var(--color-card)),var(--color-card)_55%,color-mix(in_oklab,var(--color-background)_75%,var(--color-card)))] lg:w-60">
      <div className="border-b border-accent/10 px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-gold-bright shadow-[var(--shadow-glow-violet)] ring-1 ring-accent/30">
            <Dices className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold tracking-wide text-gold-bright">{campaign.name}</p>
            <p className="text-[11px] text-muted-foreground">Mesa híbrida</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 hover:text-gold-bright" onClick={() => navigate(`/campaign/${campaign.id}/settings`)} aria-label="Configurações da campanha">
            <Settings className="size-4" />
          </Button>
        </div>
        <Separator ornate className="mt-3" />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <ChannelGroup
            title="CANAIS"
            channels={channels}
            presence={presence}
            canModerate={session.role === "host"}
            onAdd={() => setCreateOpen(true)}
            onRename={(channel) => setRenameTarget(channel)}
            onDelete={(channel) => setDeleteTarget(channel)}
          />

          <div className="mt-5 space-y-1.5">
            <Button
              variant="outline-gold"
              size="sm"
              className="w-full justify-start"
              onClick={() => navigate(`/campaign/${campaign.id}/members`)}
            >
              <Users className="size-4" /> Participantes
            </Button>
            {session.role === "host" && (
              <Button variant="outline-gold" size="sm" className="w-full justify-start" onClick={() => setInviteOpen(true)}>
                <Link2 className="size-4" /> Convidar jogadores
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-accent/10 p-3">
        <VoiceDock />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-200 hover:bg-accent/10 hover:shadow-[var(--shadow-glow-gold)]"
            >
              <span className="relative shrink-0">
                <Avatar className="size-9">
                  {session.photoUrl ? <AvatarImage src={session.photoUrl} alt={session.name} /> : null}
                  <AvatarFallback className="text-xs">{initials(session.name) || "MG"}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 animate-pulse-dot rounded-full border-2 border-card bg-success" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{session.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {session.characterName?.trim() || (session.role === "host" ? "Anfitrião" : "Jogador")}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="font-display text-xs tracking-wide text-gold-bright">
              {session.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
              <Pencil /> Editar perfil
            </DropdownMenuItem>
            {!user && (
              <DropdownMenuItem onSelect={() => navigate("/register")}>
                <UserPlus /> Criar conta / Entrar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => navigate("/settings")}>
              <Settings /> Configurações do app
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={leave} className="text-danger focus:bg-danger/10 focus:text-danger">
              <LogOut /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateChannelDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={newName}
        setName={setNewName}
        onCreate={() => void createChannel()}
      />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} campaignId={campaign.id} />
      <RenameChannelDialog
        channel={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        onRenamed={refresh}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir canal"
        description={deleteTarget ? `Excluir "${deleteTarget.name}"? Todas as mensagens do canal serão removidas permanentemente.` : ""}
        onConfirm={() => deleteChannel(deleteTarget!)}
      />
      <EditProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        campaignId={campaign.id}
        session={session}
        onSaved={updateSession}
      />
    </aside>
  );
}

function EditProfileDialog({
  open,
  onOpenChange,
  campaignId,
  session,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  session: Session;
  onSaved: (patch: Partial<Session>) => void;
}) {
  const [profile, setProfile] = useState<ProfileFieldsValue>({
    name: session.name,
    characterName: session.characterName ?? "",
    photoDataUrl: null,
    photoUrl: session.photoUrl ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Recarrega os valores atuais sempre que o dialog abre.
  useEffect(() => {
    if (!open) return;
    setProfile({
      name: session.name,
      characterName: session.characterName ?? "",
      photoDataUrl: null,
      photoUrl: session.photoUrl ?? null,
    });
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    const name = profile.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      const saved = await api.saveProfile(campaignId, {
        token: getProfileToken(campaignId),
        name,
        characterName: profile.characterName.trim() || null,
        photo: profile.photoDataUrl,
      });
      onSaved({ name: saved.name, characterName: saved.characterName, photoUrl: saved.photoUrl });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <motion.div variants={dialogStagger} initial="hidden" animate="show" className="contents">
          <motion.div variants={dialogItem}>
            <DialogHeader>
              <DialogTitle>Seu perfil nesta campanha</DialogTitle>
              <DialogDescription>Nome, foto e personagem ficam salvos para as próximas sessões.</DialogDescription>
            </DialogHeader>
          </motion.div>
          <motion.div variants={dialogItem}>
            <ProfileFields value={profile} onChange={setProfile} />
          </motion.div>
          {error && (
            <motion.p variants={dialogItem} className="text-sm text-danger">
              {error}
            </motion.p>
          )}
          <motion.div variants={dialogItem}>
            <Button variant="gold" className="w-full" disabled={saving || !profile.name.trim()} onClick={() => void save()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function ChannelGroup({
  title,
  channels,
  presence,
  canModerate,
  onAdd,
  onRename,
  onDelete,
}: {
  title: string;
  channels: Channel[];
  presence: Record<string, VoiceParticipant[]>;
  canModerate: boolean;
  onAdd: () => void;
  onRename: (channel: Channel) => void;
  onDelete: (channel: Channel) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="font-display text-[11px] font-bold tracking-widest text-gold-dim">{title}</span>
        {canModerate && (
          <Button variant="ghost" size="icon" className="size-5 hover:text-gold-bright" onClick={onAdd} aria-label="Adicionar canal">
            <Plus className="size-3.5" />
          </Button>
        )}
      </div>
      {channels.map((channel) => (
        <ContextMenu key={channel.id}>
          <ContextMenuTrigger asChild disabled={!canModerate}>
            <NavLink
              to={`channel/${channel.id}`}
              className={({ isActive }) =>
                cn(
                  "group relative mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-200",
                  isActive ? "text-foreground" : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="active-channel"
                      className="absolute inset-0 rounded-md border border-accent/30 bg-accent/15 shadow-[var(--shadow-glow-gold)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Hash
                    className={cn(
                      "relative z-10 size-4 shrink-0 transition-all duration-200 group-hover:translate-x-0.5",
                      isActive && "text-accent",
                    )}
                  />
                  <span className="relative z-10 min-w-0 flex-1 truncate text-left">{channel.name}</span>
                  <PresenceStack participants={presence[channel.id] ?? []} />
                </>
              )}
            </NavLink>
          </ContextMenuTrigger>
          {canModerate && (
            <ContextMenuContent className="w-48">
              <ContextMenuItem onSelect={() => onRename(channel)}>
                <Pencil /> Renomear canal
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => onDelete(channel)}
                className="text-danger focus:bg-danger/10 focus:text-danger"
              >
                <Trash2 /> Excluir canal
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>
      ))}
      {channels.length === 0 && (
        <p className="px-2 text-[11px] text-muted-foreground/60">Nenhum canal ainda</p>
      )}
    </div>
  );
}

function RenameChannelDialog({
  channel,
  onOpenChange,
  onRenamed,
}: {
  channel: Channel | null;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setError("");
    }
  }, [channel]);

  async function save() {
    const trimmed = name.trim();
    if (!channel || !trimmed) return;
    setSaving(true);
    setError("");
    try {
      await api.updateChannel(channel.id, trimmed);
      await onRenamed();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao renomear canal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={channel !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <motion.div variants={dialogStagger} initial="hidden" animate="show" className="contents">
          <motion.div variants={dialogItem}>
            <DialogHeader>
              <DialogTitle>Renomear canal</DialogTitle>
              <DialogDescription>O histórico de chat e a mesa de voz são mantidos.</DialogDescription>
            </DialogHeader>
          </motion.div>
          <motion.div variants={dialogItem}>
            <Input
              value={name}
              maxLength={48}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do canal"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void save()}
            />
          </motion.div>
          {error && (
            <motion.p variants={dialogItem} className="text-sm text-danger">
              {error}
            </motion.p>
          )}
          <motion.div variants={dialogItem}>
            <Button variant="gold" className="w-full" onClick={() => void save()} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function CreateChannelDialog({
  open,
  onOpenChange,
  name,
  setName,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  setName: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <motion.div variants={dialogStagger} initial="hidden" animate="show" className="contents">
          <motion.div variants={dialogItem}>
            <DialogHeader>
              <DialogTitle>Novo canal</DialogTitle>
              <DialogDescription>Todo canal tem chat persistente e mesa de voz.</DialogDescription>
            </DialogHeader>
          </motion.div>
          <motion.div variants={dialogItem}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do canal"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
            />
          </motion.div>
          <motion.div variants={dialogItem}>
            <Button variant="gold" className="w-full" onClick={onCreate} disabled={!name.trim()}>
              Criar
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ open, onOpenChange, campaignId }: { open: boolean; onOpenChange: (v: boolean) => void; campaignId: string }) {
  const [guestUrl, setGuestUrl] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    void api.listInvites(campaignId).then(setInvites).catch(() => setInvites([]));
  }, [open, campaignId]);

  async function create(role: "host" | "guest") {
    const invite = await api.createInvite(campaignId, role);
    if (!invite.url) return;
    if (role === "guest") setGuestUrl(invite.url);
    else setHostUrl(invite.url);
    setInvites((current) => [...current, invite]);
  }

  async function revoke(inviteId: string) {
    await api.revokeInvite(campaignId, inviteId).catch(() => {});
    setInvites((current) => current.filter((invite) => invite.id !== inviteId));
  }

  function copy(label: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopied(label);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <motion.div variants={dialogStagger} initial="hidden" animate="show" className="contents">
          <motion.div variants={dialogItem}>
            <DialogHeader>
              <DialogTitle>Convidar para a mesa</DialogTitle>
              <DialogDescription>Compartilhe um link. Quem abrir entra pelo nome, sem conta.</DialogDescription>
            </DialogHeader>
          </motion.div>
          <motion.div variants={dialogItem}>
            <InviteRow
              label="Jogador"
              url={guestUrl}
              copied={copied === "guest"}
              onGenerate={() => void create("guest")}
              onCopy={() => copy("guest", guestUrl)}
            />
          </motion.div>
          <motion.div variants={dialogItem}>
            <InviteRow
              label="Anfitrião (entra direto, requer conta)"
              url={hostUrl}
              copied={copied === "host"}
              onGenerate={() => void create("host")}
              onCopy={() => copy("host", hostUrl)}
            />
          </motion.div>
          {invites.length > 0 && (
            <motion.div variants={dialogItem} className="mt-1">
              <p className="mb-2 font-display text-[11px] font-bold tracking-widest text-gold-dim uppercase">
                Links ativos
              </p>
              <div className="max-h-36 space-y-1.5 overflow-y-auto">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5"
                  >
                    <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {invite.role === "host" ? "Anfitrião" : "Jogador"} · …{invite.token.slice(-8)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-danger"
                      aria-label="Revogar convite"
                      onClick={() => void revoke(invite.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function InviteRow({
  label,
  url,
  copied,
  onGenerate,
  onCopy,
}: {
  label: string;
  url: string;
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-all duration-300",
        copied ? "border-accent/50 shadow-[var(--shadow-glow-gold)]" : "border-border",
      )}
    >
      <p className="text-sm font-medium">{label}</p>
      {url ? (
        <div className="mt-2 flex items-center gap-2">
          <Input readOnly value={url} className="text-xs" />
          <Button
            size="icon"
            variant="secondary"
            onClick={onCopy}
            aria-label="Copiar link"
            className={cn(copied && "border border-accent/50 shadow-[var(--shadow-glow-gold)]")}
          >
            {copied ? (
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="flex"
              >
                <Check className="size-4 text-success" />
              </motion.span>
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onGenerate}>
          Gerar link
        </Button>
      )}
    </div>
  );
}
