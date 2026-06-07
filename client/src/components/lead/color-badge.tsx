import { COLOR_META, type ColorCode } from "@shared/colorCode";
import { cn } from "@/lib/utils";

interface Props {
  color: ColorCode | null | undefined;
  variant?: "dot" | "chip" | "full";
  className?: string;
}

// Compact color presence on the lead. Three sizes:
//   - dot:  just a colored circle, used inline with the lead name (pipeline)
//   - chip: dot + 'Green/Red/Yellow/Blue' label, used in card headers
//   - full: dot + label + "magic word: X" + "one move: Y" intel block,
//           used as the headline color treatment on the lead detail page
// Returns null when the lead has no color yet (pre-step-2). Callers can
// decide to render a "Not picked yet" placeholder where it matters.
export function ColorBadge({ color, variant = "chip", className }: Props) {
  if (!color) return null;
  const meta = COLOR_META[color];
  if (!meta) return null;

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", className)}
        style={{ backgroundColor: meta.hex, boxShadow: `0 0 0 3px ${meta.hex}22` }}
        aria-label={meta.label}
        title={meta.label}
      />
    );
  }

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
          className,
        )}
        style={{
          backgroundColor: `${meta.hex}1f`,
          color: meta.hex,
          boxShadow: `inset 0 0 0 1px ${meta.hex}55`,
        }}
        title={meta.label}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: meta.hex }}
        />
        {meta.label.split(" ")[0]}
      </span>
    );
  }

  // full
  return (
    <div
      className={cn("rounded-2xl p-4 sm:p-5", className)}
      style={{
        backgroundColor: `${meta.hex}14`,
        boxShadow: `inset 0 0 0 1px ${meta.hex}55`,
      }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: meta.hex, boxShadow: `0 0 0 4px ${meta.hex}22` }}
        />
        <p
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: meta.hex }}
        >
          {meta.label}
        </p>
      </div>
      <div className="text-sm space-y-1.5">
        <p>
          <span className="text-foreground/70">Magic word:</span>{" "}
          <span className="font-semibold text-foreground">{meta.magicWord}</span>
        </p>
        <p>
          <span className="text-foreground/70">One move:</span>{" "}
          <span className="font-semibold text-foreground">{meta.oneMove}</span>
        </p>
      </div>
    </div>
  );
}

interface PickerProps {
  current: ColorCode | null | undefined;
  onChange: (color: ColorCode) => void;
  disabled?: boolean;
}

// Four-pill override row for the CRM. Partner clicks one to correct a lead's
// self-sort. Calls PATCH /api/leads/:id/color (last-write-wins).
export function ColorPicker({ current, onChange, disabled }: PickerProps) {
  const codes: ColorCode[] = ["green", "red", "yellow", "blue"];
  return (
    <div className="flex flex-wrap gap-2">
      {codes.map((code) => {
        const meta = COLOR_META[code];
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            disabled={disabled}
            onClick={() => onChange(code)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active ? "ring-2" : "ring-1 hover:scale-[1.03] active:scale-[0.97]",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            style={{
              backgroundColor: active ? `${meta.hex}33` : `${meta.hex}14`,
              color: meta.hex,
              boxShadow: `inset 0 0 0 ${active ? 2 : 1}px ${meta.hex}${active ? "" : "55"}`,
            }}
            aria-pressed={active}
            title={`Set color to ${meta.label}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.hex }}
            />
            {meta.label.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}
