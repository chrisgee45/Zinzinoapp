// Per-product partner credit values, extracted from the Zinzino US/EN
// shop (zinzino.com, snapshot 2026-06-18). 178 products total across
// Zinzino Shop (34) and Brand Shop (144).
//
// "Credit value" is Zinzino's internal qualifying-credit unit — the
// commission metric the partner sees and uses for rank/PV math. It's
// NOT a dollar amount, so the UI labels accordingly.
//
// Storage: customer_products.monthly_credit_cents holds credit_value
// × 100 so the integer column can carry the half-credit precision
// (e.g. 1.5 cv → 150). Field name kept for migration simplicity; the
// UI surfaces this as "cv" not "$".

export interface CreditRecord {
  // Pattern tested against the catalog name + optional variant. First
  // hit wins; specific variants live above the base family.
  match: RegExp[];
  // Credit value × 100, kept as an integer so the DB column stays clean.
  creditHundredths: number;
}

// Ordered most-specific → least. Each record's regexes are tested
// against `productName + " " + variant`, then `productName` alone.
const RECORDS: CreditRecord[] = [
  // ── Tests ───────────────────────────────────────────────────────
  { match: [/^BalanceTest$/i, /Balance Test Basic/i], creditHundredths: 500 },
  { match: [/^Gut Health Test x2/i, /Gut Health Mini Kit with Test x2/i], creditHundredths: 1000 },
  { match: [/^Gut Health Test/i, /Gut Health Mini Kit with Test/i], creditHundredths: 600 },
  { match: [/^Vitamin D Test/i], creditHundredths: 300 },
  { match: [/^HbA1c Test/i], creditHundredths: 300 },

  // ── BalanceOil+ family (specific variants first) ──────────────────
  { match: [/^BalanceOil\+ Premium\b.*300/i, /^BalanceOil\+ Premium\b(?!.*100)/i], creditHundredths: 500 },
  { match: [/^BalanceOil\+ AquaX\b/i], creditHundredths: 500 },
  { match: [/^BalanceOil\+ Vegan\b/i], creditHundredths: 500 },
  { match: [/^BalanceOil Tutti Frutti\b/i], creditHundredths: 400 },
  { match: [/^BalanceOil\+.*6\s*x\s*100/i], creditHundredths: 600 },
  { match: [/^BalanceOil\+.*100\s*ml/i], creditHundredths: 150 },
  // Base BalanceOil+ (300ml is the default size in the credit table)
  { match: [/^BalanceOil\+/i, /^BalanceOil\b/i], creditHundredths: 400 },

  // ── Other omega ──────────────────────────────────────────────────
  { match: [/^Essent\+ Premium/i], creditHundredths: 400 },
  { match: [/^R\.?E\.?V\.?O\.?O\b/i], creditHundredths: 700 },
  { match: [/^Dosage Cups?$/i], creditHundredths: 100 },

  // ── Restore / immune / gut ───────────────────────────────────────
  { match: [/^ZinoGene\+/i], creditHundredths: 500 },
  { match: [/^Viva\+.*x\s*2/i], creditHundredths: 400 },
  { match: [/^Viva\+/i], creditHundredths: 300 },
  { match: [/^PhycoSci\+ X20/i, /^PHYCOSCI\+ X20/i], creditHundredths: 400 },
  { match: [/^ZinoShine\+/i, /^Zinoshine\+/i], creditHundredths: 125 },
  { match: [/^Xtend\+/i], creditHundredths: 400 },
  { match: [/^Xtend\b(?!\+)/i], creditHundredths: 300 },
  { match: [/^Protect\+/i], creditHundredths: 400 },
  { match: [/^SpiruMax/i], creditHundredths: 300 },
  { match: [/^ZinoBiotic\+/i], creditHundredths: 300 },
  { match: [/^X[\s-]?Gold\+?/i], creditHundredths: 500 },

  // ── LeanShake flavors / accessories ──────────────────────────────
  { match: [/^LeanShake.*(Chocolate|Strawberry|Vanilla|Berry)/i], creditHundredths: 400 },
  { match: [/^LeanShake Kit/i], creditHundredths: 400 },
  { match: [/^Shake Bottle$/i], creditHundredths: 100 },
  { match: [/^Energy Bar/i], creditHundredths: 125 },
  { match: [/^Measuring Tape$/i], creditHundredths: 100 },

  // ── Skin ─────────────────────────────────────────────────────────
  { match: [/^Collagen Boozt/i], creditHundredths: 500 },
  { match: [/^Skin Serum/i], creditHundredths: 0 },

  // ── Brand Shop — Zeal (Zurvita) ──────────────────────────────────
  { match: [/^Zeal x2 - 10 single-serve/i], creditHundredths: 300 },
  { match: [/^Zeal - 10 single-serve/i, /^Zeal Single/i], creditHundredths: 220 },
  { match: [/^Zeal x2 Kit/i, /^Zeal x2\b/i], creditHundredths: 800 },
  { match: [/^Zeal\b/i], creditHundredths: 570 },

  // ── Brand Shop — Zundora ─────────────────────────────────────────
  { match: [/^Zundora x2/i], creditHundredths: 900 },
  { match: [/^Zundora/i], creditHundredths: 670 },

  // ── Brand Shop — Zurge / hydration ───────────────────────────────
  { match: [/^Zurge x2/i], creditHundredths: 500 },
  { match: [/^Zurge\b/i], creditHundredths: 330 },
  { match: [/^H20 Stickpacks x2/i], creditHundredths: 300 },
  { match: [/^H20 Stickpacks/i], creditHundredths: 200 },

  // ── Brand Shop — Truvy fat-burn / cleanse ────────────────────────
  { match: [/^Burn\+ x2/i], creditHundredths: 500 },
  { match: [/^Burn\+/i], creditHundredths: 360 },
  { match: [/^Cleanse\+ x2/i], creditHundredths: 400 },
  { match: [/^Cleanse\+\b/i], creditHundredths: 270 },
  { match: [/^Amino x2/i], creditHundredths: 500 },
  { match: [/^Amino\b/i], creditHundredths: 360 },

  // ── Brand Shop — Zurvita TW&E / truFIX / reNU ────────────────────
  { match: [/^TW&E \+ truFIX/i], creditHundredths: 350 },
  { match: [/^truFIX/i], creditHundredths: 310 },
  { match: [/^reNU/i], creditHundredths: 200 },
  { match: [/^Pre\+ Probiotic Chews/i], creditHundredths: 260 },
  { match: [/^Collagen \+BHC/i], creditHundredths: 320 },
  { match: [/^Slumber Gummy/i], creditHundredths: 230 },
  { match: [/^TruCaf[ée]/i], creditHundredths: 260 },
  { match: [/^H&H.*Super Drink/i], creditHundredths: 350 },
  { match: [/^Kids Dailies/i], creditHundredths: 170 },
  { match: [/^Letric.*Muscle Rub/i], creditHundredths: 170 },

  // ── Brand Shop — Vemma Verve / Bode ──────────────────────────────
  { match: [/^Verve Sugar Free x2/i], creditHundredths: 600 },
  { match: [/^Verve Sugar Free/i], creditHundredths: 400 },
  { match: [/^Verve Burn x2/i], creditHundredths: 750 },
  { match: [/^Verve Burn/i], creditHundredths: 500 },
  { match: [/^Verve x2/i], creditHundredths: 600 },
  { match: [/^Verve\b/i], creditHundredths: 400 },
  { match: [/^Ionic x2/i], creditHundredths: 500 },
  { match: [/^Ionic\b/i], creditHundredths: 400 },
  { match: [/^Strong OG x2/i], creditHundredths: 500 },
  { match: [/^Strong OG/i], creditHundredths: 400 },
  { match: [/^TEN\b/i], creditHundredths: 550 },
  { match: [/^BelAge/i], creditHundredths: 400 },
  { match: [/^Kronuit Fire/i], creditHundredths: 500 },
  { match: [/^Inner 7/i], creditHundredths: 400 },
  { match: [/^Hasaki (Chocolate|Vanilla|Kit)/i], creditHundredths: 500 },

  // ── Brand Shop — Valentus / SKNY / SLMR ──────────────────────────
  { match: [/^SKNY Gummies/i], creditHundredths: 350 },
  { match: [/^BRN\+?/i], creditHundredths: 500 },
  { match: [/^SLMR/i], creditHundredths: 440 },
  { match: [/^FLAT\b/i], creditHundredths: 350 },
  { match: [/^TFXX/i], creditHundredths: 410 },
  { match: [/^FF\+/i], creditHundredths: 320 },
  { match: [/^Skinny Wrap/i], creditHundredths: 500 },
  { match: [/^FIRM\b/i], creditHundredths: 440 },
  { match: [/^Defining Gel/i], creditHundredths: 460 },
  { match: [/^Timeless\b/i], creditHundredths: 580 },
  { match: [/^HSN\b/i], creditHundredths: 410 },

  // ── Brand Shop — It Works! ───────────────────────────────────────
  { match: [/^(IT WORKS!?\s*)?Greens Multi/i], creditHundredths: 360 },
  { match: [/^(IT WORKS!?\s*)?Cleanse® Kit/i, /^(IT WORKS!?\s*)?Cleanse\b(?!\+)/i], creditHundredths: 400 },
  { match: [/^(IT WORKS!?\s*)?Simply Aloe/i], creditHundredths: 380 },
  { match: [/^(IT WORKS!?\s*)?Collagen Ultra/i], creditHundredths: 330 },
  { match: [/^(IT WORKS!?\s*)?Skinny Hydrate/i], creditHundredths: 380 },
  { match: [/^(IT WORKS!?\s*)?Power Hydrate/i], creditHundredths: 280 },
  { match: [/^(IT WORKS!?\s*)?SKNY Cold Brew/i, /^(IT WORKS!?\s*)?Keto Coffee/i, /^(IT WORKS!?\s*)?SKNY Brew/i], creditHundredths: 410 },
  { match: [/^(IT WORKS!?\s*)?Happy Coffee/i], creditHundredths: 450 },
  { match: [/^(IT WORKS!?\s*)?THKR Thickening Hair/i], creditHundredths: 420 },
  { match: [/^(IT WORKS!?\s*)?Simplypure Scalp Serum/i], creditHundredths: 320 },
  { match: [/^(IT WORKS!?\s*)?Simplypure (Nourishing Shampoo|Nourishing Conditioner|Soothing Body Wash)/i], creditHundredths: 300 },
  { match: [/^(IT WORKS!?\s*)?Simplypure Leave-In/i, /^(IT WORKS!?\s*)?Calming Nightly Facial/i, /^(IT WORKS!?\s*)?Restore Luxury Facial/i, /^(IT WORKS!?\s*)?Nourish Daily Facial/i], creditHundredths: 320 },

  // ── Brand Shop — Bigger systems (kits / drop systems) ────────────
  { match: [/^30-Day Drop System/i, /^Morning Trio/i, /^Body Trio System/i], creditHundredths: 800 },
  { match: [/^Slimming System/i], creditHundredths: 700 },
  { match: [/^30-Day Gut Reset/i], creditHundredths: 600 },
  { match: [/^Morning Duo/i], creditHundredths: 600 },
  { match: [/^GLP-1 Fat Burn/i], creditHundredths: 500 },
  { match: [/^Root Revival/i], creditHundredths: 400 },
];

/**
 * Look up the monthly credit value for a product. Tries
 * "productName variant" first (so "BalanceOil+ 100 ml" hits the
 * 1.5 cv variant rather than the 300 ml default), then plain
 * productName. Returns credit × 100 as an integer, or 0 if no
 * match — the partner can always override via the PATCH endpoint.
 */
export function creditFor(productName: string, variant?: string | null): number {
  const candidates = [
    variant ? `${productName} ${variant}` : null,
    productName,
  ].filter((s): s is string => !!s);

  for (const rec of RECORDS) {
    for (const re of rec.match) {
      for (const candidate of candidates) {
        if (re.test(candidate)) return rec.creditHundredths;
      }
    }
  }
  return 0;
}
