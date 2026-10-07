import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
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
} from "lucide-react";
import { api, type Channel } from "@/web/lib/api";
import { clearSession, getProfileToken, type Session } from "@/web/lib/session";
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
import type { CampaignContext } from "./types";

export function Sidebar({ context }: { context: CampaignContext }) {
  const { campaign, channels, session, refresh, updateSession } = context;
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  async function createChannel() {
    if (!newName.trim()) return;
    const channel = await api.createChannel(campaign.id, newName.trim());
    setNewName("");
    setCreateOpen(false);
    await refresh();
    navigate(`/campaign/${campaign.id}/channel/${channel.id}`);
  }

  function leave() {
    clearSession();
    navigate("/");
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card lg:w-60">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Dices className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold">{campaign.name}</p>
          <p className="text-[11px] text-muted-foreground">Mesa híbrida</p>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate("/settings")} aria-label="Configurações">
          <Settings className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <ChannelGroup title="CANAIS" channels={channels} onAdd={() => setCreateOpen(true)} />

        <div className="mt-5">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setInviteOpen(true)}>
            <Link2 className="size-4 text-primary" /> Convidar jogadores
          </Button>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold">
              {session.photoUrl ? (
                <img src={session.photoUrl} alt={session.name} className="size-full object-cover" />
              ) : (
                initials(session.name) || "MG"
              )}
            </div>
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-success" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{session.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {session.characterName?.trim() || (session.role === "host" ? "Anfitrião" : "Jogador")}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setProfileOpen(true)} aria-label="Editar perfil">
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={leave} aria-label="Sair">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      <CreateChannelDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={newName}
        setName={setNewName}
        onCreate={() => void createChannel()}
      />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} campaignId={campaign.id} />
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
        <DialogHeader>
          <DialogTitle>Seu perfil nesta campanha</DialogTitle>
          <DialogDescription>Nome, foto e personagem ficam salvos para as próximas sessões.</DialogDescription>
        </DialogHeader>
        <ProfileFields value={profile} onChange={setProfile} />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button className="mt-4 w-full" disabled={saving || !profile.name.trim()} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ChannelGroup({
  title,
  channels,
  onAdd,
}: {
  title: string;
  channels: Channel[];
  onAdd: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[11px] font-bold text-muted-foreground">{title}</span>
        <Button variant="ghost" size="icon" className="size-5" onClick={onAdd} aria-label="Adicionar canal">
          <Plus className="size-3.5" />
        </Button>
      </div>
      {channels.map((channel) => (
        <NavLink
          key={channel.id}
          to={`channel/${channel.id}`}
          className={({ isActive }) =>
            cn(
              "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )
          }
        >
          <Hash className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">{channel.name}</span>
        </NavLink>
      ))}
      {channels.length === 0 && (
        <p className="px-2 text-[11px] text-muted-foreground/60">Nenhum canal ainda</p>
      )}
    </div>
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
        <DialogHeader>
          <DialogTitle>Novo canal</DialogTitle>
          <DialogDescription>Todo canal tem chat persistente e mesa de voz.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do canal"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
          />
          <Button className="w-full" onClick={onCreate} disabled={!name.trim()}>
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ open, onOpenChange, campaignId }: { open: boolean; onOpenChange: (v: boolean) => void; campaignId: string }) {
  const [guestUrl, setGuestUrl] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function create(role: "host" | "guest") {
    const invite = await api.createInvite(campaignId, role);
    if (!invite.url) return;
    if (role === "guest") setGuestUrl(invite.url);
    else setHostUrl(invite.url);
  }

  function copy(label: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Convidar para a mesa</DialogTitle>
          <DialogDescription>Compartilhe um link. Quem abrir entra pelo nome, sem conta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <InviteRow
            label="Jogador"
            url={guestUrl}
            copied={copied === "guest"}
            onGenerate={() => void create("guest")}
            onCopy={() => copy("guest", guestUrl)}
          />
          <InviteRow
            label="Anfitrião (entra direto)"
            url={hostUrl}
            copied={copied === "host"}
            onGenerate={() => void create("host")}
            onCopy={() => copy("host", hostUrl)}
          />
        </div>
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
    <div className="rounded-md border border-border p-3">
      <p className="text-sm font-medium">{label}</p>
      {url ? (
        <div className="mt-2 flex items-center gap-2">
          <Input readOnly value={url} className="text-xs" />
          <Button size="icon" variant="secondary" onClick={onCopy} aria-label="Copiar link">
            {copied ? <CheckIcon /> : <Copy className="size-4" />}
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

function CheckIcon() {
  return <span className="text-success">✓</span>;
}
