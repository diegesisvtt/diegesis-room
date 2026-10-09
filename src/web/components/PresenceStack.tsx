import { cn, initials } from "@/web/lib/utils";
import type { VoiceParticipant } from "@/web/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/web/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/web/components/ui/tooltip";

/**
 * Pilha de avatares dos participantes presentes na mesa de voz de um canal,
 * estilo documento colaborativo (Google Docs/Figma). Exibe até `max` avatares
 * sobrepostos e um chip `+N` para o excedente; o tooltip lista os nomes.
 */
export function PresenceStack({
  participants,
  size = "size-6",
  textClass = "text-[9px]",
  ringClass = "ring-background",
  max = 3,
  side = "right",
}: {
  participants: VoiceParticipant[];
  size?: string;
  textClass?: string;
  ringClass?: string;
  max?: number;
  side?: "top" | "right" | "bottom" | "left";
}) {
  if (participants.length === 0) return null;
  const shown = participants.slice(0, max);
  const extra = participants.length - shown.length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative z-10 flex shrink-0 items-center -space-x-2">
          {shown.map((p) => (
            <Avatar key={p.identity} className={cn(size, "ring-2", ringClass)}>
              {p.photoUrl ? <AvatarImage src={p.photoUrl} alt={p.name} /> : null}
              <AvatarFallback className={textClass}>{initials(p.name)}</AvatarFallback>
            </Avatar>
          ))}
          {extra > 0 && (
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground ring-2",
                size,
                textClass,
                ringClass,
              )}
            >
              +{extra}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} align="start" className="max-w-56">
        <p className="font-medium text-muted-foreground">
          {participants.length === 1 ? "Na sala de voz" : `${participants.length} na sala de voz`}
        </p>
        <ul className="mt-1 space-y-0.5">
          {participants.map((p) => (
            <li key={p.identity} className="truncate">
              {p.name}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
