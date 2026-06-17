import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        // 16px on mobile prevents iOS Safari from auto-zooming on focus.
        "h-11 w-full appearance-none rounded-xl border pl-3.5 pr-10 text-[16px] sm:text-[14px] text-foreground outline-none transition cursor-pointer",
        "border-[color:var(--border-muted)] bg-[color-mix(in_oklab,var(--surface-2)_75%,transparent)]",
        "focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_22%,transparent)]",
        "disabled:opacity-55",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  </div>
));
Select.displayName = "Select";
