import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

// Target field id → display label + whether the importer treats it as
// required. Order is the order the dropdown lists them.
const TARGET_FIELDS = [
  { id: "name", label: "Name", required: true },
  { id: "email", label: "Email", required: true },
  { id: "phone", label: "Phone" },
  { id: "notes", label: "Notes" },
  { id: "currentWork", label: "Occupation / current work" },
  { id: "futureVision", label: "Future vision" },
  { id: "bestTime", label: "Best time to reach" },
  { id: "status", label: "Status (new / qualified / engaged / handoff / customer / lost)" },
  { id: "colorCode", label: "Color code (green / red / yellow / blue)" },
  { id: "interest", label: "Interest (products / income)" },
  { id: "timeline", label: "Timeline (now / soon / researching)" },
] as const;

type TargetId = (typeof TARGET_FIELDS)[number]["id"];

// Header-text hints we auto-match to fields when the CSV first loads. Lower-
// cased + trimmed before lookup. Partner can override any guess in the UI.
const HEADER_HINTS: Record<TargetId, string[]> = {
  name: ["name", "full name", "fullname", "contact name", "contact", "first name", "lead name"],
  email: ["email", "email address", "e-mail", "mail"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone", "tel", "phone #"],
  notes: ["notes", "comments", "comment", "remarks", "memo", "description"],
  currentWork: ["occupation", "current work", "work", "job", "title", "company", "employer"],
  futureVision: ["future vision", "vision", "goal", "goals", "dream"],
  bestTime: ["best time", "best time to call", "best contact time", "preferred time"],
  status: ["status", "stage", "pipeline status"],
  colorCode: ["color", "color code", "personality", "color tag"],
  interest: ["interest", "interested in"],
  timeline: ["timeline", "urgency", "when"],
};

const STATUS_VALUES = ["new", "qualified", "engaged", "handoff", "customer", "lost"] as const;
const COLOR_VALUES = ["green", "red", "yellow", "blue"] as const;
const INTEREST_VALUES = ["products", "income"] as const;
const TIMELINE_VALUES = ["now", "soon", "researching"] as const;

type Step = "upload" | "map" | "result";

interface ParseResult {
  headers: string[];
  rows: string[][];
}

// Minimal CSV parser — handles quoted fields, commas inside quotes,
// escaped quotes (""), CRLF/LF line endings, and trailing newline. Empty
// rows are dropped. Not a full RFC 4180 implementation but covers what
// exports out of Excel, Google Sheets, Hubspot, Mailchimp, and the
// long tail of "I downloaded the contacts as CSV" use cases.
function parseCsv(text: string): ParseResult {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      cur.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // swallow — handled by the \n branch below
      i++;
      continue;
    }
    if (ch === "\n") {
      cur.push(field);
      field = "";
      if (cur.some((c) => c.trim() !== "")) rows.push(cur);
      cur = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush trailing field/row
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.some((c) => c.trim() !== "")) rows.push(cur);
  }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  return { headers, rows: rows.slice(1) };
}

function guessMapping(headers: string[]): Record<number, TargetId | "skip"> {
  const used = new Set<TargetId>();
  const mapping: Record<number, TargetId | "skip"> = {};
  headers.forEach((h, idx) => {
    const norm = h.trim().toLowerCase();
    let matched: TargetId | null = null;
    for (const [field, hints] of Object.entries(HEADER_HINTS) as [TargetId, string[]][]) {
      if (used.has(field)) continue;
      if (hints.some((hint) => norm === hint || norm.includes(hint))) {
        matched = field;
        break;
      }
    }
    if (matched) {
      used.add(matched);
      mapping[idx] = matched;
    } else {
      mapping[idx] = "skip";
    }
  });
  return mapping;
}

// Normalize messy enum-ish values. Partner CSVs often have "New", "NEW ",
// "Customer (paying)", etc. We accept any value that contains the expected
// keyword; everything else falls through to undefined so the server-side
// default kicks in.
function normalizeEnum<T extends readonly string[]>(raw: string, allowed: T): T[number] | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  for (const opt of allowed) {
    if (v === opt || v.includes(opt)) return opt;
  }
  return undefined;
}

export function ImportLeadsModal({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<number, TargetId | "skip">>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    insertedCount: number;
    skippedCount: number;
    skippedEmails: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setParseError(null);
    setSubmitError(null);
    setResult(null);
    setSubmitting(false);
  }

  async function handleFile(file: File) {
    setParseError(null);
    try {
      const text = await file.text();
      const out = parseCsv(text);
      if (out.headers.length === 0 || out.rows.length === 0) {
        setParseError("That file looks empty. Make sure the first row is your column headers.");
        return;
      }
      setParsed(out);
      setMapping(guessMapping(out.headers));
      setStep("map");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFile(file);
  }

  // Build the mapped row set for the server. Rows missing name or email
  // are excluded here so the partner sees a real "X skipped, Y imported"
  // number rather than a server validation error.
  const builtRows = useMemo(() => {
    if (!parsed) return { valid: [] as Record<string, string>[], invalidCount: 0 };
    const valid: Record<string, string>[] = [];
    let invalid = 0;
    for (const r of parsed.rows) {
      const row: Record<string, string> = {};
      Object.entries(mapping).forEach(([idxStr, target]) => {
        if (target === "skip") return;
        const idx = Number(idxStr);
        const raw = (r[idx] ?? "").trim();
        if (!raw) return;
        if (target === "status") {
          const v = normalizeEnum(raw, STATUS_VALUES);
          if (v) row.status = v;
        } else if (target === "colorCode") {
          const v = normalizeEnum(raw, COLOR_VALUES);
          if (v) row.colorCode = v;
        } else if (target === "interest") {
          const v = normalizeEnum(raw, INTEREST_VALUES);
          if (v) row.interest = v;
        } else if (target === "timeline") {
          const v = normalizeEnum(raw, TIMELINE_VALUES);
          if (v) row.timeline = v;
        } else {
          row[target] = raw;
        }
      });
      if (!row.name || !row.email) {
        invalid++;
        continue;
      }
      // Basic email shape check — server re-validates, this just keeps the
      // pre-submit count honest.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        invalid++;
        continue;
      }
      valid.push(row);
    }
    return { valid, invalidCount: invalid };
  }, [parsed, mapping]);

  // Which target fields are already taken by another column — used to grey
  // out duplicates in the field-select dropdowns so the partner can't map
  // two CSV columns to the same lead field.
  const usedTargets = useMemo(() => {
    const used = new Set<TargetId>();
    for (const v of Object.values(mapping)) {
      if (v !== "skip") used.add(v);
    }
    return used;
  }, [mapping]);

  const hasName = usedTargets.has("name");
  const hasEmail = usedTargets.has("email");
  const canSubmit = hasName && hasEmail && builtRows.valid.length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api<{
        insertedCount: number;
        skippedCount: number;
        skippedEmails: string[];
      }>("/api/leads/import-csv", {
        method: "POST",
        body: JSON.stringify({ rows: builtRows.valid }),
      });
      setResult(res);
      setStep("result");
      onImported();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a contact list from another CRM, spreadsheet, or email export. We&apos;ll match your columns to the right lead fields, dedupe by email, and add them to your pipeline with the bot paused.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="mt-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-border/60 hover:border-[var(--gold)]/60 hover:bg-white/[0.02] transition px-6 py-10 text-center"
            >
              <Upload className="h-8 w-8 mx-auto text-[var(--gold)]" />
              <div className="mt-3 text-sm font-medium">Choose a CSV file</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                First row should be column headers (Name, Email, Phone, etc.). Up to 1,000 rows per import.
              </div>
            </button>
            {parseError && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {parseError}
              </p>
            )}
            <div className="text-[11px] text-muted-foreground">
              Tip: in Excel or Google Sheets, choose File → Download → CSV (.csv). Most CRM exports already work — Hubspot, Mailchimp, Active Campaign, ConvertKit.
            </div>
          </div>
        )}

        {step === "map" && parsed && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-border/40 bg-white/[0.02] px-4 py-3 flex items-center gap-3">
              <FileSpreadsheet className="h-4 w-4 text-[var(--gold)] shrink-0" />
              <div className="text-[13px]">
                <div className="font-medium">
                  {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} found
                </div>
                <div className="text-muted-foreground text-[12px]">
                  Match each column to a lead field. Name and Email are required.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {parsed.headers.map((header, idx) => {
                const current = mapping[idx] ?? "skip";
                const sample = parsed.rows
                  .slice(0, 3)
                  .map((r) => (r[idx] ?? "").trim())
                  .filter(Boolean)[0];
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2 rounded-lg border border-border/30 bg-white/[0.015]"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{header || `Column ${idx + 1}`}</div>
                      {sample && (
                        <div className="text-[11px] text-muted-foreground truncate">e.g. {sample}</div>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select
                      value={current}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [idx]: e.target.value as TargetId | "skip" }))
                      }
                    >
                      <option value="skip">— Don&apos;t import —</option>
                      {TARGET_FIELDS.map((f) => {
                        const taken = usedTargets.has(f.id) && current !== f.id;
                        return (
                          <option key={f.id} value={f.id} disabled={taken}>
                            {f.label}
                            {f.required ? " *" : ""}
                            {taken ? " (already mapped)" : ""}
                          </option>
                        );
                      })}
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-border/40 bg-white/[0.02] p-3 space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Will import</span>
                <span className="font-medium text-emerald-300">{builtRows.valid.length}</span>
              </div>
              {builtRows.invalidCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rows missing name or email</span>
                  <span className="font-medium text-amber-300">{builtRows.invalidCount}</span>
                </div>
              )}
              {(!hasName || !hasEmail) && (
                <div className="text-amber-200/90">
                  Map a column to {!hasName && !hasEmail ? "Name and Email" : !hasName ? "Name" : "Email"} to continue.
                </div>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="h-3.5 w-3.5" /> Pick a different file
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                ) : (
                  <>Import {builtRows.valid.length} lead{builtRows.valid.length === 1 ? "" : "s"} <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 flex items-center gap-3">
              <Check className="h-5 w-5 text-emerald-300" />
              <div>
                <div className="text-sm font-medium">Import complete</div>
                <div className="text-[12px] text-muted-foreground">
                  Added {result.insertedCount} new lead{result.insertedCount === 1 ? "" : "s"} to your pipeline.
                </div>
              </div>
            </div>

            {result.skippedCount > 0 && (
              <div className="rounded-xl border border-border/40 bg-white/[0.02] px-4 py-3">
                <div className="text-[13px] font-medium flex items-center gap-2">
                  <X className="h-3.5 w-3.5 text-amber-300" />
                  {result.skippedCount} skipped (already in your pipeline)
                </div>
                {result.skippedEmails.length > 0 && (
                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                    {result.skippedEmails.map((e) => (
                      <div key={e}>{e}</div>
                    ))}
                    {result.skippedCount > result.skippedEmails.length && (
                      <div className="italic">
                        … and {result.skippedCount - result.skippedEmails.length} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
