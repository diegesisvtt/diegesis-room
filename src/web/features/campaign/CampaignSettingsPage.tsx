import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { api, type Background, type StreamDisplayMode } from "@/web/lib/api";
import { clearSession } from "@/web/lib/session";
import { fileToDataUrl } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import { Separator } from "@/web/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import type { CampaignContext } from "./types";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 130, damping: 18 } },
};

export function CampaignSettingsPage() {
  const { campaign, refresh, session } = useOutletContext<CampaignContext>();
  const navigate = useNavigate();
  const isHost = session.role === "host";
  const [name, setName] = useState(campaign.name);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setName(campaign.name);
  }, [campaign.name]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");
    try {
      await api.updateCampaign(campaign.id, trimmed);
      await refresh();
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign() {
    await api.deleteCampaign(campaign.id);
    clearSession();
    navigate("/");
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-lg overflow-y-auto px-6 py-8">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="font-display text-glow text-lg font-semibold text-accent">
            Configurações da campanha
          </h1>
          <p className="text-xs text-muted-foreground">
            Preferências desta mesa. As configurações do app (LiveKit) ficam em Configurações, no menu do seu perfil.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="card-ornate rounded-xl p-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input
                id="campaign-name"
                value={name}
                maxLength={64}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void save()}
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button
              variant="gold"
              onClick={() => void save()}
              disabled={saving || !name.trim() || name.trim() === campaign.name}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : savedOk ? <Check className="size-4" /> : <Save className="size-4" />}
              Salvar
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
            {savedOk && !error && <p className="text-sm text-success">Nome atualizado.</p>}
          </div>
        </motion.div>

        {isHost && <CampaignBackgroundsSection campaignId={campaign.id} />}

        {isHost && <StreamingSection campaignId={campaign.id} />}

        <motion.div variants={itemVariants} className="card-ornate rounded-xl border-danger/30 p-6">
          <p className="font-display text-sm font-semibold text-danger">Zona de perigo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Excluir a campanha remove todos os canais, mensagens e perfis. Esta ação não pode ser desfeita.
          </p>
          <Separator className="my-4" />
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            Excluir campanha
          </Button>
        </motion.div>
      </motion.div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir campanha"
        description={`Excluir "${campaign.name}"? Todos os canais, mensagens e perfis serão removidos permanentemente.`}
        onConfirm={deleteCampaign}
      />
    </div>
  );
}

function CampaignBackgroundsSection({ campaignId }: { campaignId: string }) {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api
      .listCampaignBackgrounds(campaignId)
      .then(setBackgrounds)
      .catch(() => {});
  }, [campaignId]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const dataUrl = await fileToDataUrl(file);
      const name = file.name.replace(/\.[^.]+$/, "").trim() || "Fundo";
      const uploaded = await api.uploadCampaignBackground(campaignId, name, dataUrl);
      setBackgrounds((prev) => [...prev, uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o fundo.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteCampaignBackground(campaignId, id);
      setBackgrounds((prev) => prev.filter((b) => b.id !== id));
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div variants={itemVariants} className="card-ornate rounded-xl p-6">
      <p className="font-display text-sm font-semibold text-accent">Fundos da campanha</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Imagens oferecidas aos jogadores como fundo virtual na hora de ligar a câmera.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {backgrounds.map((bg) => (
          <div key={bg.id} className="group relative overflow-hidden rounded-lg border border-accent/15">
            <img src={bg.url} alt={bg.name} className="aspect-video w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white/90">
              {bg.name}
            </span>
            <button
              type="button"
              onClick={() => void remove(bg.id)}
              aria-label={`Remover ${bg.name}`}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white/80 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      {backgrounds.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nenhum fundo cadastrado.</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline-gold" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Enviar fundo
        </Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = "";
        }}
      />
    </motion.div>
  );
}

const STREAM_MODE_OPTIONS: { value: StreamDisplayMode; label: string }[] = [
  { value: "player", label: "Nome do jogador" },
  { value: "character", label: "Nome do personagem" },
  { value: "both", label: "Jogador · Personagem" },
];

function StreamingSection({ campaignId }: { campaignId: string }) {
  const [mode, setMode] = useState<StreamDisplayMode>("both");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .getCampaignSettings(campaignId)
      .then((s) => setMode(s.streamDisplayMode))
      .catch(() => {});
  }, [campaignId]);

  async function save(next: StreamDisplayMode) {
    setMode(next);
    setSaving(true);
    setError("");
    try {
      await api.updateCampaignSettings(campaignId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div variants={itemVariants} className="card-ornate rounded-xl p-6">
      <p className="font-display text-sm font-semibold text-accent">Modo streaming</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Como o nome dos participantes aparece na tela de transmissão.
      </p>
      <div className="mt-4 space-y-1.5">
        <Label>Nome exibido</Label>
        <Select value={mode} onValueChange={(v) => void save(v as StreamDisplayMode)} disabled={saving}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STREAM_MODE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </motion.div>
  );
}
