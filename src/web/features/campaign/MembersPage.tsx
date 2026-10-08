import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Ban,
  Check,
  Crown,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { api, type Member } from "@/web/lib/api";
import { peekProfileToken } from "@/web/lib/session";
import { cn, initials } from "@/web/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/web/components/ui/avatar";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/web/components/ui/dialog";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import type { CampaignContext } from "./types";

export function MembersPage() {
  const { campaign, session } = useOutletContext<CampaignContext>();
  const isHost = session.role === "host";
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kickTarget, setKickTarget] = useState<Member | null>(null);
  const [banTarget, setBanTarget] = useState<Member | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await api.listMembers(campaign.id, peekProfileToken(campaign.id));
      setMembers(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar participantes");
    } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    void reload();
    const interval = setInterval(() => void reload(), 5000);
    return () => clearInterval(interval);
  }, [reload]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ação falhou");
    }
  }

  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "active");
  const banned = members.filter((m) => m.status === "banned");

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden">
      <div className="border-b border-accent/10 px-6 py-4">
        <h1 className="flex items-center gap-2 font-display text-lg font-semibold text-gold-bright">
          <Users className="size-5 text-accent" /> Participantes
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {active.length} {active.length === 1 ? "membro" : "membros"}
          {isHost && pending.length > 0 ? ` · ${pending.length} aguardando aprovação` : ""}
        </p>
      </div>

      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
        {error && <p className="text-sm text-danger">{error}</p>}
        {loading && members.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando participantes…
          </div>
        )}

        {isHost && pending.length > 0 && (
          <Section title="Aguardando aprovação" accent>
            {pending.map((member) => (
              <MemberRow key={member.id} member={member}>
                <Button
                  size="sm"
                  variant="gold"
                  onClick={() => void act(() => api.approveMember(campaign.id, member.id))}
                >
                  <Check className="size-4" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  onClick={() => void act(() => api.rejectMember(campaign.id, member.id))}
                >
                  <X className="size-4" /> Rejeitar
                </Button>
              </MemberRow>
            ))}
          </Section>
        )}

        <Section title="Membros">
          {active.map((member) => (
            <MemberRow key={member.id} member={member}>
              {isHost && !member.isOwner && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Expulsar da campanha"
                    onClick={() => setKickTarget(member)}
                  >
                    <UserMinus className="size-4" /> Expulsar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:text-danger"
                    title="Banir da campanha"
                    onClick={() => setBanTarget(member)}
                  >
                    <Ban className="size-4" /> Banir
                  </Button>
                </>
              )}
            </MemberRow>
          ))}
          {active.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground/60">Nenhum membro ainda.</p>
          )}
        </Section>

        {isHost && banned.length > 0 && (
          <Section title="Banidos">
            {banned.map((member) => (
              <MemberRow key={member.id} member={member}>
                <Button
                  size="sm"
                  variant="outline-gold"
                  onClick={() => void act(() => api.unbanMember(campaign.id, member.id))}
                >
                  <UserCheck className="size-4" /> Desbanir
                </Button>
              </MemberRow>
            ))}
          </Section>
        )}
      </div>

      <ConfirmDialog
        open={kickTarget !== null}
        onOpenChange={(open) => !open && setKickTarget(null)}
        title="Expulsar participante"
        description={
          kickTarget
            ? `Expulsar "${kickTarget.name}" da campanha? Ele poderá pedir para entrar de novo pelo convite.`
            : ""
        }
        confirmLabel="Expulsar"
        onConfirm={() => act(() => api.kickMember(campaign.id, kickTarget!.id))}
      />
      <BanDialog
        member={banTarget}
        onOpenChange={(open) => !open && setBanTarget(null)}
        onConfirm={(reason) => act(() => api.banMember(campaign.id, banTarget!.id, reason))}
      />
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "card-ornate rounded-xl p-4",
        accent && "border-accent/40 shadow-[var(--shadow-glow-gold)]",
      )}
    >
      <h2 className="mb-3 font-display text-xs font-bold tracking-widest text-gold-dim uppercase">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </motion.section>
  );
}

const STATUS_LABEL: Record<Member["status"], string> = {
  active: "Ativo",
  pending: "Pendente",
  banned: "Banido",
};

function MemberRow({ member, children }: { member: Member; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5">
      <span className="relative shrink-0">
        <Avatar className="size-9">
          {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={member.name} /> : null}
          <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
        </Avatar>
        {member.onlineNow && (
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 animate-pulse-dot rounded-full border-2 border-card bg-success" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{member.name}</span>
          {member.isOwner && <Crown className="size-3.5 shrink-0 text-accent" aria-label="Dono da campanha" />}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {member.characterName?.trim() ||
            (member.isRegistered ? member.accountName : "Convidado sem conta")}
        </span>
      </span>

      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Badge
          className={member.role === "host" ? "border-accent/50 text-accent" : "border-border text-muted-foreground"}
        >
          {member.role === "host" ? <ShieldCheck className="size-3" /> : null}
          {member.role === "host" ? "Anfitrião" : "Jogador"}
        </Badge>
        <Badge className="border-border text-muted-foreground">
          {member.isRegistered ? "Conta" : "Convidado"}
        </Badge>
        <Badge
          className={cn(
            member.status === "active" && "border-success/50 text-success",
            member.status === "pending" && "border-accent/50 text-accent",
            member.status === "banned" && "border-danger/50 text-danger",
          )}
        >
          {member.status === "banned" ? <UserX className="size-3" /> : null}
          {STATUS_LABEL[member.status]}
        </Badge>
        {member.onlineNow && (
          <Badge className="border-success/50 text-success">Online</Badge>
        )}
      </span>

      {children && <span className="flex shrink-0 items-center gap-1">{children}</span>}
    </div>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

function BanDialog({
  member,
  onOpenChange,
  onConfirm,
}: {
  member: Member | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (member) {
      setReason("");
      setError("");
    }
  }, [member]);

  async function confirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm(reason.trim() || undefined);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível banir");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Banir participante</DialogTitle>
          <DialogDescription>
            {member
              ? `Banir "${member.name}"? Ele será removido da mesa e não poderá mais entrar nesta campanha.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ban-reason">Motivo (opcional)</Label>
          <Input
            id="ban-reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: comportamento inadequado"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            Banir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
