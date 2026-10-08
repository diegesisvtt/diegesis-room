import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/web/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & { ornate?: boolean }
>(({ className, orientation = "horizontal", decorative = true, ornate = false, ...props }, ref) => {
  if (ornate && orientation === "horizontal") {
    return (
      <div
        role={decorative ? "none" : "separator"}
        aria-orientation="horizontal"
        className={cn("flex items-center gap-3", className)}
      >
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-accent/40" />
        <span className="size-1.5 rotate-45 bg-accent/60 shadow-[0_0_6px_var(--color-accent)]" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-accent/40 to-accent/40" />
      </div>
    );
  }
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
});
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
