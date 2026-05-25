import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "text-[hsl(var(--primary-foreground))] [background:linear-gradient(180deg,var(--gold-soft)_0%,var(--gold-deep)_100%)] shadow-[0_10px_30px_-10px_rgba(201,168,76,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] uppercase tracking-wider hover:brightness-105",
        secondary:
          "border border-[color-mix(in_oklab,var(--gold)_50%,transparent)] bg-transparent text-foreground hover:[background:color-mix(in_oklab,var(--gold)_12%,transparent)] hover:border-[var(--gold)] uppercase tracking-wider",
        ghost: "hover:bg-secondary/50 text-foreground",
        link: "text-[var(--gold)] underline-offset-4 hover:underline",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-6",
        lg: "h-12 px-7 text-[15px]",
        xl: "h-14 px-9 text-base",
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
