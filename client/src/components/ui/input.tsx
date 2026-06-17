import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

// Polished form input: layered surface (uses surface-2 with a soft mix
// so light + dark themes both render a clean rounded field), gold focus
// ring at low alpha for a calm a11y signal.
//
// Font size is locked at 16px because iOS Safari auto-zooms the entire
// viewport when a focused input/textarea/select is below 16px — and once
// it zooms it doesn't always restore cleanly, so the whole portal ends
// up feeling oversized on iPhone. The visual hit on desktop is minor;
// the mobile-zoom regression is severe. 16px wins.
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-11 w-full rounded-xl border px-3.5 text-[16px] sm:text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition",
      "border-[color:var(--border-muted)] bg-[color-mix(in_oklab,var(--surface-2)_75%,transparent)]",
      "focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_22%,transparent)]",
      "disabled:opacity-55",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
