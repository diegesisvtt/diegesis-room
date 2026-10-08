import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Radio, Save } from "lucide-react";
import { api, type LiveKitSettings } from "@/web/lib/api";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 130, damping: 18 } },
};

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<LiveKitSettings | null>(null);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const savedOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void api.getLiveKitSettings().then((s) => {
      setSettings(s);
      setUrl(s.url);
      setApiKey(s.apiKey);
    });
  }, []);

  useEffect(
    () => () => {
      if (savedOkTimer.current) clearTimeout(savedOkTimer.current);
    },
    [],
  );

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const result = await api.saveLiveKitSettings({
        url,
        apiKey,
        ...(apiSecret.trim() ? { apiSecret: apiSecret.trim() } : {}),
      });
      setSettings(result);
      setApiSecret("");
      setNoticeError(false);
      setNotice(result.configured ? "Configuração salva e validada. Modo ao vivo ativo." : "Configuração salva.");
      setSavedOk(true);
      if (savedOkTimer.current) clearTimeout(savedOkTimer.current);
      savedOkTimer.current = setTimeout(() => setSavedOk(false), 2000);
    } catch (err) {
      setNoticeError(true);
      setNotice(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-full overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent_55%)]"
      />
      <div aria-hidden className="map-grid pointer-events-none absolute inset-0 opacity-30" />

      <header className="relative z-10 flex items-center gap-3 border-b border-border-gold/40 bg-background/60 px-6 py-4 backdrop-blur-sm">
        <Button asChild variant="ghost" size="icon">
          <button onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </button>
        </Button>
        <div>
          <h1 className="font-display text-glow text-lg font-semibold text-accent">Configurações do app</h1>
          <p className="text-xs text-muted-foreground">Áudio e vídeo da mesa (LiveKit) — vale para todas as campanhas</p>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-lg px-6 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="card-ornate rounded-xl p-6"
        >
          <motion.div variants={itemVariants} className="mb-5 flex items-center gap-3">
            <div
              className={
                settings?.configured
                  ? "animate-glow-pulse flex size-10 items-center justify-center rounded-full border border-accent/40 bg-accent/10"
                  : "flex size-10 items-center justify-center rounded-full border border-border bg-secondary"
              }
            >
              <Radio className={settings?.configured ? "size-5 text-accent" : "size-5 text-muted-foreground"} />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">
                {settings?.configured ? "LiveKit configurado" : "LiveKit não configurado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {settings?.configured
                  ? "Sessões reais de áudio/vídeo ativas."
                  : "Configure as credenciais para ativar sessões de áudio/vídeo."}
              </p>
            </div>
          </motion.div>

          <div className="space-y-4">
            <motion.div variants={itemVariants} className="space-y-1.5">
              <Label htmlFor="lk-url">URL do servidor LiveKit</Label>
              <Input
                id="lk-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="wss://exemplo.livekit.cloud ou http://192.168.0.10:7880"
              />
              <p className="text-xs text-muted-foreground">
                Self-hosted (Docker) ou LiveKit Cloud — ambos funcionam.
              </p>
            </motion.div>
            <motion.div variants={itemVariants} className="space-y-1.5">
              <Label htmlFor="lk-key">API Key</Label>
              <Input id="lk-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </motion.div>
            <motion.div variants={itemVariants} className="space-y-1.5">
              <Label htmlFor="lk-secret">API Secret</Label>
              <Input
                id="lk-secret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={settings?.hasSecret ? "•••••••• (definido — deixe em branco para manter)" : ""}
              />
            </motion.div>
          </div>

          <motion.div variants={itemVariants} className="mt-6 flex items-center gap-3">
            <Button variant="gold" onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : savedOk ? (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <Check className="size-4" />
                </motion.span>
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
            <AnimatePresence mode="wait">
              {notice && (
                <motion.p
                  key={notice}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={noticeError ? "text-sm text-danger" : "text-sm text-success"}
                >
                  {notice}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-4 text-xs text-muted-foreground"
        >
          Dica: para self-hosted, rode <code className="rounded bg-secondary px-1 py-0.5">livekit-server --dev</code> ou o
          container Docker e aponte a URL para a máquina da mesa. As credenciais ficam armazenadas localmente no SQLite.
        </motion.p>
      </div>
    </main>
  );
}
