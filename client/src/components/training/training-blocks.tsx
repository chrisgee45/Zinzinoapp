import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CircleDot,
  Loader2,
  Mail,
  Phone,
  Plus,
  Printer,
  Quote as QuoteIcon,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { Block, ColorCode } from "@/data/trainingContent";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { printDocument, escapePrintHtml } from "@/lib/print";

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
    case "editable_exercise":
      return (
        <EditableExercise
          title={block.title}
          body={block.body}
          sample={block.sample}
          storageKey={block.storageKey}
          printTitle={block.printTitle}
        />
      );
    case "hundreds_list_form":
      return <HundredsListForm />;
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
          {attribution}
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
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{attribution}</p>
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


// ────────────────────────── Editable workbook exercises ──────────────────────────

interface EditableExerciseProps {
  title: string;
  body: string;
  sample?: string;
  storageKey: "vision_text" | "why_text";
  printTitle: string;
}

function EditableExercise({ title, body, sample, storageKey, printTitle }: EditableExerciseProps) {
  const [value, setValue] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showUpline, setShowUpline] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef<string>("");

  // Load saved value on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ content: Record<string, string> }>("/api/site-content");
        if (cancelled) return;
        const stored = data.content[storageKey] ?? "";
        setValue(stored);
        lastSaved.current = stored;
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Debounced auto-save on change
  useEffect(() => {
    if (loading) return;
    if (value === lastSaved.current) return;
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          await api("/api/site-content", {
            method: "PUT",
            body: JSON.stringify({ key: storageKey, value }),
          });
          lastSaved.current = value;
          setSaveState("saved");
          window.setTimeout(() => setSaveState("idle"), 1500);
        } catch (e) {
          console.warn("[workbook] save failed:", e);
          setSaveState("error");
        }
      })();
    }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [value, loading, storageKey]);

  function onPrint() {
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    printDocument({
      title: printTitle,
      bodyHtml: `
        <div class="eyebrow">${escapePrintHtml(printTitle)}</div>
        <h1>${escapePrintHtml(printTitle)}</h1>
        <div class="meta">${escapePrintHtml(dateStr)}</div>
        <div class="body-text">${escapePrintHtml(value || "(empty)")}</div>
      `,
    });
  }

  return (
    <div className="max-w-2xl rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-[var(--gold)]/5 p-6 sm:p-7">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] mb-2 inline-flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Exercise
      </p>
      <h4 className="font-display text-xl sm:text-2xl font-bold leading-tight">{title}</h4>
      <p className="mt-3 text-sm sm:text-base text-foreground/85 leading-relaxed">{body}</p>

      {sample && (
        <details className="mt-4 rounded-xl bg-background/50 border border-border/50 p-4">
          <summary className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground cursor-pointer">
            Sample (tap to expand)
          </summary>
          <p className="mt-3 text-sm italic text-foreground/80 leading-relaxed">{sample}</p>
        </details>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`workbook-${storageKey}`}>Your version</Label>
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            {saveState === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
            {saveState === "saved" && (<><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Saved</>)}
            {saveState === "error" && <span className="text-amber-300">Couldn't save</span>}
          </span>
        </div>
        <Textarea
          id={`workbook-${storageKey}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={loading ? "Loading your saved draft…" : "Start writing here. Saves automatically."}
          rows={8}
          disabled={loading}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onPrint} disabled={!value.trim()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onPrint} disabled={!value.trim()}>
          <Printer className="h-3.5 w-3.5" /> Save as PDF
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowUpline(true)} disabled={!value.trim()}>
          <Send className="h-3.5 w-3.5" /> Send to upline
        </Button>
      </div>

      {showUpline && (
        <div className="mt-4 rounded-xl bg-background/60 border border-border/50 p-4">
          <p className="text-sm font-semibold">Upline sharing is coming soon.</p>
          <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
            Once the genealogy + sponsor system is live (you'll add your sponsor on signup and we'll link partner accounts), this button will email a copy of your workbook to whoever you're building under. For now, hit Print or Save as PDF and send it however works best.
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowUpline(false)} className="mt-2">
            Got it
          </Button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────── 100-name list workbook ──────────────────────────

interface ProspectEntry {
  name: string;
  email: string;
  phone: string;
  context: string;
}

function emptyEntry(): ProspectEntry {
  return { name: "", email: "", phone: "", context: "" };
}

const ROWS_PER_PAGE = 10;
const TOTAL_ROWS = 100;

function HundredsListForm() {
  const [entries, setEntries] = useState<ProspectEntry[]>(() => Array.from({ length: TOTAL_ROWS }, emptyEntry));
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; coldStarted: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [startCold, setStartCold] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const lastSavedJson = useRef<string>("");

  // Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ content: Record<string, string> }>("/api/site-content");
        if (cancelled) return;
        const raw = data.content["prospect_list"];
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as ProspectEntry[];
            const normalized: ProspectEntry[] = Array.from({ length: TOTAL_ROWS }, (_, i) => ({
              name: parsed[i]?.name ?? "",
              email: parsed[i]?.email ?? "",
              phone: parsed[i]?.phone ?? "",
              context: parsed[i]?.context ?? "",
            }));
            setEntries(normalized);
            lastSavedJson.current = JSON.stringify(normalized);
          } catch {
            /* ignore parse errors */
          }
        } else {
          lastSavedJson.current = JSON.stringify(entries);
        }
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save
  useEffect(() => {
    if (loading) return;
    const json = JSON.stringify(entries);
    if (json === lastSavedJson.current) return;
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          await api("/api/site-content", {
            method: "PUT",
            body: JSON.stringify({ key: "prospect_list", value: json }),
          });
          lastSavedJson.current = json;
          setSaveState("saved");
          window.setTimeout(() => setSaveState("idle"), 1500);
        } catch (e) {
          console.warn("[list] save failed:", e);
          setSaveState("error");
        }
      })();
    }, 1200);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [entries, loading]);

  function update(idx: number, field: keyof ProspectEntry, val: string) {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  }
  function clearRow(idx: number) {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = emptyEntry();
      return next;
    });
  }

  const filledCount = useMemo(() => entries.filter((e) => e.name.trim() || e.email.trim()).length, [entries]);
  const importableCount = useMemo(() => entries.filter((e) => e.name.trim() && isEmail(e.email)).length, [entries]);

  function onPrint() {
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const rowsHtml = entries
      .map((e, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${escapePrintHtml(e.name)}</td>
          <td>${escapePrintHtml(e.email)}</td>
          <td>${escapePrintHtml(e.phone)}</td>
          <td>${escapePrintHtml(e.context)}</td>
        </tr>`)
      .join("");
    printDocument({
      title: "My 100-Name List",
      bodyHtml: `
        <div class="eyebrow">100-Name List</div>
        <h1>My 100-Name List</h1>
        <div class="meta">${escapePrintHtml(dateStr)} · ${filledCount} of 100 filled</div>
        <table>
          <thead>
            <tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Where I know them</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `,
    });
  }

  async function onImport() {
    if (importing) return;
    setImportError(null);
    setImportResult(null);
    const contacts = entries
      .filter((e) => e.name.trim() && isEmail(e.email))
      .map((e) => ({
        name: e.name.trim(),
        email: e.email.trim().toLowerCase(),
        phone: e.phone.trim() || undefined,
        context: e.context.trim() || undefined,
      }));
    if (contacts.length === 0) {
      setImportError("No rows have both a name and a valid email yet. Add at least one before importing.");
      return;
    }
    setImporting(true);
    try {
      const result = await api<{ insertedCount: number; skippedCount: number; coldStarted: number }>(
        "/api/leads/import-list",
        {
          method: "POST",
          body: JSON.stringify({ contacts, startCold }),
        },
      );
      setImportResult({ inserted: result.insertedCount, skipped: result.skippedCount, coldStarted: result.coldStarted });
    } catch (e) {
      setImportError(e instanceof ApiError ? e.message : "Import failed. Try again.");
    } finally {
      setImporting(false);
    }
  }

  const pageStart = page * ROWS_PER_PAGE;
  const pageEnd = pageStart + ROWS_PER_PAGE;
  const pageRows = entries.slice(pageStart, pageEnd);

  return (
    <div className="max-w-3xl rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-[var(--gold)]/5 p-6 sm:p-7">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] mb-2 inline-flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Exercise
      </p>
      <h4 className="font-display text-xl sm:text-2xl font-bold leading-tight">Write your 100-name list</h4>
      <p className="mt-3 text-sm sm:text-base text-foreground/85 leading-relaxed">
        Open your phone contacts. Every name. Don't filter, don't pre-judge. Email + phone where you have them. The "where I know them" column is for the partner-prep notes (high school, work in 2018, met at Carrie's wedding). Saves automatically. When you're ready, hit Import to drop everyone straight into your CRM.
      </p>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-foreground/70">
          {filledCount} of {TOTAL_ROWS} filled
          {importableCount > 0 && ` · ${importableCount} ready to import`}
        </span>
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          {saveState === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
          {saveState === "saved" && (<><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Saved</>)}
          {saveState === "error" && <span className="text-amber-300">Couldn't save</span>}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex gap-1 flex-wrap">
          {Array.from({ length: TOTAL_ROWS / ROWS_PER_PAGE }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                page === i
                  ? "bg-[var(--gold)] text-[var(--navy)]"
                  : "bg-secondary/40 text-foreground/70 hover:text-foreground",
              )}
              aria-label={`Rows ${i * ROWS_PER_PAGE + 1} to ${(i + 1) * ROWS_PER_PAGE}`}
            >
              {i * ROWS_PER_PAGE + 1}–{(i + 1) * ROWS_PER_PAGE}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {pageRows.map((row, localIdx) => {
          const idx = pageStart + localIdx;
          return (
            <div
              key={idx}
              className="rounded-xl bg-background/40 ring-1 ring-border/40 p-3 grid gap-2 sm:grid-cols-[2.5rem_1fr_1fr_1fr_1fr_auto] sm:items-center"
            >
              <div className="text-sm font-display font-bold text-[var(--gold)] sm:text-center">{idx + 1}</div>
              <Input
                value={row.name}
                onChange={(e) => update(idx, "name", e.target.value)}
                placeholder="Full name"
                maxLength={120}
                className="h-10"
                disabled={loading}
              />
              <Input
                type="email"
                inputMode="email"
                value={row.email}
                onChange={(e) => update(idx, "email", e.target.value)}
                placeholder="Email"
                maxLength={240}
                className="h-10"
                disabled={loading}
              />
              <Input
                type="tel"
                inputMode="tel"
                value={row.phone}
                onChange={(e) => update(idx, "phone", e.target.value)}
                placeholder="Phone"
                maxLength={40}
                className="h-10"
                disabled={loading}
              />
              <Input
                value={row.context}
                onChange={(e) => update(idx, "context", e.target.value)}
                placeholder="Where I know them"
                maxLength={500}
                className="h-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => clearRow(idx)}
                className="text-muted-foreground hover:text-destructive-foreground/90 self-center justify-self-end"
                aria-label="Clear row"
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onPrint} disabled={filledCount === 0}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onPrint} disabled={filledCount === 0}>
          <Printer className="h-3.5 w-3.5" /> Save as PDF
        </Button>
      </div>

      <div className="mt-5 rounded-xl ring-1 ring-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
        <p className="font-semibold text-sm inline-flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5 text-[var(--gold)]" /> Import to your CRM
        </p>
        <p className="text-xs text-foreground/75 mt-1 leading-relaxed">
          Adds every row with both a name and a valid email to your pipeline tagged as <span className="font-semibold">100-list</span>. Already-imported contacts (matched by email) are skipped, not duplicated.
        </p>
        <label className="mt-3 flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={startCold}
            onChange={(e) => setStartCold(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-foreground/85 leading-relaxed">
            Also start the AI cold sequence for these contacts. Touch 1 fires ~15 min later (cancelable per-lead if you misclick). Leave unchecked to handle the warmest names yourself first.
          </span>
        </label>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button type="button" size="sm" onClick={onImport} disabled={importing || importableCount === 0}>
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5" /> Import {importableCount > 0 ? `${importableCount} ` : ""}to CRM</>}
          </Button>
          {importableCount === 0 && !importResult && (
            <span className="text-xs text-foreground/60">Add a row with a name and email to enable import.</span>
          )}
        </div>
        {importError && (
          <p className="text-xs text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2 mt-3">
            {importError}
          </p>
        )}
        {importResult && (
          <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mt-3">
            <p className="font-semibold text-emerald-300 inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Imported {importResult.inserted} into the CRM
            </p>
            {importResult.skipped > 0 && (
              <p className="text-foreground/70 mt-1">{importResult.skipped} already existed in your pipeline and were skipped.</p>
            )}
            {importResult.coldStarted > 0 && (
              <p className="text-foreground/70 mt-1">Cold AI sequence started for {importResult.coldStarted} of them.</p>
            )}
            <p className="text-foreground/70 mt-1">Open the dashboard and filter by <span className="font-semibold">100-list</span> to work them.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

