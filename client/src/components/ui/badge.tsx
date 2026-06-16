import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition",
  {
    variants: {
      tone: {
        new: "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30",
        qualified: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
        engaged: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
        handoff: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
        customer: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
        lost: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
        muted: "bg-secondary/40 text-muted-foreground border border-border/50",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export const LEAD_STATUSES = ["new", "qualified", "engaged", "handoff", "customer", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function leadStatusTone(status: string): NonNullable<BadgeProps["tone"]> {
  if ((LEAD_STATUSES as readonly string[]).includes(status)) return status as LeadStatus;
  return "muted";
}
