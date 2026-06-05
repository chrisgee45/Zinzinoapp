/**
 * Partner-defined headline variants for A/B testing.
 *
 * Storage format: site_content.headline_variants = JSON string of an array
 * of plain headline strings. The funnel picks one at random on first visit
 * and persists the chosen index in localStorage so the same visitor always
 * sees the same variant. Conversion analysis happens in Meta/TikTok/GA via
 * the pixel events fired on Lead and CompleteRegistration.
 */

const STORAGE_PREFIX = "bfa_headline_";

export function parseHeadlineVariants(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export function serializeHeadlineVariants(variants: string[]): string {
  return JSON.stringify(variants.map((v) => v.trim()).filter((v) => v.length > 0).slice(0, 4));
}

export function pickHeadlineVariant(slug: string, variants: string[]): { variant: string | null; index: number } {
  if (variants.length === 0) return { variant: null, index: -1 };
  if (typeof window === "undefined") return { variant: variants[0], index: 0 };

  const key = `${STORAGE_PREFIX}${slug}`;
  let index: number | null = null;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < variants.length) {
        index = parsed;
      }
    }
  } catch {
    /* private mode */
  }
  if (index === null) {
    index = Math.floor(Math.random() * variants.length);
    try {
      window.localStorage.setItem(key, String(index));
    } catch {
      /* ignore */
    }
  }
  return { variant: variants[index], index };
}
