import { cn } from "@/lib/utils";

// Brand lockup. Refined to a tighter monogram tile with a faint inner
// glow + dual-line typesetting. The "BFA" three-letter tile reads more
// like a deliberate brand mark than the previous single "B" — and the
// stacked wordmark gives the tagline its own line so the overall lockup
// feels premium without taking more horizontal room than before.
export function BrandMark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg font-display text-[12px] font-bold leading-none tracking-wide"
        style={{
          color: "var(--gold)",
          background: "linear-gradient(180deg, color-mix(in oklab, var(--gold) 12%, transparent), color-mix(in oklab, var(--gold) 6%, transparent))",
          border: "1px solid var(--border-gold)",
          boxShadow: "inset 0 1px 0 0 rgb(var(--overlay-rgb) / 0.06), 0 1px 0 0 rgb(0 0 0 / 0.25)",
        }}
      >
        BFA
      </span>
      {!compact && (
        <span className="hidden sm:flex flex-col leading-tight">
          <span className="font-display text-[14.5px] font-bold tracking-tight">
            Build From Anywhere
          </span>
          <span className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground/85 mt-px">
            Command Center
          </span>
        </span>
      )}
    </div>
  );
}
