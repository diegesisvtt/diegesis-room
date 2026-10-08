import { useMemo, type CSSProperties } from "react";
import { usePreferences } from "@/web/lib/preferences";

interface Ember {
  left: string;
  size: number;
  duration: string;
  delay: string;
  opacity: number;
  drift: string;
  blur: boolean;
}

export function EmberParticles({ count = 20 }: { count?: number }) {
  const embers = useMemo<Ember[]>(
    () =>
      Array.from({ length: count }, () => ({
        left: `${Math.random() * 100}%`,
        size: 2 + Math.random() * 4,
        duration: `${9 + Math.random() * 10}s`,
        delay: `${-Math.random() * 18}s`,
        opacity: 0.35 + Math.random() * 0.45,
        drift: `${(Math.random() - 0.5) * 140}px`,
        blur: Math.random() > 0.7,
      })),
    [count],
  );

  const { visualEffects } = usePreferences();
  if (!visualEffects) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((ember, i) => (
        <span
          key={i}
          className="animate-ember absolute bottom-[-2vh] rounded-full bg-accent"
          style={
            {
              left: ember.left,
              width: ember.size,
              height: ember.size,
              animationDuration: ember.duration,
              animationDelay: ember.delay,
              filter: ember.blur ? "blur(1px)" : undefined,
              boxShadow: "0 0 6px 1px color-mix(in oklab, var(--color-accent) 60%, transparent)",
              "--ember-opacity": ember.opacity,
              "--ember-drift": ember.drift,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
