import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Dices, ImagePlus, Loader2, Send, WifiOff, X } from "lucide-react";
import { api, wsUrl, type Message } from "@/web/lib/api";
import { displayName, loadSession, peekProfileToken } from "@/web/lib/session";
import { animateRoll, parseRollPayload, rollFormula } from "@/web/features/dice/diceBox";
import { getPreferences } from "@/web/lib/preferences";
import { DiceRoller } from "@/web/features/dice/DiceRoller";
import { fileToImageDataUrl } from "@/web/lib/image";
import { cn, formatTime, initials } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";

export function ChannelChat({ channelId }: { channelId: string }) {
  const session = loadSession();
  const authorName = session ? displayName(session) : "Anônimo";
  const profileToken = session ? peekProfileToken(session.campaignId) : undefined;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    setMessages([]);
    lastIdRef.current = null;

    function append(message: Message) {
      lastIdRef.current = message.id;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    }

    function connect() {
      ws = new WebSocket(wsUrl(channelId, lastIdRef.current ?? undefined, profileToken));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        let data: { type?: string; messages?: Message[]; message?: Message };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === "history" && data.messages) {
          for (const message of data.messages) append(message);
        } else if (data.type === "message" && data.message) {
          append(data.message);
          // Rola os dados 3D das rolagens de outros participantes (se habilitado).
          if (
            data.message.kind === "roll" &&
            data.message.authorName !== authorName &&
            getPreferences().showOthersRolls
          ) {
            void animateRoll(parseRollPayload(data.message.rollJson));
          }
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) reconnect = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      disposed = true;
      if (reconnect) clearTimeout(reconnect);
      ws?.close();
      wsRef.current = null;
    };
  }, [channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function publish(input: { body: string; kind?: "text" | "roll" | "image"; rollJson?: string; image?: string }) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "message", authorName, ...input }));
    } else {
      void api.sendMessage(channelId, { authorName, profileToken, ...input }).then((msg) => {
        lastIdRef.current = msg.id;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      });
    }
  }

  function send() {
    const body = draft.trim();
    if (pendingImage) {
      const image = pendingImage;
      setDraft("");
      setPendingImage(null);
      publish({ body, kind: "image", image });
      return;
    }
    if (!body) return;
    const formula = parseRollCommand(body);
    if (formula !== null) {
      setDraft("");
      void roll(formula);
      return;
    }
    setDraft("");
    publish({ body });
  }

  async function roll(source: string) {
    setRolling(true);
    setError(null);
    try {
      const payload = await rollFormula(source);
      publish({
        body: `${authorName} rolou ${payload.formula}`,
        kind: "roll",
        rollJson: JSON.stringify(payload),
      });
    } catch (err) {
      setError(`Não consegui rolar "${source}": ${errorMessage(err)}`);
    } finally {
      setRolling(false);
    }
  }

  async function attachImage(file: File) {
    setPreparingImage(true);
    setError(null);
    try {
      const dataUrl = await fileToImageDataUrl(file);
      setPendingImage(dataUrl);
    } catch (err) {
      setError(`Não consegui anexar a imagem: ${errorMessage(err)}`);
    } finally {
      setPreparingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-card">
      <div aria-hidden className="map-grid pointer-events-none absolute inset-0 opacity-20" />
      <div ref={scrollRef} className="no-scrollbar relative flex-1 space-y-2.5 overflow-y-auto p-4">
        <MessageList messages={messages} currentAuthor={authorName} />
      </div>
      <div className="border-t border-accent/15 bg-card/60 p-3 backdrop-blur-sm">
        {!connected && (
          <p className="mb-1 flex items-center gap-1 text-[11px] text-warning">
            <WifiOff className="size-3" /> Reconectando…
          </p>
        )}
        {error && (
          <p className="mb-1 text-[11px] text-danger">{error}</p>
        )}
        <div className="rounded-md border border-input bg-muted/60 p-2 transition-all focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/50 focus-within:shadow-[var(--shadow-glow-gold)]">
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2.5 rounded-md border border-accent/20 bg-muted/40 p-1.5">
              <div className="relative shrink-0">
                <img
                  src={pendingImage}
                  alt="Imagem anexada"
                  className="h-16 w-16 rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  aria-label="Remover imagem"
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-white shadow hover:bg-danger/90"
                >
                  <X className="size-3" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Imagem anexada — adicione uma legenda (opcional) e envie.
              </p>
            </div>
          )}
          <div className="flex items-end gap-2">
            <DiceRoller rolling={rolling} onRoll={(formula) => void roll(formula)} />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void attachImage(file);
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="group size-8 shrink-0 hover:text-accent"
              aria-label="Anexar imagem"
              title="Anexar imagem"
              disabled={rolling || preparingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              {preparingImage ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4 transition-transform duration-200 group-hover:scale-110" />
              )}
            </Button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={pendingImage ? "Adicionar legenda…" : "Fale com a mesa…"}
              className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              size="icon"
              variant="gold"
              className="size-8 shrink-0"
              onClick={send}
              aria-label="Enviar"
              disabled={rolling}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Enter para enviar · Shift+Enter para nova linha · /r ou /roll para rolar (ex.: /roll 2d6+3)
        </p>
      </div>
    </div>
  );
}

export function MessageList({ messages, currentAuthor }: { messages: Message[]; currentAuthor?: string }) {
  const mountTimeRef = useRef(Date.now());
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      {messages.map((message) => {
        const isNew = new Date(message.createdAt).getTime() >= mountTimeRef.current;
        const isRoll = message.kind === "roll";
        return (
          <motion.div
            key={message.id}
            initial={isNew ? { opacity: 0, y: 12, ...(isRoll ? { scale: 0.92 } : {}) } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              isRoll
                ? { type: "spring", stiffness: 380, damping: 26 }
                : { duration: 0.3, ease: "easeOut" }
            }
          >
            <MessageRow
              message={message}
              animateRoll={isNew}
              isOwn={message.authorName === currentAuthor}
              onOpenImage={setLightbox}
            />
          </motion.div>
        );
      })}
      {messages.length === 0 && (
        <p className="pt-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Comece a conversa!</p>
      )}
      {lightbox && (
        <ImageLightbox
          src={lightbox}
          alt="Imagem do chat"
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

function MessageRow({
  message,
  animateRoll,
  isOwn,
  onOpenImage,
}: {
  message: Message;
  animateRoll: boolean;
  isOwn: boolean;
  onOpenImage: (url: string) => void;
}) {
  if (message.kind === "system") {
    return (
      <div className="flex justify-center py-1">
        <p className="flex items-center gap-2 rounded-full border border-accent/15 bg-muted/70 px-3.5 py-1 text-xs italic text-muted-foreground shadow-sm">
          <span className="size-1.5 shrink-0 rotate-45 bg-accent/70" />
          {message.body}
        </p>
      </div>
    );
  }

  const time = formatTime(new Date(message.createdAt));
  const bubble = cn(
    "relative max-w-[78%] rounded-2xl px-3.5 py-2 shadow-[0_2px_10px_rgb(0_0_0/0.35)] sm:max-w-[65%]",
    isOwn
      ? "rounded-br-md border border-accent/35 bg-accent/15"
      : "rounded-bl-md border border-border bg-muted",
  );

  if (message.kind === "roll") {
    const roll = parseRoll(message.rollJson);
    const total = typeof roll.total === "boolean" ? String(roll.total) : roll.total;
    const isCrit = total === 20;
    const isFumble = total === 1;
    return (
      <div className="flex justify-center py-1.5">
        <div
          className={cn(
            "card-ornate relative w-full max-w-xs overflow-hidden rounded-xl px-5 pb-3 pt-4 text-center",
            isCrit && "border-success/40 shadow-[0_0_28px_rgba(61,220,151,0.25)]",
            isFumble && "border-danger/40 shadow-[0_0_28px_rgba(248,113,113,0.25)]",
          )}
        >
          {/* cantos ornamentais */}
          <span aria-hidden className="pointer-events-none absolute left-1.5 top-1.5 size-2.5 border-l border-t border-accent/50" />
          <span aria-hidden className="pointer-events-none absolute right-1.5 top-1.5 size-2.5 border-r border-t border-accent/50" />
          <span aria-hidden className="pointer-events-none absolute bottom-1.5 left-1.5 size-2.5 border-b border-l border-accent/50" />
          <span aria-hidden className="pointer-events-none absolute bottom-1.5 right-1.5 size-2.5 border-b border-r border-accent/50" />

          <div className="flex items-center justify-center gap-2">
            <Dices className="size-3.5 text-accent" />
            <p className="text-xs font-semibold tracking-wide text-foreground/90">
              {message.authorName} <span className="font-normal text-muted-foreground">rolou</span>
            </p>
          </div>

          {roll.formula && (
            <p className="mt-1 font-mono text-sm font-medium text-accent">{roll.formula}</p>
          )}

          <div className="mt-2 flex items-center justify-center gap-3">
            <span aria-hidden className="h-px w-8 bg-gradient-to-r from-transparent to-accent/50" />
            <span
              className={cn(
                "font-display text-4xl font-bold leading-none",
                isCrit
                  ? "animate-pulse text-success drop-shadow-[0_0_18px_rgba(61,220,151,0.7)]"
                  : isFumble
                    ? "animate-pulse text-danger drop-shadow-[0_0_18px_rgba(248,113,113,0.7)]"
                    : "text-glow text-gold-bright",
              )}
            >
              {typeof total === "number" ? <CountUp value={total} active={animateRoll} /> : total}
            </span>
            <span aria-hidden className="h-px w-8 bg-gradient-to-l from-transparent to-accent/50" />
          </div>

          {isCrit && (
            <p className="mt-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-success">
              Acerto crítico
            </p>
          )}
          {isFumble && (
            <p className="mt-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-danger">
              Falha crítica
            </p>
          )}

          {roll.detail && <p className="mt-1 text-xs text-muted-foreground">{roll.detail}</p>}
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">{time}</p>
        </div>
      </div>
    );
  }

  if (message.kind === "image") {
    return (
      <div className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}>
        <Avatar name={message.authorName} />
        <div className={cn(bubble, "overflow-hidden p-1.5")}>
          {message.imageUrl ? (
            <button
              type="button"
              onClick={() => onOpenImage(message.imageUrl!)}
              className="block cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              aria-label="Ampliar imagem"
            >
              <img
                src={message.imageUrl}
                alt={message.body || `Imagem enviada por ${message.authorName}`}
                loading="lazy"
                className="max-h-80 w-auto max-w-full rounded-lg object-contain"
              />
            </button>
          ) : (
            <p className="px-2 py-4 text-sm text-muted-foreground">Imagem indisponível</p>
          )}
          {!isOwn && <p className="px-1.5 pt-1 text-xs font-semibold text-accent">{message.authorName}</p>}
          {message.body && (
            <p className="whitespace-pre-wrap break-words px-1.5 pt-0.5 text-sm leading-relaxed text-foreground/95">
              {message.body}
            </p>
          )}
          <p className="px-1.5 pt-1 text-right text-[10px] text-muted-foreground/80">{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}>
      <Avatar name={message.authorName} />
      <div className={bubble}>
        {!isOwn && <p className="mb-0.5 text-xs font-semibold text-accent">{message.authorName}</p>}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/95">
          {message.body}
        </p>
        <p className="mt-0.5 text-right text-[10px] text-muted-foreground/80">{time}</p>
      </div>
    </div>
  );
}

function CountUp({ value, active }: { value: number; active: boolean }) {
  const motionValue = useMotionValue(active ? 0 : value);
  const rounded = useTransform(motionValue, (v) => String(Math.round(v)));

  useEffect(() => {
    if (!active) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    return () => controls.stop();
  }, [value, active, motionValue]);

  return <motion.span>{rounded}</motion.span>;
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-muted text-[10px] font-bold text-gold-bright">
      {initials(name)}
    </div>
  );
}

/** Visualizador de imagem em tela cheia: clique em qualquer lugar ou Esc para fechar. */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/50 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
      >
        <X className="size-5" />
      </button>
      <motion.img
        src={src}
        alt={alt}
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
    </motion.div>
  );
}

type Roll = { formula?: string; total: number | boolean; detail?: string };
function parseRoll(json: string | null): Roll {
  if (!json) return { total: 0 };
  try {
    const parsed = JSON.parse(json) as Roll & { sides?: number; result?: number };
    if (typeof parsed.total === "number" || typeof parsed.total === "boolean") {
      return { formula: parsed.formula, total: parsed.total, detail: parsed.detail };
    }
    return {
      formula: parsed.sides ? `d${parsed.sides}` : undefined,
      total: parsed.result ?? 0,
      detail: parsed.detail,
    };
  } catch {
    return { total: 0 };
  }
}

function parseRollCommand(input: string): string | null {
  const match = /^\/(?:r|roll)\s+(.+)$/i.exec(input);
  if (!match) return null;
  const formula = match[1]?.trim();
  return formula ? formula : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "erro desconhecido";
}
