import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Loader2, Save, Trash2 } from "lucide-react";
import { api } from "@/web/lib/api";
import { clearSession } from "@/web/lib/session";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import { Separator } from "@/web/components/ui/separator";
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
  const { campaign, refresh } = useOutletContext<CampaignContext>();
  const navigate = useNavigate();
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
