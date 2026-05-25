import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      "w-full rounded-xl border bg-input/60 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/70 outline-none transition resize-y",
      "border-[color-mix(in_oklab,hsl(var(--border))_90%,transparent)]",
      "focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_25%,transparent)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
