import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, Minus, Plus, X } from "lucide-react";
import { buildFormula, QUICK_DICE, type DicePool } from "@/web/features/dice/dice";
import { cn } from "@/web/lib/utils";
import { Button } from "@/web/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/web/components/ui/popover";

export function DiceRoller({
  rolling,
  onRoll,
}: {
  rolling: boolean;
  onRoll: (formula: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<DicePool>({});
  const [modifier, setModifier] = useState(0);

  const formula = buildFormula(pool, modifier);
  const hasDice = formula !== "";

  function addDie(sides: number, delta: number) {
    setPool((prev) => {
      const next = { ...prev };
      const count = Math.max(0, (next[sides] ?? 0) + delta);
      if (count === 0) delete next[sides];
      else next[sides] = count;
      return next;
    });
  }

  function clear() {
    setPool({});
    setModifier(0);
  }

  function roll() {
    if (!hasDice || rolling) return;
    onRoll(formula);
    clear();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="group size-8 shrink-0 hover:text-accent"
          aria-label="Rolar dados"
          title="Rolar dados"
          disabled={rolling}
        >
          <Dices
            className={cn(
              "size-4 transition-transform duration-200 group-hover:rotate-12",
              rolling && "animate-spin",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="card-ornate w-64 p-4" side="top" align="start">
        {/* cantos ornamentais */}
        <span aria-hidden className="pointer-events-none absolute left-1.5 top-1.5 size-2.5 border-l border-t border-accent/50" />
        <span aria-hidden className="pointer-events-none absolute right-1.5 top-1.5 size-2.5 border-r border-t border-accent/50" />
        <span aria-hidden className="pointer-events-none absolute bottom-1.5 left-1.5 size-2.5 border-b border-l border-accent/50" />
        <span aria-hidden className="pointer-events-none absolute bottom-1.5 right-1.5 size-2.5 border-b border-r border-accent/50" />

        <p className="font-display text-xs font-semibold tracking-wide text-accent">
          Rolagem rápida
        </p>

        {/* preview da fórmula */}
        <div className="mt-1.5 flex min-h-6 items-center justify-center rounded-md border border-accent/20 bg-muted/50 px-2 py-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={formula || "empty"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="font-mono text-sm"
            >
              {hasDice ? (
                <span className="gold-shimmer-text font-medium">{formula}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Escolha os dados</span>
              )}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* grid de dados */}
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {QUICK_DICE.map((sides) => {
            const count = pool[sides] ?? 0;
            return (
              <button
                key={sides}
                type="button"
                title={`Adicionar d${sides} (clique direito remove)`}
                onClick={() => addDie(sides, 1)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  addDie(sides, -1);
                }}
                className={cn(
                  "relative flex h-10 items-center justify-center rounded-md border font-mono text-xs font-medium transition-all duration-200 active:scale-95",
                  count > 0
                    ? "border-accent/70 bg-accent/15 text-gold-bright shadow-[var(--shadow-glow-gold)]"
                    : "border-accent/25 bg-muted/40 text-accent/80 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/10 hover:text-accent hover:shadow-[var(--shadow-glow-gold)]",
                )}
              >
                d{sides}
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground shadow"
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}

          {/* stepper de modificador ocupando a célula restante */}
          <div className="col-span-1" />
        </div>

        {/* modificador */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Modificador</span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="icon"
              variant="outline-gold"
              className="size-7"
              aria-label="Diminuir modificador"
              onClick={() => setModifier((m) => m - 1)}
            >
              <Minus className="size-3" />
            </Button>
            <input
              type="number"
              value={modifier}
              onChange={(e) => setModifier(Number.parseInt(e.target.value, 10) || 0)}
              aria-label="Modificador"
              className="h-7 w-12 rounded-md border border-input bg-muted/60 text-center font-mono text-xs outline-none transition-all focus:border-accent/50 focus:ring-1 focus:ring-accent/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              size="icon"
              variant="outline-gold"
              className="size-7"
              aria-label="Aumentar modificador"
              onClick={() => setModifier((m) => m + 1)}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>

        {/* ações */}
        <div className="mt-3 flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={clear}
            disabled={!hasDice && modifier === 0}
          >
            <X className="size-3" />
            Limpar
          </Button>
          <Button
            variant="gold"
            size="sm"
            className="flex-1"
            onClick={roll}
            disabled={!hasDice || rolling}
          >
            <Dices className={cn("size-3.5", rolling && "animate-spin")} />
            Rolar
          </Button>
        </div>

        <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
          Clique para adicionar · clique direito remove
        </p>
      </PopoverContent>
    </Popover>
  );
}
