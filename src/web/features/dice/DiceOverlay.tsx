import { useEffect, useRef } from "react";
import { attachDiceContainer, destroyDiceBox } from "./diceBox";

export function DiceOverlay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) attachDiceContainer(ref.current);
    return () => destroyDiceBox();
  }, []);

  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40" />;
}
