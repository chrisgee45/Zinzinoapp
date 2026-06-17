import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

// Polished form input: layered surface (uses surface-2 with a soft mix
// so light + dark themes both render a clean rounded field), gold focus
// ring at low alpha for a calm a11y signal.
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-11 w-full rounded-xl border px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition",
      "border-[color:var(--border-muted)] bg-[color-mix(in_oklab,var(--surface-2)_75%,transparent)]",
      "focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_22%,transparent)]",
      "disabled:opacity-55",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
