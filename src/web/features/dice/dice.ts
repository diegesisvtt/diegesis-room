import type { FacesSpec } from "@diegesis/dice-core";
import type { DiceTerm } from "@diegesis/dice";

export const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export type DicePool = Record<number, number>;

export function buildFormula(pool: DicePool, modifier: number): string {
  const parts = QUICK_DICE.filter((sides) => (pool[sides] ?? 0) > 0).map(
    (sides) => {
      const count = pool[sides] ?? 0;
      return count > 1 ? `${count}d${sides}` : `d${sides}`;
    },
  );
  if (parts.length === 0) return "";
  let formula = parts.join("+");
  if (modifier > 0) formula += `+${modifier}`;
  else if (modifier < 0) formula += `-${Math.abs(modifier)}`;
  return formula;
}

export type RollPayload = {
  id: string;
  formula: string;
  total: number | boolean;
  detail: string;
  terms: DiceTerm[] | null;
};

export function describeTerms(terms: DiceTerm[] | null): string {
  if (!terms) return "";
  return terms
    .map((term) => {
      const label = facesLabel(term.faces);
      const values = term.results.map((result) =>
        Array.isArray(result) ? result.join("→") : String(result),
      );
      return `${label}: [${values.join(", ")}]`;
    })
    .join(" · ");
}

function facesLabel(faces: number | FacesSpec): string {
  if (typeof faces === "number") return `d${faces}`;
  switch (faces.kind) {
    case "number":
      return `d${faces.value}`;
    case "percentile":
      return "d%";
    case "coin":
      return "dcoin";
    case "fate":
      return "dF";
    default:
      return "d?";
  }
}
