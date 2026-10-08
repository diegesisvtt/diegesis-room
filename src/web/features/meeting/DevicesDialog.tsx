import { useEffect, useState } from "react";
import type { Room } from "livekit-client";
import { Plus, Settings, Star, Trash2, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import type { CameraQuality, HostCamera, ShareQuality } from "./useLiveKitRoom";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/web/components/ui/dialog";
import { Input } from "@/web/components/ui/input";
import { Switch } from "@/web/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";

type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

const audioFields: { kind: DeviceKind; label: string }[] = [
  { kind: "audioinput", label: "Microfone" },
  { kind: "audiooutput", label: "Saída de áudio" },
];

const list = {
  show: { transition: { staggerChildren: 0.05 } },
};
const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
} as const;

export function DevicesDialog({
  open,
  onOpenChange,
  roomRef,
  isHost = false,
  cameras = [],
  cameraErrors = {},
  spotlight = null,
  shareQuality,
  onShareQualityChange,
  onAddCamera,
  onRemoveCamera,
  onToggleCamera,
  onUpdateCamera,
  onSetSpotlight,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roomRef: React.MutableRefObject<Room | null>;
  isHost?: boolean;
  cameras?: HostCamera[];
  cameraErrors?: Record<string, string>;
  spotlight?: string | null;
  shareQuality?: ShareQuality;
  onShareQualityChange?: (quality: ShareQuality) => void;
  onAddCamera?: (name: string, deviceId: string) => void;
  onRemoveCamera?: (id: string) => void;
  onToggleCamera?: (id: string) => void;
  onUpdateCamera?: (id: string, patch: { name?: string; deviceId?: string; quality?: CameraQuality }) => void;
  onSetSpotlight?: (tile: string | null) => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [newDevice, setNewDevice] = useState("default");

  useEffect(() => {
    if (!open) return;
    if (!navigator.mediaDevices?.enumerateDevices) {
      setNotice("Dispositivos indisponíveis neste navegador.");
      return;
    }
    void navigator.mediaDevices.enumerateDevices().then(setDevices);
  }, [open]);

  const videoDevices = devices.filter((d) => d.kind === "videoinput" && d.deviceId && d.deviceId !== "default");

  async function selectDevice(kind: DeviceKind, id: string) {
    const room = roomRef.current;
    if (room && id !== "default") {
      try {
        await room.switchActiveDevice(kind, id);
      } catch {
        setNotice("Não foi possível alternar o dispositivo.");
      }
    }
    setSelected((current) => ({ ...current, [kind]: id }));
  }

  async function testSound() {
    try {
      const audio = new AudioContext();
      await audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.3);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await audio.close();
    } catch {
      setNotice("Não foi possível reproduzir o som de teste.");
    }
  }

  function addCamera() {
    const name = newName.trim();
    if (!name || !onAddCamera) return;
    onAddCamera(name, newDevice);
    setNewName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wide">
            <Settings className="size-5 text-accent" /> Áudio e vídeo
          </DialogTitle>
          <DialogDescription>Dispositivos da mesa</DialogDescription>
        </DialogHeader>

        {isHost ? (
          <div className="space-y-2">
            <label className="font-display text-sm font-semibold tracking-wide text-accent">Câmeras da mesa</label>
            <motion.div variants={list} initial="hidden" animate="show" className="space-y-2">
            {cameras.map((cam) => (
              <motion.div
                key={cam.id}
                variants={row}
                className="flex items-center gap-2 rounded-lg border border-accent/15 bg-secondary/40 p-2 shadow-[var(--shadow-card)]"
              >
                <Switch
                  checked={cam.enabled}
                  onCheckedChange={() => onToggleCamera?.(cam.id)}
                  aria-label={cam.enabled ? `Desligar ${cam.name}` : `Ligar ${cam.name}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{cam.name}</p>
                  {cameraErrors[cam.id] && <p className="text-xs text-danger">{cameraErrors[cam.id]}</p>}
                  <div className="flex gap-1">
                    <Select value={cam.deviceId} onValueChange={(id) => onUpdateCamera?.(cam.id, { deviceId: id })}>
                      <SelectTrigger aria-label={`Dispositivo de ${cam.name}`} className="h-8 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Padrão do sistema</SelectItem>
                        {videoDevices.map((device, i) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Câmera ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={cam.quality ?? "720"} onValueChange={(q) => onUpdateCamera?.(cam.id, { quality: q as CameraQuality })}>
                      <SelectTrigger aria-label={`Qualidade de ${cam.name}`} className="h-8 w-28 shrink-0 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2160">2160p (4K)</SelectItem>
                        <SelectItem value="1440">1440p</SelectItem>
                        <SelectItem value="1080">1080p (Full HD)</SelectItem>
                        <SelectItem value="720">720p (HD)</SelectItem>
                        <SelectItem value="540">540p</SelectItem>
                        <SelectItem value="360">360p</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8 shrink-0 rounded-full hover:text-accent hover:shadow-[var(--shadow-glow-gold)]",
                    spotlight === `cam:${cam.id}` && "animate-glow-pulse text-accent",
                  )}
                  aria-label={spotlight === `cam:${cam.id}` ? `Remover destaque de ${cam.name}` : `Destacar ${cam.name}`}
                  title={spotlight === `cam:${cam.id}` ? "Remover destaque" : "Destacar para todos"}
                  onClick={() => onSetSpotlight?.(spotlight === `cam:${cam.id}` ? null : `cam:${cam.id}`)}
                >
                  <Star className={cn("size-4", spotlight === `cam:${cam.id}` && "fill-accent")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 rounded-full hover:text-danger hover:shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                  aria-label={`Remover ${cam.name}`}
                  onClick={() => onRemoveCamera?.(cam.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </motion.div>
            ))}
            </motion.div>
            {cameras.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma câmera configurada. Adicione a câmera do mapa, do mestre ou de ângulos extras.</p>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome (ex.: Mapa, Mestre)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCamera();
                }}
              />
              <Select value={newDevice} onValueChange={setNewDevice}>
                <SelectTrigger aria-label="Dispositivo da nova câmera" className="w-40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão do sistema</SelectItem>
                  {videoDevices.map((device, i) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Câmera ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="gold" size="icon" className="shrink-0 rounded-full" aria-label="Adicionar câmera" onClick={addCamera} disabled={!newName.trim()}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <DeviceSelect
            kind="videoinput"
            label="Câmera"
            devices={devices}
            value={selected.videoinput || "default"}
            onSelect={(id) => void selectDevice("videoinput", id)}
          />
        )}

        {shareQuality && onShareQualityChange && (
          <div className="space-y-2">
            <label className="font-display text-sm font-semibold tracking-wide text-accent">Qualidade do compartilhamento de tela</label>
            <Select value={shareQuality} onValueChange={(q) => onShareQualityChange(q as ShareQuality)}>
              <SelectTrigger aria-label="Qualidade do compartilhamento de tela">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2160">2160p (4K) · 8 Mbps</SelectItem>
                <SelectItem value="1440">1440p · 6 Mbps</SelectItem>
                <SelectItem value="1080">1080p (Full HD) · 4 Mbps</SelectItem>
                <SelectItem value="720">720p (HD) · 2 Mbps</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Aplicada no próximo compartilhamento.</p>
          </div>
        )}

        {audioFields.map(({ kind, label }) => (
          <DeviceSelect
            key={kind}
            kind={kind}
            label={label}
            devices={devices}
            value={selected[kind] || "default"}
            onSelect={(id) => void selectDevice(kind, id)}
          />
        ))}

        <Button variant="outline-gold" className="self-start" onClick={() => void testSound()}>
          <Volume2 className="size-4" /> Testar som
        </Button>
        {notice && <p className="text-xs text-warning">{notice}</p>}
      </DialogContent>
    </Dialog>
  );
}

function DeviceSelect({
  kind,
  label,
  devices,
  value,
  onSelect,
}: {
  kind: DeviceKind;
  label: string;
  devices: MediaDeviceInfo[];
  value: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="font-display text-sm font-semibold tracking-wide text-accent">{label}</label>
      <Select value={value} onValueChange={onSelect}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Padrão do sistema</SelectItem>
          {devices
            .filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "default")
            .map((device, i) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `${label} ${i + 1}`}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
