// Shared UI primitives for the portal polish pass.
//
// These exist so individual screens don't re-roll the same patterns
// (stat tile, empty state, key/value pair, eyebrow label). Anything new
// should reach for these first.

import { Link } from "wouter";
import { type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tile ────────────────────────────────────────────────────────────────────
// Stat tile: small uppercase label + big number + optional trend/caption.
// Replaces ad-hoc <Stat> blocks across dashboard + analytics.

interface TileProps {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  // 'accent' lifts the value into gold for a "this number matters" emphasis.
  // 'success' / 'warning' / 'danger' tint it semantically. Default keeps
  // the foreground color so a row of tiles reads as a calm grid.
  tone?: "default" | "accent" | "success" | "warning" | "danger";
  icon?: ReactNode;
  className?: string;
}

const TILE_TONE: Record<NonNullable<TileProps["tone"]>, string> = {
  default: "text-foreground",
  accent: "text-[var(--gold)]",
  success: "text-[color:var(--success)]",
  warning: "text-[color:var(--warning)]",
  danger: "text-[color:var(--danger)]",
};

export function Tile({ label, value, caption, tone = "default", icon, className }: TileProps) {
  return (
    <div className={cn("bfa-card-flat px-4 py-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="bfa-eyebrow truncate">{label}</span>
        {icon && <span className="text-muted-foreground/70 shrink-0">{icon}</span>}
      </div>
      <div className={cn("font-display text-2xl sm:text-[26px] leading-tight font-bold mt-1.5 tabular-nums", TILE_TONE[tone])}>
        {value}
      </div>
      {caption && (
        <div className="text-[11px] text-muted-foreground mt-1 truncate">{caption}</div>
      )}
    </div>
  );
}

// ── EmptyState ──────────────────────────────────────────────────────────────
// Used by the dashboard, leads list, calendar, customer list, etc.
// Centered, optional CTA, restrained — does not try to be a hero.

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("px-6 py-12 sm:py-14 text-center max-w-md mx-auto", className)}>
      {icon && (
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
          style={{
            background: "color-mix(in oklab, var(--gold) 12%, transparent)",
            border: "1px solid var(--border-gold)",
            color: "var(--gold)",
          }}
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── MetricChip ──────────────────────────────────────────────────────────────
// A small inline "label : value" pair, used in the lead detail right rail
// and dashboard sub-stats. Less heavy than Tile when you need a row of
// quick facts inside a card.

interface MetricChipProps {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "muted";
}

export function MetricChip({ label, value, tone = "default" }: MetricChipProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="bfa-eyebrow">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "accent" && "text-[var(--gold)]",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── PriorityDot ─────────────────────────────────────────────────────────────
// 8px tinted dot used for inline priority hints (New, Hot, etc.) where a
// full badge would be too heavy.

interface PriorityDotProps {
  tone: "new" | "hot" | "warm" | "cold" | "success" | "neutral";
  label?: string;
}

const PRIORITY_TONE: Record<PriorityDotProps["tone"], { bg: string; ring: string }> = {
  new: { bg: "var(--gold)", ring: "rgba(212,175,55,0.25)" },
  hot: { bg: "var(--danger)", ring: "rgba(239,68,68,0.25)" },
  warm: { bg: "var(--warning)", ring: "rgba(245,158,11,0.25)" },
  cold: { bg: "var(--cyan)", ring: "rgba(34,211,238,0.25)" },
  success: { bg: "var(--success)", ring: "rgba(34,197,94,0.25)" },
  neutral: { bg: "rgb(148,163,184)", ring: "rgba(148,163,184,0.25)" },
};

export function PriorityDot({ tone, label }: PriorityDotProps) {
  const styles = PRIORITY_TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full inline-block"
        style={{ background: styles.bg, boxShadow: `0 0 0 3px ${styles.ring}` }}
      />
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
    </span>
  );
}

// ── ActionLink ──────────────────────────────────────────────────────────────
// "Read more / go to X" link with a trailing arrow. Used in cards and
// empty states for the secondary action.

interface ActionLinkProps {
  href: string;
  children: ReactNode;
  external?: boolean;
}

export function ActionLink({ href, children, external }: ActionLinkProps) {
  const className = "inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] hover:text-[var(--gold-soft)] transition";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children} <ArrowRight className="h-3 w-3" />
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
