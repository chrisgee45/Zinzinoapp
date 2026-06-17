import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Refined badge system: tighter padding, slightly smaller cap height,
// consistent tracking. The status badges all use the same recipe — tinted
// background, matching border, semantic foreground color — so the row of
// status pills reads as one design pattern, not six different chips.
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] transition",
  {
    variants: {
      tone: {
        new: "bg-[color-mix(in_oklab,var(--gold)_12%,transparent)] text-[var(--gold)] border border-[color:var(--border-gold)]",
        qualified: "bg-[color-mix(in_oklab,#14b8a6_12%,transparent)] text-teal-300 border border-teal-500/30",
        engaged: "bg-[color-mix(in_oklab,#0ea5e9_12%,transparent)] text-sky-300 border border-sky-500/30",
        handoff: "bg-[color-mix(in_oklab,#8b5cf6_12%,transparent)] text-violet-300 border border-violet-500/30",
        customer: "bg-[color-mix(in_oklab,#22c55e_12%,transparent)] text-emerald-300 border border-emerald-500/30",
        lost: "bg-[color-mix(in_oklab,#71717a_12%,transparent)] text-zinc-400 border border-zinc-500/30",
        muted: "bg-[rgb(var(--overlay-rgb)/0.04)] text-muted-foreground border border-[color:var(--border-muted)]",
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
