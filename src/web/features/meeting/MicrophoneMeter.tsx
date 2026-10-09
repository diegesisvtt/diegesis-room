import { useEffect, useRef, useState } from "react";
import { MicOff } from "lucide-react";
import { cn } from "@/web/lib/utils";

const SEGMENTS = 36;
const SPEECH_THRESHOLD = 0.06;
const INACTIVE_BG = "rgba(148, 163, 184, 0.14)";

// Curva de cor do medidor: verde (suave) → âmbar (médio) → vermelho (alto).
const STOPS: { t: number; rgb: [number, number, number] }[] = [
  { t: 0, rgb: [52, 211, 153] },
  { t: 0.55, rgb: [245, 166, 35] },
  { t: 1, rgb: [248, 113, 113] },
];

function segmentColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  let lo = STOPS[0]!;
  let hi = STOPS[STOPS.length - 1]!;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]!;
    const b = STOPS[i + 1]!;
    if (x >= a.t && x <= b.t) {
      lo = a;
      hi = b;
      break;
    }
  }
  const k = hi.t === lo.t ? 0 : (x - lo.t) / (hi.t - lo.t);
  return [
    Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * k),
    Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * k),
    Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * k),
  ];
}

function micError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") return "Permissão do microfone negada pelo navegador.";
    if (err.name === "NotReadableError") return "Microfone em uso por outro aplicativo.";
    if (err.name === "OverconstrainedError" || err.name === "NotFoundError") return "Microfone não encontrado.";
  }
  return "Não foi possível acessar o microfone.";
}

export function MicrophoneMeter({ deviceId, className }: { deviceId: string; className?: string }) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const peakRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "listening" | "error">("idle");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;
    let level = 0;
    let peak = 0;
    let wasSpeaking = false;

    setStatus("idle");
    setSpeaking(false);
    setError(null);

    const constraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      ...(deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : {}),
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError("Seu navegador não suporta captura de áudio.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx = new AudioContext();
        await ctx.resume();
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        data = new Uint8Array(analyser.fftSize);
        if (!disposed) setStatus("listening");
        loop();
      } catch (err) {
        if (disposed) return;
        setStatus("error");
        setError(micError(err));
      }
    }

    function loop() {
      if (disposed || !analyser || !data) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = ((data[i] ?? 128) - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const target = Math.min(1, rms * 2.6);
      level = target > level ? level + (target - level) * 0.5 : level + (target - level) * 0.16;
      peak = level > peak ? level : Math.max(level, peak - 0.005);

      for (let i = 0; i < SEGMENTS; i++) {
        const bar = barsRef.current[i];
        if (!bar) continue;
        const t = i / (SEGMENTS - 1);
        const active = t <= level;
        if (active) {
          const [r, g, b] = segmentColor(t);
          bar.style.background = `rgb(${r}, ${g}, ${b})`;
          bar.style.boxShadow = `0 0 7px rgba(${r}, ${g}, ${b}, 0.55)`;
          bar.style.opacity = "1";
        } else {
          bar.style.background = INACTIVE_BG;
          bar.style.boxShadow = "none";
          bar.style.opacity = "0.4";
        }
      }

      if (peakRef.current) {
        peakRef.current.style.left = `${Math.max(0, Math.min(100, peak * 100))}%`;
        peakRef.current.style.opacity = peak > 0.02 ? "1" : "0";
      }

      const nowSpeaking = level > SPEECH_THRESHOLD;
      if (nowSpeaking !== wasSpeaking) {
        wasSpeaking = nowSpeaking;
        setSpeaking(nowSpeaking);
      }

      raf = requestAnimationFrame(loop);
    }

    void start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
    };
  }, [deviceId]);

  return (
    <div className={cn("rounded-xl border border-accent/15 bg-secondary/40 p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Nível de entrada
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              speaking ? "animate-pulse-dot bg-success shadow-[0_0_6px_var(--color-success)]" : "bg-muted-foreground/40",
            )}
          />
          {status === "error"
            ? "Indisponível"
            : status === "listening"
              ? speaking
                ? "Captando"
                : "Aguardando voz"
              : "Iniciando…"}
        </span>
      </div>

      {status === "error" ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <MicOff className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="relative flex h-9 items-end gap-[3px] overflow-hidden">
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <div
              key={i}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className="flex-1 rounded-full"
              style={{ height: `${6 + (i / (SEGMENTS - 1)) * 26}px`, background: INACTIVE_BG, opacity: 0.4 }}
            />
          ))}
          <div
            ref={peakRef}
            className="pointer-events-none absolute bottom-0 top-0 w-[2px] rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.7)]"
            style={{ opacity: 0 }}
          />
        </div>
      )}
    </div>
  );
}
