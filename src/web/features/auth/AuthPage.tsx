import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { api } from "@/web/lib/api";
import { getAllProfileTokens } from "@/web/lib/session";
import { setAuthUser } from "./useAuth";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import { EmberParticles } from "@/web/components/EmberParticles";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const profileTokens = getAllProfileTokens();
      const { user } =
        mode === "register"
          ? await api.register({ name: name.trim(), email: email.trim(), password, profileTokens })
          : await api.login({ email: email.trim(), password, profileTokens });
      setAuthUser(user);
      navigate(user.mustChangePassword ? "/change-password" : next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError("");
    setLoading(true);
    try {
      const { temporaryPassword } = await api.resetPassword(email.trim());
      setTemporaryPassword(temporaryPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível resetar");
    } finally {
      setLoading(false);
    }
  }

  function copyTemporary() {
    if (!temporaryPassword) return;
    void navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const canSubmit =
    email.trim().length > 3 &&
    password.length >= (mode === "register" ? 8 : 1) &&
    (mode === "login" || name.trim().length > 0);

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
            {mode === "register" ? <UserPlus className="size-7" /> : <LogIn className="size-7" />}
          </div>
        </div>
        <h1 className="font-display text-glow gold-shimmer-text text-center text-2xl font-bold tracking-wide">
          {mode === "register" ? "Criar conta" : "Entrar"}
        </h1>
        <p className="mt-1 mb-6 text-center text-xs tracking-widest text-muted-foreground uppercase">
          {mode === "register"
            ? "Seus perfis de convidado serão vinculados"
            : "Acesse suas campanhas"}
        </p>

        <div className="space-y-3">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como você aparece nas mesas"
                autoFocus
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoFocus={mode === "login"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Sua senha"}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && void submit()}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <Button
          variant="gold"
          size="lg"
          className="mt-5 w-full text-base"
          disabled={loading || !canSubmit}
          onClick={() => void submit()}
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          {mode === "register" ? "Criar conta" : "Entrar"}
        </Button>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft className="size-3" /> Início
          </Link>
          {mode === "login" ? (
            <button type="button" className="hover:text-accent" onClick={() => setResetOpen(true)}>
              Esqueci a senha
            </button>
          ) : (
            <Link to="/login" className="hover:text-accent">
              Já tenho conta
            </Link>
          )}
        </div>
        {mode === "login" && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/register" className="text-accent hover:underline">
              Cadastre-se
            </Link>
          </p>
        )}
      </motion.div>

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => { setResetOpen(false); setTemporaryPassword(null); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-ornate w-full max-w-sm rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-accent">
              <KeyRound className="size-5" />
              <h2 className="font-display text-lg font-semibold">Resetar senha</h2>
            </div>
            {temporaryPassword ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Sua senha temporária (você precisará trocá-la ao entrar):
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Input readOnly value={temporaryPassword} className="font-mono text-center text-lg" />
                  <Button size="icon" variant="secondary" onClick={copyTemporary} aria-label="Copiar senha">
                    {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <Button
                  variant="gold"
                  className="mt-4 w-full"
                  onClick={() => {
                    setPassword(temporaryPassword);
                    setResetOpen(false);
                    setTemporaryPassword(null);
                  }}
                >
                  Usar para entrar
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Informe seu email para gerar uma senha temporária.
                </p>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="mt-3"
                />
                {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                <Button
                  variant="gold"
                  className="mt-4 w-full"
                  disabled={loading || !email.trim()}
                  onClick={() => void resetPassword()}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  Gerar senha temporária
                </Button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </main>
  );
}
