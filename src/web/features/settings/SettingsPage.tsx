import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Radio, Save } from "lucide-react";
import { api, type LiveKitSettings } from "@/web/lib/api";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<LiveKitSettings | null>(null);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void api.getLiveKitSettings().then((s) => {
      setSettings(s);
      setUrl(s.url);
      setApiKey(s.apiKey);
    });
  }, []);

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
      setNotice(result.configured ? "Configuração salva e validada. Modo ao vivo ativo." : "Configuração salva.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-full bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button asChild variant="ghost" size="icon">
          <button onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </button>
        </Button>
        <div>
          <h1 className="font-display font-semibold">Configurações do LiveKit</h1>
          <p className="text-xs text-muted-foreground">Áudio e vídeo da mesa</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-secondary">
              <Radio className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">
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
              <p className="text-xs text-muted-foreground">
                Self-hosted (Docker) ou LiveKit Cloud — ambos funcionam.
              </p>
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
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </Button>
            {notice && <p className="text-sm text-success">{notice}</p>}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Dica: para self-hosted, rode <code className="rounded bg-secondary px-1 py-0.5">livekit-server --dev</code> ou o
          container Docker e aponte a URL para a máquina da mesa. As credenciais ficam armazenadas localmente no SQLite.
        </p>
      </div>
    </main>
  );
}
