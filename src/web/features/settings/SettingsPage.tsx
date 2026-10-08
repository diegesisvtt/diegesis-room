import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clapperboard, Headphones, Loader2, Mic, MonitorUp, Palette, Radio, Save, Sparkles, Video, X } from "lucide-react";
import { api, type LiveKitSettings } from "@/web/lib/api";
import {
  setPreferences,
  shareQualityPresets,
  usePreferences,
  type CameraQuality,
  type ContentHint,
  type ShareQuality,
} from "@/web/lib/preferences";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import { Switch } from "@/web/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";

type SectionKey = "voice" | "appearance" | "livekit";

const sections: { category: string; items: { key: SectionKey; label: string; icon: typeof Mic }[] }[] = [
  {
    category: "Preferências do usuário",
    items: [
      { key: "voice", label: "Voz e vídeo", icon: Mic },
      { key: "appearance", label: "Aparência", icon: Palette },
    ],
  },
  {
    category: "Servidor",
    items: [{ key: "livekit", label: "Instância LiveKit", icon: Radio }],
  },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 160, damping: 20 } },
};

export function SettingsPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionKey>("voice");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") navigate(-1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <main className="relative flex h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent_55%)]"
      />
      <div aria-hidden className="map-grid pointer-events-none absolute inset-0 opacity-30" />

      <aside className="relative z-10 flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-gold/40 bg-background/60 px-3 py-6 backdrop-blur-sm">
        {sections.map((group) => (
          <nav key={group.category} className="space-y-1">
            <p className="font-display px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.category}
            </p>
            {group.items.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                  section === key
                    ? "bg-accent/15 font-medium text-accent shadow-[var(--shadow-glow-gold)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        ))}
      </aside>

      <div className="relative z-10 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {section === "voice" && <VoiceSection />}
              {section === "appearance" && <AppearanceSection />}
              {section === "livekit" && <LiveKitSection />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="fixed right-6 top-6 flex flex-col items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            aria-label="Fechar configurações"
            className="flex size-10 items-center justify-center rounded-full border-2 border-muted-foreground/40 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <X className="size-5" />
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Esc</span>
        </div>
      </div>
    </main>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-glow text-xl font-semibold text-accent">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Mic;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div variants={itemVariants} className="card-ornate flex items-center gap-4 rounded-xl p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
        <Icon className="size-5 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </motion.div>
  );
}

const cameraQualityLabels: Record<CameraQuality, string> = {
  "2160": "2160p (4K)",
  "1440": "1440p",
  "1080": "1080p (Full HD)",
  "720": "720p (HD)",
  "540": "540p",
  "360": "360p",
};

const contentHintLabels: Record<ContentHint, string> = {
  detail: "Detalhe (imagens e leitura)",
  text: "Texto (documentos e código)",
  motion: "Movimento (vídeo e animações)",
};

function VoiceSection() {
  const prefs = usePreferences();

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <SectionHeader
        title="Voz e vídeo"
        description="Preferências de captura e transmissão — sincronizadas com sua conta quando conectado."
      />
      <div className="space-y-3">
        <PreferenceRow icon={Mic} title="Cancelamento de eco" description="Reduz o retorno do áudio dos alto-falantes no microfone.">
          <Switch
            checked={prefs.echoCancellation}
            onCheckedChange={(v) => setPreferences({ echoCancellation: v })}
            aria-label="Cancelamento de eco"
          />
        </PreferenceRow>
        <PreferenceRow icon={Mic} title="Supressão de ruído" description="Filtra ruídos de fundo como teclado e ventoinha.">
          <Switch
            checked={prefs.noiseSuppression}
            onCheckedChange={(v) => setPreferences({ noiseSuppression: v })}
            aria-label="Supressão de ruído"
          />
        </PreferenceRow>
        <PreferenceRow icon={Mic} title="Controle automático de ganho" description="Nivela o volume da sua voz automaticamente.">
          <Switch
            checked={prefs.autoGainControl}
            onCheckedChange={(v) => setPreferences({ autoGainControl: v })}
            aria-label="Controle automático de ganho"
          />
        </PreferenceRow>
        <PreferenceRow icon={Headphones} title="Áudio estéreo" description="Captura o microfone em dois canais. Aplicado na próxima ativação do microfone.">
          <Switch
            checked={prefs.stereo}
            onCheckedChange={(v) => setPreferences({ stereo: v })}
            aria-label="Áudio estéreo"
          />
        </PreferenceRow>
        <PreferenceRow
          icon={Video}
          title="Qualidade da câmera"
          description="Resolução da sua câmera ao entrar na mesa. Aplicada na próxima ativação."
        >
          <Select value={prefs.cameraQuality} onValueChange={(q) => setPreferences({ cameraQuality: q as CameraQuality })}>
            <SelectTrigger aria-label="Qualidade da câmera" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(cameraQualityLabels) as CameraQuality[]).map((q) => (
                <SelectItem key={q} value={q}>
                  {cameraQualityLabels[q]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceRow>
        <PreferenceRow
          icon={MonitorUp}
          title="Qualidade do compartilhamento de tela"
          description="Resolução e bitrate da transmissão de tela. Aplicada no próximo compartilhamento."
        >
          <Select value={prefs.shareQuality} onValueChange={(q) => setPreferences({ shareQuality: q as ShareQuality })}>
            <SelectTrigger aria-label="Qualidade do compartilhamento de tela" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(shareQualityPresets) as ShareQuality[]).map((q) => (
                <SelectItem key={q} value={q}>
                  {shareQualityPresets[q].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceRow>
        <PreferenceRow
          icon={Clapperboard}
          title="Dica de conteúdo"
          description="Otimiza a codificação da tela conforme o que você compartilha. Aplicada no próximo compartilhamento."
        >
          <Select value={prefs.contentHint} onValueChange={(v) => setPreferences({ contentHint: v as ContentHint })}>
            <SelectTrigger aria-label="Dica de conteúdo" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(contentHintLabels) as ContentHint[]).map((h) => (
                <SelectItem key={h} value={h}>
                  {contentHintLabels[h]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceRow>
      </div>
    </motion.div>
  );
}

function AppearanceSection() {
  const prefs = usePreferences();

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <SectionHeader title="Aparência" description="Efeitos visuais da interface." />
      <div className="space-y-3">
        <PreferenceRow
          icon={Sparkles}
          title="Efeitos visuais"
          description="Partículas e animações de fundo nas telas. Desative em máquinas mais fracas."
        >
          <Switch
            checked={prefs.visualEffects}
            onCheckedChange={(v) => setPreferences({ visualEffects: v })}
            aria-label="Efeitos visuais"
          />
        </PreferenceRow>
      </div>
    </motion.div>
  );
}

function LiveKitSection() {
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
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <SectionHeader
        title="Instância LiveKit"
        description="Servidor de áudio/vídeo da instância — afeta todos os usuários deste servidor."
      />

      <motion.div variants={itemVariants} className="card-ornate rounded-xl p-6">
        <div className="mb-5 flex items-center gap-3">
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
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lk-url">URL do servidor LiveKit</Label>
            <Input
              id="lk-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://exemplo.livekit.cloud ou http://192.168.0.10:7880"
            />
            <p className="text-xs text-muted-foreground">Self-hosted (Docker) ou LiveKit Cloud — ambos funcionam.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lk-key">API Key</Label>
            <Input id="lk-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lk-secret">API Secret</Label>
            <Input
              id="lk-secret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={settings?.hasSecret ? "•••••••• (definido — deixe em branco para manter)" : ""}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
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
        </div>
      </motion.div>

      <motion.p variants={itemVariants} className="mt-4 text-xs text-muted-foreground">
        Dica: para self-hosted, rode <code className="rounded bg-secondary px-1 py-0.5">livekit-server --dev</code> ou o
        container Docker e aponte a URL para a máquina da mesa. As credenciais ficam armazenadas localmente no SQLite.
      </motion.p>
    </motion.div>
  );
}
