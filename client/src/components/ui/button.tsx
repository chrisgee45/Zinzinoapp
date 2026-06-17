import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Refined button system: confident, not shouty. Sentence case across all
// variants — uppercase tracking on every primary button felt template-y.
// Primary keeps the gold gradient but with a softer shadow + a 1px hover
// lift so taps feel responsive without yelling. Focus ring uses the gold
// token at low alpha for a calm a11y signal.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: [
          "text-[var(--navy)]",
          "[background:linear-gradient(180deg,var(--gold-soft)_0%,var(--gold-deep)_100%)]",
          "shadow-[0_6px_18px_-8px_rgba(212,175,55,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]",
          "hover:-translate-y-[1px] hover:shadow-[0_8px_24px_-8px_rgba(212,175,55,0.65),inset_0_1px_0_rgba(255,255,255,0.4)]",
          "focus-visible:ring-[color:var(--gold)]/40",
        ].join(" "),
        secondary: [
          "bg-transparent text-foreground",
          "border border-[color:var(--border-gold)]",
          "hover:bg-[color-mix(in_oklab,var(--gold)_10%,transparent)] hover:border-[var(--gold)]",
          "focus-visible:ring-[color:var(--gold)]/30",
        ].join(" "),
        ghost: [
          "bg-transparent text-foreground",
          "hover:bg-[rgb(var(--overlay-rgb)/0.05)]",
          "focus-visible:ring-[color:var(--gold)]/20",
        ].join(" "),
        link: "text-[var(--gold)] underline-offset-4 hover:underline hover:text-[var(--gold-soft)]",
        destructive: [
          "bg-[hsl(var(--destructive))]/85 text-destructive-foreground",
          "hover:bg-[hsl(var(--destructive))]",
          "focus-visible:ring-[hsl(var(--destructive))]/40",
        ].join(" "),
      },
      size: {
        sm: "h-9 px-4 text-[12.5px]",
        md: "h-11 px-5 text-[13.5px]",
        lg: "h-12 px-6 text-[14px]",
        xl: "h-14 px-8 text-[15px]",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
