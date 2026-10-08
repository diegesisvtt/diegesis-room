import type { DiceBox, DiceTerm } from "@diegesis/dice";
import { fromFormula } from "@diegesis/dice-notation";
import { evaluateRoll } from "@diegesis/dice-core";
import { describeTerms, type RollPayload } from "./dice";

let container: HTMLDivElement | null = null;
let box: DiceBox | null = null;
let boxPromise: Promise<DiceBox | null> | null = null;

const animatedIds = new Set<string>();

const CLEAR_DELAY_MS = 4000;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function cancelClearTimer() {
  if (clearTimer !== null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}

export function attachDiceContainer(el: HTMLDivElement) {
  container = el;
}

export function destroyDiceBox() {
  cancelClearTimer();
  box?.destroy();
  box = null;
  boxPromise = null;
  container = null;
  animatedIds.clear();
}

async function getBox(): Promise<DiceBox | null> {
  if (box) return box;
  if (!container) return null;
  if (!boxPromise) {
    boxPromise = (async () => {
      const { DiceBox } = await import("@diegesis/dice");
      const el = container;
      if (!el) return null;
      const instance = new DiceBox(el, {
        assetPath: "/dice/",
        theme: "default",
        environment: "none",
        shadows: "none",
        sounds: false,
        postprocessing: { enabled: false },
      });
      instance.on("error", (error) => console.error("[dice]", error));
      await instance.ready;
      box = instance;
      return instance;
    })().catch((error) => {
      boxPromise = null;
      console.error("[dice] failed to initialize", error);
      return null;
    });
  }
  return boxPromise;
}

export async function rollFormula(source: string): Promise<RollPayload> {
  const expr = fromFormula(source);
  const roll = evaluateRoll(expr);

  const { termsFromRoll } = await import("@diegesis/dice");
  const terms = termsFromRoll(expr, roll);

  const payload: RollPayload = {
    id: crypto.randomUUID(),
    formula: source.trim(),
    total: roll.value,
    detail: describeTerms(terms),
    terms,
  };

  await animateRoll(payload);
  return payload;
}

export async function animateRoll(payload: Pick<RollPayload, "id" | "terms">): Promise<void> {
  if (!payload.terms || payload.terms.length === 0) return;
  if (!payload.id || animatedIds.has(payload.id)) return;
  animatedIds.add(payload.id);
  if (animatedIds.size > 1000) animatedIds.clear();

  const instance = await getBox();
  if (!instance) return;
  cancelClearTimer();
  try {
    await instance.roll(payload.terms);
  } catch (error) {
    console.error("[dice] roll animation failed", error);
  }
  cancelClearTimer();
  clearTimer = setTimeout(() => {
    clearTimer = null;
    instance.clear();
  }, CLEAR_DELAY_MS);
}

export function parseRollPayload(rollJson: string | null): Pick<RollPayload, "id" | "terms"> {
  if (!rollJson) return { id: "", terms: null };
  try {
    const parsed = JSON.parse(rollJson) as { id?: unknown; terms?: unknown };
    return {
      id: typeof parsed.id === "string" ? parsed.id : "",
      terms: Array.isArray(parsed.terms) ? (parsed.terms as DiceTerm[]) : null,
    };
  } catch {
    return { id: "", terms: null };
  }
}
