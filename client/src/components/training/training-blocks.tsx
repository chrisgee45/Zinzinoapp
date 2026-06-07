import {
  AlertCircle,
  Check,
  CircleDot,
  Quote as QuoteIcon,
  Sparkles,
} from "lucide-react";
import type { Block, ColorCode } from "@/data/trainingContent";
import { cn } from "@/lib/utils";

const COLOR_TOKENS: Record<ColorCode, { bar: string; chip: string; text: string; bg: string; label: string }> = {
  green: {
    bar: "bg-[#3fb87b]",
    chip: "bg-[#3fb87b]/15 text-[#86dba8] border-[#3fb87b]/40",
    text: "text-[#86dba8]",
    bg: "bg-[#3fb87b]/8",
    label: "Green",
  },
  red: {
    bar: "bg-[#e85a4f]",
    chip: "bg-[#e85a4f]/15 text-[#f6a59c] border-[#e85a4f]/40",
    text: "text-[#f6a59c]",
    bg: "bg-[#e85a4f]/8",
    label: "Red",
  },
  yellow: {
    bar: "bg-[#e8c054]",
    chip: "bg-[#e8c054]/15 text-[#f3da91] border-[#e8c054]/40",
    text: "text-[#f3da91]",
    bg: "bg-[#e8c054]/8",
    label: "Yellow",
  },
  blue: {
    bar: "bg-[#5ba8d6]",
    chip: "bg-[#5ba8d6]/15 text-[#a9d2ec] border-[#5ba8d6]/40",
    text: "text-[#a9d2ec]",
    bg: "bg-[#5ba8d6]/8",
    label: "Blue",
  },
};

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.kind) {
    case "paragraph":
      return <Paragraph text={block.text} />;
    case "bullets":
      return <BulletList items={block.items} />;
    case "pullquote":
      return <PullQuote quote={block.quote} attribution={block.attribution} />;
    case "do_dont":
      return <DoDont {...block} />;
    case "exercise":
      return <Exercise title={block.title} body={block.body} sample={block.sample} />;
    case "checklist":
      return <Checklist title={block.title} items={block.items} />;
    case "tile_grid":
      return <TileGrid tiles={block.tiles} />;
    case "story_card":
      return <StoryCard title={block.title} body={block.body} attribution={block.attribution} />;
    case "script_card":
      return <ScriptCard label={block.label} body={block.body} forColor={block.for} />;
    case "color_card":
      return <ColorCardRow cards={block.cards} />;
    case "comp_table":
      return (
        <CompTable
          caption={block.caption}
          headers={block.headers}
          rows={block.rows}
          footnote={block.footnote}
        />
      );
    case "glossary":
      return <Glossary entries={block.entries} />;
    default:
      return null;
  }
}

function Paragraph({ text }: { text: string }) {
  return (
    <p className="text-base sm:text-[17px] leading-relaxed text-foreground/85 max-w-prose">
      {text}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 max-w-prose">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-foreground/85">
          <CircleDot className="h-3.5 w-3.5 text-[var(--gold)] shrink-0 mt-1.5" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PullQuote({ quote, attribution }: { quote: string; attribution?: string }) {
  return (
    <figure className="relative max-w-2xl">
      <QuoteIcon className="absolute -left-1 -top-2 h-7 w-7 text-[var(--gold)]/40" aria-hidden />
      <blockquote className="font-display text-2xl sm:text-[28px] leading-snug pl-8 text-foreground/95">
        &ldquo;{quote}&rdquo;
      </blockquote>
      {attribution && (
        <figcaption className="mt-2 pl-8 text-xs uppercase tracking-[0.22em] text-[var(--gold)]">
          — {attribution}
        </figcaption>
      )}
    </figure>
  );
}

function DoDont({
  do: doItems,
  dont,
  doTitle,
  dontTitle,
}: {
  do: string[];
  dont: string[];
  doTitle?: string;
  dontTitle?: string;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
      <div className="bfa-card p-5 border-l-2 border-l-[#3fb87b]">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#86dba8] mb-3 inline-flex items-center gap-1.5">
          <Check className="h-3 w-3" /> {doTitle ?? "Do"}
        </p>
        <ul className="space-y-2 text-sm">
          {doItems.map((item, i) => (
            <li key={i} className="text-foreground/85 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="bfa-card p-5 border-l-2 border-l-[#e85a4f]">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#f6a59c] mb-3 inline-flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {dontTitle ?? "Don't"}
        </p>
        <ul className="space-y-2 text-sm">
          {dont.map((item, i) => (
            <li key={i} className="text-foreground/85 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Exercise({ title, body, sample }: { title: string; body: string; sample?: string }) {
  return (
    <div className="max-w-2xl rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-[var(--gold)]/5 p-6 sm:p-7">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] mb-2 inline-flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Exercise
      </p>
      <h4 className="font-display text-xl sm:text-2xl font-bold leading-tight">{title}</h4>
      <p className="mt-3 text-sm sm:text-base text-foreground/85 leading-relaxed">{body}</p>
      {sample && (
        <div className="mt-5 rounded-xl bg-background/50 border border-border/50 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Sample</p>
          <p className="text-sm italic text-foreground/80 leading-relaxed">{sample}</p>
        </div>
      )}
    </div>
  );
}

function Checklist({ title, items }: { title?: string; items: string[] }) {
  return (
    <div className="max-w-2xl rounded-2xl border-2 border-dashed border-[var(--teal)]/45 bg-[var(--teal)]/5 p-6 sm:p-7">
      {title && (
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--teal-soft)] mb-3 inline-flex items-center gap-1.5">
          <Check className="h-3 w-3" /> {title}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-foreground/90">
            <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--teal)]/60 bg-background/40">
              <Check className="h-2.5 w-2.5 text-[var(--teal-soft)] opacity-0" />
            </span>
            <span className="text-sm sm:text-[15px] leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TileGrid({ tiles }: { tiles: { eyebrow?: string; title: string; body?: string }[] }) {
  const cols =
    tiles.length === 4 ? "sm:grid-cols-2 md:grid-cols-4" :
    tiles.length === 5 ? "sm:grid-cols-2 md:grid-cols-5" :
    tiles.length === 3 ? "sm:grid-cols-3" :
    tiles.length === 2 ? "sm:grid-cols-2" :
    "sm:grid-cols-2 md:grid-cols-3";
  return (
    <div className={cn("grid gap-3", cols)}>
      {tiles.map((tile, i) => (
        <div key={i} className="bfa-card p-5 flex flex-col gap-2">
          {tile.eyebrow && (
            <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)] font-semibold">
              {tile.eyebrow}
            </span>
          )}
          <h4 className="font-display text-lg font-bold leading-tight">{tile.title}</h4>
          {tile.body && (
            <p className="text-sm text-muted-foreground leading-relaxed">{tile.body}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StoryCard({ title, body, attribution }: { title?: string; body: string; attribution?: string }) {
  return (
    <div className="max-w-2xl bfa-card p-5 sm:p-6 border-l-2 border-l-[var(--gold)]">
      {title && (
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] mb-2">{title}</p>
      )}
      <p className="text-sm sm:text-base leading-relaxed text-foreground/85">{body}</p>
      {attribution && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">— {attribution}</p>
      )}
    </div>
  );
}

function ScriptCard({
  label,
  body,
  forColor,
}: {
  label: string;
  body: string;
  forColor?: ColorCode | "warm_market";
}) {
  const tokens = forColor && forColor !== "warm_market" ? COLOR_TOKENS[forColor] : null;
  const accentBar = tokens?.bar ?? "bg-[var(--teal)]";
  const eyebrow = tokens?.text ?? "text-[var(--teal-soft)]";

  return (
    <div className={cn("max-w-2xl bfa-card p-5 sm:p-6 border-l-2", tokens ? `border-l-transparent` : "border-l-[var(--teal)]")}>
      <div className="flex items-stretch gap-4">
        <span className={cn("w-1 self-stretch rounded-full -my-1", accentBar)} aria-hidden />
        <div className="flex-1">
          <p className={cn("text-[11px] uppercase tracking-[0.22em] mb-2", eyebrow)}>
            Script · {label}
          </p>
          <blockquote className="text-sm sm:text-[15px] leading-relaxed text-foreground/90 italic">
            &ldquo;{body}&rdquo;
          </blockquote>
        </div>
      </div>
    </div>
  );
}

function ColorCardRow({ cards }: { cards: { color: ColorCode; trait: string; tell: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const t = COLOR_TOKENS[card.color];
        return (
          <div
            key={card.color}
            className={cn("relative bfa-card p-5 overflow-hidden", t.bg)}
          >
            <span className={cn("absolute left-0 top-0 bottom-0 w-1", t.bar)} aria-hidden />
            <div className="pl-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] border", t.chip)}>
                {t.label}
              </span>
              <h4 className="font-display text-lg font-bold mt-3 leading-tight">{card.trait}</h4>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{card.tell}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompTable({
  caption,
  headers,
  rows,
  footnote,
}: {
  caption?: string;
  headers: string[];
  rows: string[][];
  footnote?: string;
}) {
  return (
    <div className="max-w-3xl bfa-card overflow-hidden">
      {caption && (
        <div className="px-5 py-3 border-b border-border/40 bg-secondary/30">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)]">{caption}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-foreground/90">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.18em] font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-secondary/20 transition">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-4 py-3 align-top leading-relaxed",
                      j === 0 ? "font-semibold text-[var(--gold)] whitespace-nowrap" : "text-foreground/85",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && (
        <div className="px-5 py-3 border-t border-border/40 bg-secondary/20">
          <p className="text-xs text-muted-foreground leading-relaxed">{footnote}</p>
        </div>
      )}
    </div>
  );
}

function Glossary({ entries }: { entries: { term: string; def: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 max-w-3xl">
      {entries.map((e, i) => (
        <details
          key={i}
          className="group bfa-card px-3 py-2 cursor-pointer transition open:bg-[var(--gold)]/10 open:border-[var(--gold)]/40"
        >
          <summary className="list-none flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--gold)]">
            <CircleDot className="h-2.5 w-2.5" /> {e.term}
            <span className="text-muted-foreground/70 normal-case tracking-normal text-xs ml-auto group-open:rotate-45 transition">+</span>
          </summary>
          <p className="mt-2 text-xs text-foreground/85 leading-relaxed max-w-xs">{e.def}</p>
        </details>
      ))}
    </div>
  );
}
