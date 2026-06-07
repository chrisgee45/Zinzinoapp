import type { ColorCode } from "./schema.js";
export type { ColorCode };

// Single source of truth for the Color Code. Used by:
// - the bot prompts (server/bot/prompts.ts) to translate per-color
// - the coach drafts (server/coach/openai.ts) to translate per-color
// - the CRM badge + pre-call intel (client/src/components/lead/color-badge.tsx,
//   client/src/pages/lead-detail.tsx, client/src/pages/dashboard.tsx)
// - the "How to talk to this color" modal on the lead detail page
// The plain-string voiceRule lines are written specifically for AI prompts
// to compose with the partner's tone profile. They never appear in UI.
// The magicWord / oneMove / wordsTheyLove come from
// colorcodetraining.pdf and the wallet card.

// Per-channel scripts. Plain text. First-person partner voice. No em dashes,
// no banned phrases, no earnings claims. {firstName} is the only placeholder
// the UI substitutes. The phone-call script is the "first 30 seconds" beat
// the partner walks into the call with.
export interface ColorScripts {
  text: string;
  email: { subject: string; body: string };
  call: string;
  leadWith: string;
  avoid: string;
}

export interface ColorMeta {
  label: string;
  hex: string;
  magicWord: string;
  oneMove: string;
  wordsTheyLove: string[];
  // Compact rule for the LLM. Sits underneath the partner's tone profile.
  voiceRule: string;
  scripts: ColorScripts;
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
    scripts: {
      leadWith: "Data, before/after numbers, the BalanceTest protocol, the 120-day structure. They want to read it themselves, not be told.",
      avoid: "Hype. Pressure. 'Just trust me.' Stories without numbers. Vague timelines. Anything that feels like a sales pitch.",
      text: "Hey {firstName}, quick one. I came across something I think might pass your sniff test. It's built on a dried-blood-spot test that gives you actual before/after numbers on your omega 6:3 ratio. Want me to send you the protocol you can pick apart?",
      email: {
        subject: "Numbers, not claims",
        body: "Hey {firstName},\n\nI thought of you because you always want the receipts. This whole thing runs off a blood test you take at home. You get your actual omega 6:3 ratio before, then again after 120 days on the protocol. You read your own data. The numbers either moved or they didn't.\n\nI'll send you the full protocol if you want to look it over. Take your own time with it.\n\n{partnerFirstName}",
      },
      call: "Before I say anything I want to ask: are you actually looking at starting something right now, or still in info-collection mode? Either is fine. Here's what's different. I'll send you the data first. You don't have to take my word for any of it. The numbers either moved or they didn't. Then we can talk through what you saw.",
    },
  },
  red: {
    label: "Red (Driver)",
    hex: "#e85a4f",
    magicWord: "win",
    oneMove: "Compliment, compliment, then challenge them.",
    wordsTheyLove: ["leadership", "win", "competitive", "own it", "results"],
    voiceRule:
      "Short. Confident. Point at a target. Compliment briefly, then challenge them to show up. No long explanation. Speak to ambition and ownership. Never promise earnings. No managing, no babying.",
    scripts: {
      leadWith: "A target. A rank. A challenge. Speed. Ownership. Talk about the structure of the first 90 days, not feelings.",
      avoid: "Long explanations. Soft openers. Anything that reads as managing them or selling them. No 'just touching base.' No fluff.",
      text: "Hey {firstName}, 30 seconds. I run something pretty competitive and I want to see if you can out-build me. No fluff, just numbers. Worth a quick call?",
      email: {
        subject: "Quick one for {firstName}",
        body: "{firstName},\n\nI won't waste your time. I run an asset-build with rank targets and a leaderboard. Three-month structure, real ranks, real ownership of your own team.\n\nI know you. You'd eat half my team alive in 30 days. The question is whether you want the challenge.\n\nWant the breakdown? Yes or no.\n\n{partnerFirstName}",
      },
      call: "I'll keep it tight. I run an asset-build with rank targets and a real structure. Three-month window, clear targets. You'd probably out-build half my team in 30 days. The only question is whether you want the challenge. Yes or no.",
    },
  },
  yellow: {
    label: "Yellow (Helper)",
    hex: "#e8c054",
    magicWord: "help",
    oneMove: "Make it about people, and make the next step tiny and safe.",
    wordsTheyLove: ["help", "support", "care", "family", "together", "feel better"],
    voiceRule:
      "Make it about helping real people feel better. Walk alongside them like a friend. The next step has to feel small and safe. Never lead with money, ranks, or income. Warmth before structure.",
    scripts: {
      leadWith: "People. The before/after stories. The small first step. Walking with them, not selling them. The protocol is for the people they care about, not for a paycheck.",
      avoid: "Income. Ranks. Comp plan. Pressure. Big asks. Anything that makes them feel like they're being recruited or that they'd have to 'sell' anyone.",
      text: "Hey {firstName}, thinking about you. I'm working with people on something that's helping them feel a lot better, and you were one of the first people I wanted to walk through it with. Could we grab 15 minutes this week?",
      email: {
        subject: "Thinking of you",
        body: "Hey {firstName},\n\nForget the business side. The honest reason I'm writing is I work with this thing that's helping real people feel better. Clearer energy, deeper sleep, the unsexy stuff most people don't talk about until it changes.\n\nI thought of you because you take such good care of the people around you, and I think you'd be incredible at walking alongside someone through this.\n\nNo pressure at all. Could we grab a quick coffee or a call so I can show you what we're doing?\n\n{partnerFirstName}",
      },
      call: "Forget the business side for a second. The reason I'm calling is I'm helping people feel better with something pretty simple. At-home test, then a daily routine, then a retest 120 days later. Most people are shocked by their first numbers. I thought of you because you'd be amazing at helping someone walk through this. No pressure. Can we just look at it together?",
    },
  },
  blue: {
    label: "Blue (Socializer)",
    hex: "#5ba8d6",
    magicWord: "fun",
    oneMove: "Skip the detail, get them to the room, close fast.",
    wordsTheyLove: ["fun", "exciting", "people", "adventure", "let's go", "energy"],
    voiceRule:
      "Short and energetic. Skip the detail. Point at the next experience, event, or call. No long paragraphs, no PDFs, no comp-plan walkthrough. Fun first, action second.",
    scripts: {
      leadWith: "Energy. The room. The people. The next event or call. Make it sound like a thing they'd be missing out on. They get sold by environment, not data.",
      avoid: "Long messages. PDFs. Comp-plan walkthroughs. Spreadsheets. Anything that takes more than 30 seconds to read.",
      text: "Hey {firstName}, okay you HAVE to come to this. We've got a little opportunity meeting Thursday, room full of fun people, you'll know half of them in 10 minutes. Can you make it?",
      email: {
        subject: "You in?",
        body: "{firstName},\n\nQuick one. Thursday, opportunity meeting, fun people, real energy, the whole thing. Your superpower is making the room work and I want you there.\n\nYou in?\n\n{partnerFirstName}",
      },
      call: "I'm not even going to explain the boring parts. You'd love the people. We've got a thing Thursday night, room full of energy, real conversations, real fun. Just show up and look around. Can I count on you?",
    },
  },
};

export function colorVoiceLine(colorCode: ColorCode | null | undefined): string | null {
  if (!colorCode) return null;
  const meta = COLOR_META[colorCode];
  if (!meta) return null;
  return `Color translation for this prospect (${meta.label}): ${meta.voiceRule}`;
}

/** Substitute {firstName} and {partnerFirstName} in a script string. */
export function renderScript(
  template: string,
  vars: { firstName: string; partnerFirstName: string },
): string {
  return template
    .replace(/\{firstName\}/g, vars.firstName)
    .replace(/\{partnerFirstName\}/g, vars.partnerFirstName);
}

