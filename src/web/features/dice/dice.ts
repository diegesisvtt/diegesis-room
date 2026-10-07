export type DiceRoll = {
  id: string;
  player: string;
  sides: number;
  result: number;
  detail: string;
  time: string;
};

export function rollDice(sides: number): { result: number; detail: string } {
  const result = Math.floor(Math.random() * sides) + 1;
  return { result, detail: `1d${sides}` };
}

export function makeRoll(player: string, sides: number): DiceRoll {
  const { result, detail } = rollDice(sides);
  return {
    id: crypto.randomUUID(),
    player,
    sides,
    result,
    detail,
    time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export const QUICK_DICE = [4, 6, 8, 20] as const;
