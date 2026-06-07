import type { ColorCode } from "./schema.js";
export type { ColorCode };

// Single source of truth for the Color Code. Used by:
// - the bot prompts (server/bot/prompts.ts) to translate per-color
// - the coach drafts (server/coach/openai.ts) to translate per-color
// - the CRM badge + pre-call intel (client/src/components/lead/color-badge.tsx,
//   client/src/pages/lead-detail.tsx, client/src/pages/dashboard.tsx)
// The plain-string voiceRule lines are written specifically for AI prompts
// to compose with the partner's tone profile. They never appear in UI.
// The magicWord / oneMove / wordsTheyLove come from
// colorcodetraining.pdf and the wallet card.

export interface ColorMeta {
  label: string;
  hex: string;
  magicWord: string;
  oneMove: string;
  wordsTheyLove: string[];
  // Compact rule for the LLM. Sits underneath the partner's tone profile.
  voiceRule: string;
}

export const COLOR_META: Record<ColorCode, ColorMeta> = {
  green: {
    label: "Green (Analyst)",
    hex: "#3fb87b",
    magicWord: "proof",
    oneMove: "Send the data, give a deadline, then go quiet.",
    wordsTheyLove: ["facts", "logic", "proof", "data", "results", "research"],
    voiceRule:
      "Lead with proof and structure. Reference the BalanceTest, the omega ratio, the 120 day cadence. Give them homework with a clear deadline, then back off. No hype. No 'trust me'. Calm, precise, evidence first.",
  },
  red: {
    label: "Red (Driver)",
    hex: "#e85a4f",
    magicWord: "win",
    oneMove: "Compliment, compliment, then challenge them.",
    wordsTheyLove: ["leadership", "win", "competitive", "own it", "results"],
    voiceRule:
      "Short. Confident. Point at a target. Compliment briefly, then challenge them to show up. No long explanation. Speak to ambition and ownership. Never promise earnings. No managing, no babying.",
  },
  yellow: {
    label: "Yellow (Helper)",
    hex: "#e8c054",
    magicWord: "help",
    oneMove: "Make it about people, and make the next step tiny and safe.",
    wordsTheyLove: ["help", "support", "care", "family", "together", "feel better"],
    voiceRule:
      "Make it about helping real people feel better. Walk alongside them like a friend. The next step has to feel small and safe. Never lead with money, ranks, or income. Warmth before structure.",
  },
  blue: {
    label: "Blue (Socializer)",
    hex: "#5ba8d6",
    magicWord: "fun",
    oneMove: "Skip the detail, get them to the room, close fast.",
    wordsTheyLove: ["fun", "exciting", "people", "adventure", "let's go", "energy"],
    voiceRule:
      "Short and energetic. Skip the detail. Point at the next experience, event, or call. No long paragraphs, no PDFs, no comp-plan walkthrough. Fun first, action second.",
  },
};

export function colorVoiceLine(colorCode: ColorCode | null | undefined): string | null {
  if (!colorCode) return null;
  const meta = COLOR_META[colorCode];
  if (!meta) return null;
  return `Color translation for this prospect (${meta.label}): ${meta.voiceRule}`;
}
