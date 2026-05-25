import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-12 w-full rounded-xl border bg-input/60 px-4 text-base text-foreground placeholder:text-muted-foreground/70 outline-none transition",
      "border-[color-mix(in_oklab,hsl(var(--border))_90%,transparent)]",
      "focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_25%,transparent)]",
      "disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
