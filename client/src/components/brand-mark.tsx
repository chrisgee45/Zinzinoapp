import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--gold)]/40 bg-[var(--navy)] font-display text-[var(--gold)] text-lg font-bold"
      >
        B
      </span>
      <span className="font-display text-base sm:text-lg font-bold tracking-tight">
        Build From Anywhere
      </span>
    </div>
  );
}
