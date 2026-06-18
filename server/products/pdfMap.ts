// Rule-based PDF fact-sheet attachment for the Z Force product catalog.
//
// The raw catalog markdown carries a `factSheet` field per product, but
// it was a partial sweep — many SKUs were missing the link, and several
// product families share one canonical fact sheet across variants
// (BalanceOil+ has 22 SKUs that all reference the same Premium / AquaX /
// Vegan / base PDF depending on which line they belong to).
//
// Rules are applied in order during catalog parse. The first matching
// rule wins for a given product, so place specific variants (e.g.
// "BalanceOil+ Premium") above the base family ("BalanceOil+"). The
// `match` field is a list of regular expressions tested against the
// product's name (case-insensitive). If any regex matches and the
// product doesn't already have a more-specific match, the rule's
// `factSheet` URL is assigned.
//
// Future extension: when the PDFs become reachable from this
// environment, we extract the body text and attach it to each matched
// product's overview/ingredients so the Advisor + customer-care AI can
// quote from the real fact sheet, not just the abbreviated catalog
// summary. The shape below leaves room (`extracted?`) for that without
// requiring another wire-up.

export interface PdfRule {
  factSheet: string;
  match: RegExp[];
  // Substantive content extracted from the PDF — overview, ingredient
  // tables, dosage warnings, certifications. Filled in once the PDFs
  // are accessible. Empty for now; the URL is still useful by itself.
  extracted?: {
    overview?: string;
    ingredients?: string;
    howToUse?: string;
    notes?: string;
  };
}

const BASE = "https://zinzinowebstorage.blob.core.windows.net/product-sheets";

// Order matters — most specific first. Each PDF's match block lists
// every catalog name pattern it should attach to.
export const PDF_RULES: PdfRule[] = [
  // ── BalanceOil+ family FIRST (specific variants first within it) ───
  // These run before the standalone tests because catalog names like
  // "BalanceOil+ Vegan Kit with Test" should reference the OIL's fact
  // sheet — the BalanceTest is bundled as a kit add-on, not the
  // primary product.
  {
    factSheet: `${BASE}/BalanceOil-plus-Premium-en-US.pdf`,
    match: [/^BalanceOil\+\s*Premium\b/i],
  },
  {
    factSheet: `${BASE}/BalanceOil-plus-AquaX-en-US.pdf`,
    match: [/^BalanceOil\+\s*AquaX\b/i],
  },
  {
    factSheet: `${BASE}/BalanceOil-plus-Vegan-en-US.pdf`,
    match: [/^BalanceOil\+\s*Vegan\b/i],
  },
  {
    factSheet: `${BASE}/BalanceOil-Tutti-Frutti-en-US.pdf`,
    match: [/^BalanceOil Tutti Frutti/i],
  },
  // Base BalanceOil+ — runs after the specific variants above so it
  // only catches the plain "BalanceOil+ Kit", "BalanceOil+ 300ml",
  // "BalanceOil x2 Kit with Test", etc.
  {
    factSheet: `${BASE}/BalanceOil-plus-en-US.pdf`,
    match: [/^BalanceOil\+/i, /^BalanceOil\b/i],
  },

  // ── Tests — ONLY standalone test products ──────────────────────────
  // Patterns are anchored so an oil/supplement "Kit with Test" SKU
  // doesn't claim a test fact sheet.
  {
    factSheet: `${BASE}/BalanceTest-en-US.pdf`,
    match: [/^BalanceTest$/i, /^Balance Test Basic/i, /^BalanceTest\s*x\s*\d/i],
  },
  {
    factSheet: `${BASE}/GutHealth-Test-en-US.pdf`,
    match: [/^Gut Health Test/i, /^Gut Health Mini Kit with Test/i],
  },
  {
    factSheet: `${BASE}/VitaminD-Test-en-US.pdf`,
    match: [/^Vitamin D Test/i],
  },
  {
    factSheet: `${BASE}/HbA1c-Test-en-US.pdf`,
    match: [/^HbA1c Test/i],
  },

  // ── Essent+ ────────────────────────────────────────────────────────
  {
    factSheet: `${BASE}/Essent-plus-Premium-en-US.pdf`,
    match: [/^Essent\+\s*Premium/i],
  },

  // ── ZinoGene+ ──────────────────────────────────────────────────────
  {
    factSheet: `${BASE}/ZinoGene-plus-en-US.pdf`,
    match: [/^ZinoGene\+/i],
  },

  // ── Viva+ (questionnaire also attaches to the family) ──────────────
  {
    factSheet: `${BASE}/Viva-plus-en-US.pdf`,
    match: [/^Viva\+/i],
  },

  // ── PhycoSci+ X20 ──────────────────────────────────────────────────
  {
    factSheet: `${BASE}/PhycoSci-X20-en-US.pdf`,
    match: [/^PhycoSci\+\s*X20/i],
  },

  // ── ZinoShine+ ─────────────────────────────────────────────────────
  {
    factSheet: `${BASE}/ZinoShine-plus-en-US.pdf`,
    match: [/^ZinoShine\+/i, /^Zinoshine\+/i],
  },

  // ── Xtend+ (must precede plain Xtend so the "+" variant wins) ──────
  {
    factSheet: `${BASE}/Xtend-plus-en-US.pdf`,
    match: [/^Xtend\+/i],
  },
  {
    factSheet: `${BASE}/Xtend-en-US.pdf`,
    match: [/^Xtend\b(?!\+)/i],
  },

  // ── Protect+ ───────────────────────────────────────────────────────
  {
    factSheet: `${BASE}/Protect-plus-en-US.pdf`,
    match: [/^Protect\+/i],
  },

  // ── SpiruMax / SpiruMax+ ───────────────────────────────────────────
  {
    factSheet: `${BASE}/SpiruMax-en-US.pdf`,
    match: [/^SpiruMax/i],
  },

  // ── ZinoBiotic+ ────────────────────────────────────────────────────
  {
    factSheet: `${BASE}/ZinoBiotic-plus-en-US.pdf`,
    match: [/^ZinoBiotic\+/i],
  },

  // ── LeanShake — flavor-grouped ─────────────────────────────────────
  // Chocolate + Strawberry share one fact sheet.
  {
    factSheet: `${BASE}/LeanShake-Chocolate-Strawberry-en-US.pdf`,
    match: [/^LeanShake\s*(Chocolate|Strawberry)/i],
  },
  // Berry + Vanilla share the other.
  {
    factSheet: `${BASE}/LeanShake-Berry-Vanilla-en-US.pdf`,
    match: [/^LeanShake\s*(Berry|Vanilla)/i],
  },
  // LeanShake Kit (generic) — falls through to the Chocolate sheet by
  // convention since that's the canonical reference doc.
  {
    factSheet: `${BASE}/LeanShake-Chocolate-Strawberry-en-US.pdf`,
    match: [/^LeanShake Kit/i],
  },

  // ── Energy Bar ─────────────────────────────────────────────────────
  {
    factSheet: `${BASE}/EnergyBar-en-US.pdf`,
    match: [/^Energy Bar/i],
  },

  // ── Collagen Boozt ─────────────────────────────────────────────────
  {
    factSheet: `${BASE}/Collagenboozt-en-US.pdf`,
    match: [/^Collagen Boozt/i],
  },

  // ── Skin Serum ─────────────────────────────────────────────────────
  {
    factSheet: `${BASE}/Skin-Serum-en-US.pdf`,
    match: [/^Skin Serum/i],
  },
];

/**
 * Find the first rule whose match-list hits the given product name.
 * Returns null if no rule fires.
 */
export function pdfRuleFor(productName: string): PdfRule | null {
  for (const rule of PDF_RULES) {
    for (const re of rule.match) {
      if (re.test(productName)) return rule;
    }
  }
  return null;
}
