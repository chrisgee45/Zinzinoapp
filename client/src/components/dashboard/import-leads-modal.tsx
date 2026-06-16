import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Loader2, Search, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Step = "upload" | "map" | "select" | "result";

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

// vCard (.vcf) parser. iPhone Contacts → Share → Save to Files writes one
// file per selected contact OR a single multi-contact file (depending on
// how the partner selected them). The format is line-oriented with
// BEGIN:VCARD / END:VCARD delimiters. We pull out FN, EMAIL, TEL, NOTE,
// ORG, and TITLE — enough to land a real contact with name + email +
// phone + a hint of context. Then we shape the output to look like a
// CSV parse so the rest of the modal (mapping, preview, submit) doesn't
// need to know which format it came from.
function parseVCard(text: string): ParseResult {
  // RFC 6350 line unfolding — a leading space or tab on a line means
  // "join me to the previous line." iPhone exports use 75-char folding
  // on long fields like NOTE, so without this we'd truncate.
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");

  const rows: string[][] = [];
  let cur: Record<string, string> | null = null;

  // Each PROPERTY line looks like:  NAME[;PARAM=value][;PARAM=value]:value
  // We split on the first unquoted colon, strip params from the name, and
  // keep the raw param string for tie-breaks (TEL;TYPE=CELL beats
  // TEL;TYPE=HOME when both are present).
  function splitLine(line: string): { name: string; params: string; value: string } | null {
    const colon = line.indexOf(":");
    if (colon === -1) return null;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const semi = left.indexOf(";");
    const name = (semi === -1 ? left : left.slice(0, semi)).toUpperCase();
    const params = semi === -1 ? "" : left.slice(semi + 1).toUpperCase();
    return { name, params, value };
  }

  function preferTel(existing: string | undefined, params: string, value: string): string {
    if (!existing) return value;
    // Prefer CELL / MOBILE / IPHONE over anything else; otherwise keep
    // whatever we found first.
    const isCell = /(CELL|MOBILE|IPHONE)/.test(params);
    return isCell ? value : existing;
  }
  function preferEmail(existing: string | undefined, params: string, value: string): string {
    if (!existing) return value;
    // PREF wins; otherwise first-seen wins.
    return /PREF/.test(params) ? value : existing;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toUpperCase() === "BEGIN:VCARD") {
      cur = {};
      continue;
    }
    if (line.toUpperCase() === "END:VCARD") {
      if (cur) {
        // Build display name. Prefer FN; fall back to assembled N field
        // (last;first;middle;prefix;suffix → "first last").
        let name = cur.fn ?? "";
        if (!name && cur.n) {
          const parts = cur.n.split(";").map((p) => p.trim());
          name = [parts[1], parts[0]].filter(Boolean).join(" ");
        }
        // Combine TITLE + ORG into one "current work" string so the mapping
        // can drop it into currentWork without losing either side.
        const work = [cur.title, cur.org?.split(";")[0]].filter(Boolean).join(" · ");
        rows.push([
          name,
          cur.email ?? "",
          cur.tel ?? "",
          work,
          cur.note ?? "",
        ]);
        cur = null;
      }
      continue;
    }
    if (!cur) continue;
    const parsed = splitLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;
    // Decode minimal quoted-printable for v2.1 exports — replaces =0A with
    // newline and =XX hex pairs with the corresponding char. iOS exports
    // are v3.0+ which don't use QP, so this only kicks in for legacy
    // Android/Outlook exports the partner might also try to drop in here.
    let decoded = value;
    if (/QUOTED-PRINTABLE/.test(params)) {
      decoded = decoded.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
    switch (name) {
      case "FN":
        cur.fn = decoded.trim();
        break;
      case "N":
        cur.n = decoded;
        break;
      case "EMAIL":
        cur.email = preferEmail(cur.email, params, decoded.trim());
        break;
      case "TEL":
        cur.tel = preferTel(cur.tel, params, decoded.trim());
        break;
      case "NOTE":
        cur.note = decoded.trim();
        break;
      case "ORG":
        cur.org = decoded.trim();
        break;
      case "TITLE":
        cur.title = decoded.trim();
        break;
      default:
        break;
    }
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  return {
    headers: ["Name", "Email", "Phone", "Occupation", "Notes"],
    rows,
  };
}

function detectFormat(filename: string, text: string): "vcard" | "csv" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".vcf") || lower.endsWith(".vcard")) return "vcard";
  // Content sniff — sometimes iPhone shares come in without an extension
  // (especially via Files app or "Save to Files"). The first non-blank
  // line of a vCard is always BEGIN:VCARD.
  if (/^\s*BEGIN:VCARD/i.test(text.slice(0, 200))) return "vcard";
  return "csv";
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
  // Indexes into builtRows.valid that the partner has checked for import.
  // Defaults to all-on after mapping changes — re-derived in an effect
  // below so the picker stays in sync if the partner remaps a column
  // upstream and the valid-row count shifts.
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(() => new Set());
  const [pickerSearch, setPickerSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setParseError(null);
    setSubmitError(null);
    setResult(null);
    setSubmitting(false);
    setSelectedIdx(new Set());
    setPickerSearch("");
  }

  async function handleFile(file: File) {
    setParseError(null);
    try {
      const text = await file.text();
      const format = detectFormat(file.name, text);
      const out = format === "vcard" ? parseVCard(text) : parseCsv(text);
      if (out.headers.length === 0 || out.rows.length === 0) {
        setParseError(
          format === "vcard"
            ? "That .vcf file didn't have any contacts we could read. Try re-exporting from Contacts → Share → Save to Files."
            : "That file looks empty. Make sure the first row is your column headers.",
        );
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
  const canAdvanceToPicker = hasName && hasEmail && builtRows.valid.length > 0;

  // Reset selection to "all on" whenever the valid-row count changes —
  // a remap upstream can add/remove valid rows, and stale indexes that
  // no longer exist would silently exclude contacts.
  useEffect(() => {
    setSelectedIdx(new Set(builtRows.valid.map((_, i) => i)));
  }, [builtRows.valid.length]);

  // Filter rows for the picker step. Search hits name OR email,
  // case-insensitive. We keep the original index attached so toggling
  // the checkbox flips the right entry in selectedIdx.
  const pickerRows = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return builtRows.valid
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => {
        if (!q) return true;
        return (
          (row.name ?? "").toLowerCase().includes(q) ||
          (row.email ?? "").toLowerCase().includes(q)
        );
      });
  }, [builtRows.valid, pickerSearch]);

  const allFilteredSelected =
    pickerRows.length > 0 && pickerRows.every(({ idx }) => selectedIdx.has(idx));
  const canSubmit = selectedIdx.size > 0 && !submitting;

  function toggleRow(idx: number) {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const { idx } of pickerRows) next.delete(idx);
      } else {
        for (const { idx } of pickerRows) next.add(idx);
      }
      return next;
    });
  }

  async function submit() {
    if (!canSubmit) return;
    const rowsToSend = builtRows.valid.filter((_, i) => selectedIdx.has(i));
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api<{
        insertedCount: number;
        skippedCount: number;
        skippedEmails: string[];
      }>("/api/leads/import-csv", {
        method: "POST",
        body: JSON.stringify({ rows: rowsToSend }),
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
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload a CSV from another CRM or spreadsheet, or a .vcf file straight from your iPhone Contacts. We&apos;ll match the fields, dedupe by email, and add them to your pipeline with the bot paused.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="mt-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.vcf,.vcard,text/csv,text/vcard,text/x-vcard,text/plain"
              className="sr-only"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-border/60 hover:border-[var(--gold)]/60 hover:bg-white/[0.02] transition px-6 py-10 text-center"
            >
              <Upload className="h-8 w-8 mx-auto text-[var(--gold)]" />
              <div className="mt-3 text-sm font-medium">Choose a file</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                CSV from a spreadsheet, or .vcf from iPhone Contacts. Up to 1,000 contacts per import.
              </div>
            </button>
            {parseError && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {parseError}
              </p>
            )}
            <div className="rounded-xl border border-border/40 bg-white/[0.02] px-4 py-3 text-[12px] space-y-2">
              <div className="font-medium text-foreground/90">From iPhone Contacts</div>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>Open the Contacts app on your iPhone.</li>
                <li>Tap <span className="text-foreground/90">Lists</span> → choose a list (or All Contacts).</li>
                <li>Tap a contact, then in the next contact tap <span className="text-foreground/90">Edit</span> → tap multiple to select more — or share a single contact directly.</li>
                <li>Tap <span className="text-foreground/90">Share Contact</span> → <span className="text-foreground/90">Save to Files</span>.</li>
                <li>Come back here and upload that .vcf file.</li>
              </ol>
              <div className="text-muted-foreground">
                Alternate: AirDrop the contacts to your Mac → drag the .vcf into this browser.
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              For CSVs: Excel or Google Sheets → File → Download → CSV. Hubspot, Mailchimp, Active Campaign, and ConvertKit exports work out of the box.
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

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="h-3.5 w-3.5" /> Pick a different file
              </Button>
              <Button onClick={() => setStep("select")} disabled={!canAdvanceToPicker}>
                Pick contacts <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "select" && (
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-border/40 bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-[13px]">
                <div className="font-medium">
                  {selectedIdx.size} of {builtRows.valid.length} selected
                </div>
                <div className="text-muted-foreground text-[12px]">
                  Untick anyone you don&apos;t want in your pipeline. Defaults to all selected.
                </div>
              </div>
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-border/50 hover:bg-white/[0.04] transition shrink-0"
              >
                {allFilteredSelected ? "Deselect" : "Select"} {pickerSearch.trim() ? "visible" : "all"}
              </button>
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name or email…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            <div className="rounded-xl border border-border/40 max-h-[55dvh] overflow-y-auto divide-y divide-border/20">
              {pickerRows.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                  No contacts match that search.
                </div>
              ) : (
                pickerRows.map(({ row, idx }) => {
                  const checked = selectedIdx.has(idx);
                  return (
                    <label
                      key={idx}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(idx)}
                        className="h-4 w-4 accent-[var(--gold)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{row.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {row.email}
                          {row.phone ? ` · ${row.phone}` : ""}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {submitError && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("map")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to mapping
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                ) : (
                  <>Import {selectedIdx.size} lead{selectedIdx.size === 1 ? "" : "s"} <ArrowRight className="h-4 w-4" /></>
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
