import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Plus, TriangleAlert, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { api, type Background } from "@/web/lib/api";
import {
  cameraQualityResolutions,
  usePreferences,
  type CameraBackground,
  type CameraQuality,
} from "@/web/lib/preferences";
import { devicesOfKind, useMediaDevices } from "@/web/lib/mediaDevices";
import { peekProfileToken } from "@/web/lib/session";
import { createBackgroundPipeline, type BackgroundPipeline } from "./backgroundPipeline";
import { cn, fileToDataUrl } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/web/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";

const SOLID_COLORS: { color: string; name: string }[] = [
  { color: "#0a0a0a", name: "Preto" },
  { color: "#27272a", name: "Cinza" },
  { color: "#1e3a5f", name: "Azul" },
  { color: "#14532d", name: "Verde" },
  { color: "#4c1d95", name: "Roxo" },
  { color: "#7c2d12", name: "Marrom" },
  { color: "#ffffff", name: "Branco" },
];

function sameBackground(a: CameraBackground, b: CameraBackground): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "color" && b.mode === "color") return a.color === b.color;
  if (a.mode === "image" && b.mode === "image") {
    return a.imageId === b.imageId && a.campaign === b.campaign;
  }
  return true;
}

export function VideoSettingsDialog({
  open,
  onOpenChange,
  campaignId,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  onApply: (opts: { deviceId: string; quality: CameraQuality; background: CameraBackground }) => Promise<void> | void;
}) {
  const prefs = usePreferences();
  const { devices } = useMediaDevices();

  const [deviceId, setDeviceId] = useState(prefs.cameraDeviceId);
  const [quality, setQuality] = useState<CameraQuality>(prefs.cameraQuality);
  const [background, setBackground] = useState<CameraBackground>(prefs.cameraBackground);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userBackgrounds, setUserBackgrounds] = useState<Background[]>([]);
  const [campaignBackgrounds, setCampaignBackgrounds] = useState<Background[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");

  const previewRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoDevices = devicesOfKind(devices, "videoinput");

  // Sincroniza o estado local ao abrir (em caso de preferências alteradas fora).
  useEffect(() => {
    if (open) {
      setDeviceId(prefs.cameraDeviceId);
      setQuality(prefs.cameraQuality);
      setBackground(prefs.cameraBackground);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Carrega os fundos disponíveis (do usuário e da campanha) ao abrir.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { user } = await api.me().catch(() => ({ user: null }));
      if (cancelled) return;
      setIsLoggedIn(Boolean(user));
      if (user) {
        const list = await api.listUserBackgrounds().catch(() => []);
        if (!cancelled) setUserBackgrounds(list);
      }
      const campaign = await api
        .listCampaignBackgrounds(campaignId, peekProfileToken(campaignId))
        .catch(() => []);
      if (!cancelled) setCampaignBackgrounds(campaign);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, campaignId]);

  // Pré-visualização ao vivo: pipeline de fundo com o dispositivo/qualidade atuais.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let pipeline: BackgroundPipeline | null = null;
    const videoEl = previewRef.current;
    setPreviewState("loading");
    setError(null);

    void (async () => {
      const res = cameraQualityResolutions[quality];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : {}),
            width: res.width,
            height: res.height,
          },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        pipeline = await createBackgroundPipeline({
          stream,
          background,
          width: res.width,
          height: res.height,
        });
        if (cancelled) {
          pipeline.stop();
          return;
        }
        if (videoEl) videoEl.srcObject = new MediaStream([pipeline.track]);
        setPreviewState("ready");
      } catch (err) {
        if (!cancelled) {
          setPreviewState("error");
          setError(err instanceof Error ? err.message : "Não foi possível acessar a câmera.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pipeline) pipeline.stop();
      if (videoEl) videoEl.srcObject = null;
    };
  }, [open, deviceId, quality, background]);

  async function apply() {
    setApplying(true);
    setError(null);
    try {
      await onApply({ deviceId, quality, background });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ligar a câmera.");
    } finally {
      setApplying(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const name = file.name.replace(/\.[^.]+$/, "").trim() || "Fundo";
      const uploaded = await api.uploadUserBackground(name, dataUrl);
      setUserBackgrounds((prev) => [...prev, uploaded]);
      setBackground({ mode: "image", imageId: uploaded.id, imageUrl: uploaded.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o fundo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-accent" /> Configurar vídeo
          </DialogTitle>
          <DialogDescription>
            Escolha a câmera, a qualidade e o fundo antes de entrar com vídeo.
          </DialogDescription>
        </DialogHeader>

        {/* Pré-visualização */}
        <div className="relative aspect-video overflow-hidden rounded-xl border border-accent/20 bg-black shadow-[var(--shadow-card)]">
          <video ref={previewRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {previewState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="size-8 animate-spin text-accent" />
            </div>
          )}
          {previewState === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
              <TriangleAlert className="size-8 text-warning" />
              <p className="text-sm text-muted-foreground">
                Não foi possível acessar a câmera. Verifique as permissões ou escolha outro dispositivo.
              </p>
            </div>
          )}
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
            Pré-visualização
          </span>
        </div>

        {/* Dispositivo + qualidade */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-display text-xs font-semibold uppercase tracking-wide text-accent">Câmera</label>
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger aria-label="Câmera">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão do sistema</SelectItem>
                {videoDevices.map((d, i) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label || `Câmera ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="font-display text-xs font-semibold uppercase tracking-wide text-accent">
              Qualidade da transmissão
            </label>
            <Select value={quality} onValueChange={(q) => setQuality(q as CameraQuality)}>
              <SelectTrigger aria-label="Qualidade da transmissão">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(cameraQualityResolutions) as CameraQuality[]).map((q) => (
                  <SelectItem key={q} value={q}>
                    {cameraQualityResolutions[q].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fundo */}
        <div className="space-y-2">
          <label className="font-display text-xs font-semibold uppercase tracking-wide text-accent">Fundo</label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <BackgroundThumb
              label="Nenhum"
              selected={sameBackground(background, { mode: "none" })}
              onClick={() => setBackground({ mode: "none" })}
            >
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary to-muted">
                <Camera className="size-6 text-muted-foreground" />
              </div>
            </BackgroundThumb>

            <BackgroundThumb
              label="Desfoque"
              selected={sameBackground(background, { mode: "blur" })}
              onClick={() => setBackground({ mode: "blur" })}
            >
              <div className="relative h-full w-full overflow-hidden bg-accent/20">
                <div className="absolute -inset-4 bg-[radial-gradient(circle_at_30%_30%,rgba(255,215,150,0.8),transparent_55%)] blur-md" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-accent">
                  Blur
                </div>
              </div>
            </BackgroundThumb>

            {SOLID_COLORS.map(({ color, name }) => (
              <BackgroundThumb
                key={color}
                label={name}
                selected={sameBackground(background, { mode: "color", color })}
                onClick={() => setBackground({ mode: "color", color })}
              >
                <div className="h-full w-full" style={{ backgroundColor: color }} />
              </BackgroundThumb>
            ))}

            {userBackgrounds.map((bg) => (
              <BackgroundThumb
                key={bg.id}
                label={bg.name}
                selected={sameBackground(background, { mode: "image", imageId: bg.id, imageUrl: bg.url })}
                onClick={() => setBackground({ mode: "image", imageId: bg.id, imageUrl: bg.url })}
              >
                <img src={bg.url} alt={bg.name} className="h-full w-full object-cover" />
              </BackgroundThumb>
            ))}

            {campaignBackgrounds.map((bg) => (
              <BackgroundThumb
                key={bg.id}
                label={bg.name}
                selected={sameBackground(background, { mode: "image", imageId: bg.id, imageUrl: bg.url, campaign: true })}
                onClick={() => setBackground({ mode: "image", imageId: bg.id, imageUrl: bg.url, campaign: true })}
              >
                <img src={bg.url} alt={bg.name} className="h-full w-full object-cover" />
              </BackgroundThumb>
            ))}

            {isLoggedIn && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex aspect-video flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-accent/40 text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                <span className="text-[10px]">Enviar</span>
              </button>
            )}
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
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="gold" onClick={() => void apply()} disabled={previewState === "error" || applying}>
            {applying ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Ligar câmera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BackgroundThumb({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      title={label}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-lg border bg-secondary transition-all duration-150",
        selected
          ? "border-accent shadow-[var(--shadow-glow-gold)] ring-1 ring-accent"
          : "border-accent/15 hover:border-accent/50",
      )}
    >
      {children}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-0.5 pt-3 text-left text-[9px] font-medium text-white/90">
        {label}
      </span>
    </motion.button>
  );
}
