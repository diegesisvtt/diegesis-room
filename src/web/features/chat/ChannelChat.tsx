import { useEffect, useRef, useState } from "react";
import { Dices, Send, WifiOff } from "lucide-react";
import { api, wsUrl, type Message } from "@/web/lib/api";
import { displayName, loadSession } from "@/web/lib/session";
import { QUICK_DICE, rollDice } from "@/web/features/dice/dice";
import { cn, formatTime, initials } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/web/components/ui/popover";

export function ChannelChat({ channelId }: { channelId: string }) {
  const session = loadSession();
  const authorName = session ? displayName(session) : "Anônimo";
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      ws = new WebSocket(wsUrl(channelId, lastIdRef.current ?? undefined));
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

  function publish(input: { body: string; kind?: "text" | "roll"; rollJson?: string }) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "message", authorName, ...input }));
    } else {
      void api.sendMessage(channelId, { authorName, ...input }).then((msg) => {
        lastIdRef.current = msg.id;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      });
    }
  }

  function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    publish({ body });
  }

  function roll(sides: number) {
    setDiceOpen(false);
    const { result, detail } = rollDice(sides);
    publish({
      body: `${authorName} rolou ${detail}`,
      kind: "roll",
      rollJson: JSON.stringify({ sides, result, detail }),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
        <MessageList messages={messages} />
      </div>
      <div className="border-t border-border p-3">
        {!connected && (
          <p className="mb-1 flex items-center gap-1 text-[11px] text-warning">
            <WifiOff className="size-3" /> Reconectando…
          </p>
        )}
        <div className="flex items-end gap-2 rounded-md border border-input bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
          <Popover open={diceOpen} onOpenChange={setDiceOpen}>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Rolar dados" title="Rolar dados">
                <Dices className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44" side="top" align="start">
              <p className="mb-2 text-xs font-semibold">Rolagem rápida</p>
              <div className="grid grid-cols-4 gap-1">
                {QUICK_DICE.map((sides) => (
                  <Button key={sides} variant="secondary" size="sm" onClick={() => roll(sides)}>
                    d{sides}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
            placeholder="Fale com a mesa…"
            className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button size="icon" className="size-8 shrink-0" onClick={send} aria-label="Enviar">
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  );
}

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <>
      {messages.map((message) => {
        if (message.kind === "system") {
          return (
            <div key={message.id} className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              <Dices className="size-4 shrink-0 text-primary" />
              <span>{message.body}</span>
            </div>
          );
        }
        if (message.kind === "roll") {
          const roll = parseRoll(message.rollJson);
          return (
            <div key={message.id} className="flex gap-2.5">
              <Avatar name={message.authorName} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{message.authorName}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(new Date(message.createdAt))}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md text-base font-bold",
                      roll.result === 20
                        ? "bg-success/20 text-success"
                        : roll.result === 1
                          ? "bg-danger/20 text-danger"
                          : "bg-secondary text-foreground",
                    )}
                  >
                    {roll.result}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    d{roll.sides} {roll.detail ? `· ${roll.detail}` : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div key={message.id} className="flex gap-2.5">
            <Avatar name={message.authorName} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{message.authorName}</span>
                <span className="text-[10px] text-muted-foreground">{formatTime(new Date(message.createdAt))}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary-foreground">
                {message.body}
              </p>
            </div>
          </div>
        );
      })}
      {messages.length === 0 && (
        <p className="pt-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Comece a conversa!</p>
      )}
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
      {initials(name)}
    </div>
  );
}

type Roll = { sides: number; result: number; detail?: string };
function parseRoll(json: string | null): Roll {
  if (!json) return { sides: 20, result: 0 };
  try {
    const parsed = JSON.parse(json) as Roll;
    return { sides: parsed.sides ?? 20, result: parsed.result ?? 0, detail: parsed.detail };
  } catch {
    return { sides: 20, result: 0 };
  }
}
