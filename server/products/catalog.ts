// Z Force / Zinzino product catalog — parser + retrieval.
//
// The raw markdown lives at data/zforce-product-knowledge.md and is read once
// at server boot. Each product appears as `### N. Name` (or `### Brand N. Name`
// in the second catalog) followed by metadata lines and a fenced ``` block
// containing labelled sub-sections. We parse the whole thing into a flat
// Product[] array, then keep it in memory for searchProducts/findProduct/
// formatProduct/catalogBlock.

import fs from "node:fs";
import path from "node:path";
import { pdfRuleFor } from "./pdfMap.js";

export interface Product {
  name: string;
  brand: string;
  tagline: string;
  priceLine: string;
  overview: string;
  keyBenefits: string[];
  ingredients: string;
  howToUse: string;
  url: string;
  factSheet: string;
}

// Tokens dropped from queries before scoring — small set so we don't lose
// meaning. The catalog uses brand names, supplement terms, and casual goal
// phrasing ("burn fat", "gut health"), so most stopwords are safe to skip.
const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "by", "can", "do", "does",
  "for", "from", "have", "i", "if", "in", "into", "is", "it", "its", "me", "my",
  "of", "on", "or", "our", "out", "so", "that", "the", "their", "them", "they",
  "this", "to", "us", "we", "what", "when", "where", "who", "why", "will",
  "with", "you", "your",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ── Parser ──────────────────────────────────────────────────────────────────

// Strips the numeric / brand prefix off a heading like:
//   "### 1. Amino Kit"                      → "Amino Kit"
//   "### Bode Pro 17. BalanceOil+ Vegan…"   → "BalanceOil+ Vegan…"
// We keep the brand separately in `brand`, so the prefix is noise here.
function cleanHeading(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^[A-Za-z][A-Za-z\s!]*?\d+\.\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim();
}

// Inside a product's fenced ``` block, the second non-empty line is the
// tagline (e.g. "Essential amino acid supplement"). Headings that match
// section labels mark transitions to the next section.
const SECTION_HEADERS = new Set([
  "what's included?",
  "premier price",
  "product overview",
  "key benefits",
  "more information",
  "ingredients",
  "how to use",
  "documents and certificates",
]);

function extractPriceLine(fence: string[], productName: string): string {
  // Catalog 1 layout: a few lines after the heading look like:
  //   "Start Kit+ subscription"
  //   "$40.00"
  //   "$40.00/month"
  //   ... eventually "Premier Price\n$40.00\n$57.00\nSave 30%"
  // Catalog 2 layout for single-item products:
  //   "One-time" / "Premier Price" / "Retail" prices in mixed lines.
  // We grab the first $-bearing block as the price summary — it's the simplest
  // representation that holds up across catalogs without fragile heuristics.
  const dollarPattern = /\$\d/;
  const savePattern = /Save\s+\d+%/i;
  const collected: string[] = [];
  for (let i = 0; i < fence.length; i++) {
    const line = fence[i].trim();
    if (!line) continue;
    if (dollarPattern.test(line) || savePattern.test(line) || /Premier Price|Start Kit|One-time|Retail|RRP/i.test(line)) {
      collected.push(line);
    }
    if (collected.length >= 8) break;
  }
  if (collected.length === 0) return "";
  // Compact noisy whitespace into one line so the prompt stays tight.
  return collected.join(" · ").replace(/\s+/g, " ").trim().slice(0, 240) || productName;
}

interface SectionState {
  overview: string[];
  keyBenefits: string[];
  ingredients: string[];
  howToUse: string[];
  tagline: string;
}

function extractSections(fence: string[]): SectionState {
  const state: SectionState = {
    overview: [],
    keyBenefits: [],
    ingredients: [],
    howToUse: [],
    tagline: "",
  };
  let current: keyof Pick<SectionState, "overview" | "keyBenefits" | "ingredients" | "howToUse"> | null = null;
  let sawHeading = false;

  // Tagline: second non-empty line of the fence, before any section header.
  let taglineCandidate = "";
  for (const line of fence.slice(0, 4)) {
    const l = line.trim();
    if (!l) continue;
    if (SECTION_HEADERS.has(l.toLowerCase())) break;
    if (!taglineCandidate) {
      // first non-empty is the product name — skip
      taglineCandidate = " ";
      continue;
    }
    if (taglineCandidate === " ") {
      taglineCandidate = l;
      break;
    }
  }
  state.tagline = taglineCandidate.trim() === "" ? "" : taglineCandidate;

  for (const raw of fence) {
    const line = raw.trim();
    const lower = line.toLowerCase();
    if (SECTION_HEADERS.has(lower)) {
      sawHeading = true;
      switch (lower) {
        case "product overview":
          current = "overview";
          break;
        case "key benefits":
          current = "keyBenefits";
          break;
        case "ingredients":
          current = "ingredients";
          break;
        case "how to use":
          current = "howToUse";
          break;
        default:
          current = null;
      }
      continue;
    }
    if (!sawHeading) continue;
    if (!current) continue;
    if (!line) continue;
    // Stop the moment we hit a footer marker
    if (/^\*?These statements have not been evaluated/i.test(line)) continue;
    if (current === "keyBenefits") {
      state.keyBenefits.push(line);
    } else {
      (state[current] as string[]).push(line);
    }
  }
  return state;
}

function parseProductBlock(block: string): Product | null {
  const lines = block.split("\n");
  const headingLine = lines[0];
  const name = cleanHeading(headingLine);
  if (!name) return null;

  let brand = "Zinzino";
  let url = "";
  let factSheet = "";

  // Metadata lines sit between the heading and the fenced block. Catalog 2
  // formats them as markdown list items ("- **Brand:** ..."), so we strip
  // the leading "- " before matching.
  let i = 1;
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```")) break;
    const l = trimmed.replace(/^[-*]\s+/, "");
    const brandMatch = l.match(/^\*\*Brand:\*\*\s*(.+)$/i);
    if (brandMatch) brand = brandMatch[1].trim();
    const urlMatch = l.match(/^\*\*Product URL:\*\*\s*(\S+)/i);
    if (urlMatch) url = urlMatch[1].trim();
    const sheetMatch = l.match(/^\*\*Official Product Fact Sheet \(PDF\):\*\*\s*(\S+)/i);
    if (sheetMatch) factSheet = sheetMatch[1].trim();
  }

  // Pull the fenced block.
  let fenceStart = -1;
  let fenceEnd = -1;
  for (let j = i; j < lines.length; j++) {
    if (lines[j].trim().startsWith("```")) {
      if (fenceStart === -1) {
        fenceStart = j + 1;
      } else {
        fenceEnd = j;
        break;
      }
    }
  }
  if (fenceStart === -1) return null;
  if (fenceEnd === -1) fenceEnd = lines.length;
  const fence = lines.slice(fenceStart, fenceEnd);

  const sections = extractSections(fence);
  const priceLine = extractPriceLine(fence, name);

  // Override / fill the factSheet URL from the rule table. The catalog
  // markdown only carries the field for a partial sweep of products;
  // pdfMap.ts ships the canonical URLs partner-side has approved.
  // Extracted body text (when present) merges into the matching field
  // so the Advisor + customer-care AI can quote from the real fact
  // sheet instead of the abbreviated catalog summary.
  const rule = pdfRuleFor(name);
  let overview = sections.overview.join(" ").replace(/\s+/g, " ").trim().slice(0, 700);
  let ingredients = sections.ingredients.join(" ").replace(/\s+/g, " ").trim().slice(0, 500);
  let howToUse = sections.howToUse.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
  let finalFactSheet = factSheet;
  if (rule) {
    finalFactSheet = rule.factSheet;
    if (rule.extracted) {
      if (rule.extracted.overview) overview = (overview + " " + rule.extracted.overview).trim().slice(0, 1400);
      if (rule.extracted.ingredients) ingredients = (ingredients + " " + rule.extracted.ingredients).trim().slice(0, 1000);
      if (rule.extracted.howToUse) howToUse = (howToUse + " " + rule.extracted.howToUse).trim().slice(0, 800);
    }
  }

  return {
    name,
    brand,
    tagline: sections.tagline.slice(0, 200),
    priceLine,
    overview,
    keyBenefits: sections.keyBenefits.slice(0, 10),
    ingredients,
    howToUse,
    url,
    factSheet: finalFactSheet,
  };
}

function parseCatalog(markdown: string): Product[] {
  const lines = markdown.split("\n");
  // Split on `### ` headings — but skip anything inside Section 1/2/3 metadata
  // that uses `### Suggested data model`, `### Implementation notes`, etc.
  // These never have a Product URL line, so they fall out of parseProductBlock
  // naturally. We don't try to be clever here.
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (line.startsWith("### ") && line !== lines[0]) {
      if (cur.length) blocks.push(cur.join("\n"));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur.join("\n"));

  const products: Product[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const p = parseProductBlock(block);
    if (!p) continue;
    // Drop the category placeholder rows with no price AND no overview.
    if (!p.priceLine && !p.overview) continue;
    // Catalog 2 republishes many Catalog 1 products under a brand. Dedupe by
    // (name, brand) so we don't return two near-identical results.
    const key = `${p.brand}:::${p.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    products.push(p);
  }
  return products;
}

// ── Runtime cache ───────────────────────────────────────────────────────────

let PRODUCTS: Product[] = [];
let TOKEN_INDEX: Map<string, Set<number>> = new Map();
let LOADED = false;

function buildTokenIndex(products: Product[]): Map<string, Set<number>> {
  const idx = new Map<string, Set<number>>();
  products.forEach((p, i) => {
    const all = `${p.name} ${p.tagline} ${p.overview} ${p.keyBenefits.join(" ")} ${p.ingredients} ${p.brand}`;
    for (const tok of tokenize(all)) {
      if (!idx.has(tok)) idx.set(tok, new Set());
      idx.get(tok)!.add(i);
    }
  });
  return idx;
}

function load(): void {
  if (LOADED) return;
  // Look for the catalog in a few likely spots. Railway runs `node
  // dist/server.js` from the repo root, but a different deploy could put
  // the binary next to a `data/` dir — try both before giving up.
  const candidates = [
    path.resolve(process.cwd(), "data/zforce-product-knowledge.md"),
    path.resolve(process.cwd(), "../data/zforce-product-knowledge.md"),
  ];
  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      PRODUCTS = parseCatalog(raw);
      TOKEN_INDEX = buildTokenIndex(PRODUCTS);
      LOADED = true;
      console.log(`[products] loaded ${PRODUCTS.length} products from ${filePath}`);
      return;
    } catch {
      // Try the next candidate.
    }
  }
  console.warn(`[products] catalog not found in any candidate path:`, candidates);
  PRODUCTS = [];
  TOKEN_INDEX = new Map();
  LOADED = true;
}

// ── Retrieval helpers ───────────────────────────────────────────────────────

export function searchProducts(query: string, limit = 3): Product[] {
  load();
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scores = new Map<number, number>();
  for (const tok of tokens) {
    const hits = TOKEN_INDEX.get(tok);
    if (!hits) continue;
    for (const idx of hits) {
      const p = PRODUCTS[idx];
      // Name match is the strongest signal — boost ~5x per spec.
      const nameHit = p.name.toLowerCase().includes(tok) ? 5 : 0;
      const taglineHit = p.tagline.toLowerCase().includes(tok) ? 2 : 0;
      scores.set(idx, (scores.get(idx) ?? 0) + 1 + nameHit + taglineHit);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([idx]) => PRODUCTS[idx]);
}

export function findProduct(name: string): Product | null {
  load();
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const exact = PRODUCTS.find((p) => p.name.toLowerCase() === needle);
  if (exact) return exact;
  const sub = PRODUCTS.find((p) => p.name.toLowerCase().includes(needle));
  if (sub) return sub;
  const search = searchProducts(name, 1);
  return search[0] ?? null;
}

export function allProducts(): Product[] {
  load();
  return PRODUCTS;
}

export function formatProduct(p: Product): string {
  const lines: string[] = [];
  const brandSuffix = p.brand && p.brand !== "Zinzino" ? ` [${p.brand} line]` : "";
  lines.push(`${p.name}${brandSuffix}`);
  if (p.tagline) lines.push(p.tagline);
  if (p.priceLine) lines.push(`Price: ${p.priceLine}`);
  if (p.overview) lines.push(`Overview: ${p.overview}`);
  if (p.keyBenefits.length) lines.push(`Key benefits: ${p.keyBenefits.slice(0, 6).join("; ")}`);
  if (p.ingredients) lines.push(`Ingredients: ${p.ingredients}`);
  if (p.howToUse) lines.push(`How to use: ${p.howToUse}`);
  if (p.factSheet) lines.push(`Fact sheet: ${p.factSheet}`);
  return lines.join("\n");
}

const CATALOG_USE_NOTE = `The CATALOG FACTS below are official Zinzino product information. Zinzino owns every product line shown here — including the Bode Pro, Truvy, Valentus, Zurvita and It Works! lines — so treat each one as a Zinzino product and answer about it with the same confidence, using its overview, benefits, ingredients, usage and price exactly as given. Never say or imply a product is 'not a Zinzino product', and never redirect anyone to another company's website or support team. You may state product names and prices exactly. For health benefits, stay within the structure/function wording provided; never claim a product treats, cures, prevents or diagnoses any disease, and never promise or guarantee results.`;

export function catalogBlock(products: Product[]): string {
  if (products.length === 0) return "";
  const blocks = products.map((p) => formatProduct(p)).join("\n\n---\n\n");
  return `CATALOG FACTS (relevant products):\n${blocks}\n\n${CATALOG_USE_NOTE}`;
}
