import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      // 16px on mobile prevents iOS Safari from auto-zooming when the
      // user focuses the field. Visual hit on desktop is minor; the
      // mobile zoom regression is severe.
      "w-full rounded-xl border px-3.5 py-3 text-[16px] sm:text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition resize-y leading-relaxed",
      "border-[color:var(--border-muted)] bg-[color-mix(in_oklab,var(--surface-2)_75%,transparent)]",
      "focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_22%,transparent)]",
      "disabled:opacity-55",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
