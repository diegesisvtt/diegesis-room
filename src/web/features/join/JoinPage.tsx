import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dices, Loader2 } from "lucide-react";
import { api, type ResolvedInvite } from "@/web/lib/api";
import { ensureName, getProfileToken, saveSession } from "@/web/lib/session";
import { Button } from "@/web/components/ui/button";
import { ProfileFields, type ProfileFieldsValue } from "@/web/components/ProfileFields";

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

  useEffect(() => {
    async function load() {
      try {
        const resolved = await api.resolveInvite(token);
        setInvite(resolved);
        // Se esse navegador já tem um perfil nesta campanha, pré-preenche.
        const profileToken = getProfileToken(resolved.campaign.id);
        const saved = await api.getProfile(resolved.campaign.id, profileToken).catch(() => null);
        if (saved) {
          setProfile({
            name: saved.name,
            characterName: saved.characterName ?? "",
            photoDataUrl: null,
            photoUrl: saved.photoUrl,
          });
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
    try {
      const saved = await api.saveProfile(invite.campaign.id, {
        token: getProfileToken(invite.campaign.id),
        name,
        characterName: profile.characterName.trim() || null,
        photo: profile.photoDataUrl,
      });
      saveSession({
        name: saved.name,
        role: invite.role,
        campaignId: invite.campaign.id,
        characterName: saved.characterName,
        photoUrl: saved.photoUrl,
      });
      navigate(`/campaign/${invite.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil");
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <Center>
        <Loader2 className="mx-auto mb-3 size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando convite…</p>
      </Center>
    );
  }

  if (!invite) {
    return (
      <Center>
        <Dices className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-lg font-semibold">Convite inválido</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-5" onClick={() => navigate("/")}>
          Voltar ao início
        </Button>
      </Center>
    );
  }

  return (
    <Center>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Dices className="size-5" />
          </div>
          <div>
            <h1 className="font-display font-semibold">{invite.campaign.name}</h1>
            <p className="text-xs text-muted-foreground">
              {invite.role === "host" ? "Convite de anfitrião" : "Convite de jogador"}
            </p>
          </div>
        </div>

        <ProfileFields value={profile} onChange={setProfile} autoFocusName />

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <Button className="mt-5 w-full" disabled={joining || !profile.name.trim()} onClick={() => void join()}>
          {joining ? <Loader2 className="size-4 animate-spin" /> : null}
          Entrar na mesa
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Seu perfil fica salvo nesta campanha para as próximas sessões.
        </p>
      </div>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-full items-center justify-center bg-background px-6 text-foreground">{children}</main>;
}
