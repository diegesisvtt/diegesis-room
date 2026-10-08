import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, Loader2 } from "lucide-react";
import { api } from "@/web/lib/api";
import { setAuthUser, useAuth } from "./useAuth";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import { EmberParticles } from "@/web/components/EmberParticles";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  async function submit() {
    setError("");
    if (newPassword !== confirm) {
      setError("As senhas novas não coincidem");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      const refreshed = await refresh();
      setAuthUser(refreshed);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a senha");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && confirm.length >= 8;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div aria-hidden className="map-grid absolute inset-0 opacity-40" />
      <EmberParticles count={22} />
      <div aria-hidden className="vignette pointer-events-none absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="card-ornate relative z-10 w-full max-w-sm rounded-xl p-7"
      >
        <div className="mb-1 flex justify-center">
          <div className="animate-glow-pulse flex size-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
            <KeyRound className="size-7" />
          </div>
        </div>
        <h1 className="font-display text-glow gold-shimmer-text text-center text-2xl font-bold tracking-wide">
          Troque sua senha
        </h1>
        <p className="mt-1 mb-6 text-center text-xs tracking-widest text-muted-foreground uppercase">
          Obrigatório no primeiro acesso com senha temporária
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current">Senha atual (temporária)</Label>
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">Nova senha</Label>
            <Input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && void submit()}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <Button
          variant="gold"
          size="lg"
          className="mt-5 w-full text-base"
          disabled={saving || !canSubmit}
          onClick={() => void submit()}
        >
          {saving ? <Loader2 className="size-5 animate-spin" /> : null}
          Salvar nova senha
        </Button>
      </motion.div>
    </main>
  );
}
