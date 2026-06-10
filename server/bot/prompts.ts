import type { Lead, Partner } from "../../shared/schema.js";
import { colorVoiceLine, type ColorCode } from "../../shared/colorCode.js";

const TONE_GUIDANCE: Record<string, string> = {
  friendly: "Warm and casual. You're texting a friend who matters to you.",
  direct: "No fluff. Get to the point. Respect their time over your throat-clearing.",
  professional: "Polished but human. Measured pace, clean grammar, no slang.",
  faith_based: "Warm with a quiet faith undercurrent. Family-forward, hope-forward. Never preachy.",
};

const BANNED_PHRASES = [
  "journey",
  "amazing",
  "game-changer",
  "I wanted to reach out",
  "I hope this email finds you well",
  "Just touching base",
  "Synergy",
];

export function personaSystemPrompt(partner: Partner, colorCode?: ColorCode | null): string {
  const tone = TONE_GUIDANCE[partner.toneProfile] ?? TONE_GUIDANCE.friendly;
  const colorLine = colorVoiceLine(colorCode);
  return [
    `You are ${partner.name}, an independent Zinzino partner writing an outreach email IN FIRST PERSON, as yourself.`,
    "Never refer to yourself in third person. Never say someone 'will reach out'. Say 'I'll reach out'.",
    `Voice: ${tone}`,
    colorLine ?? null,
    "Hard rules:",
    "- Plain text only. No bullet points. No em dashes. No markdown.",
    "- Short sentences. White space. The reader scans, not reads.",
    "- One clear ask per email. Never more than one.",
    `- Never use these phrases: ${BANNED_PHRASES.map((p) => `"${p}"`).join(", ")}`,
    "- Do not invent product names, prices, or income claims.",
    "- If you include a URL, use ONLY a URL that was explicitly provided in the user prompt. NEVER write placeholders like [LINK], [URL], {link}, {{url}}, or '(insert link here)'. If no URL is provided, do not invent one and do not write a placeholder.",
    "- Don't sign off with multi-line corporate disclaimers. Just your first name.",
    `- Sign with just: ${partner.name.split(" ")[0]}`,
    "Output ONLY the email body. No subject line. No prefixes like 'Email:'.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function warmTouchUserPrompt(touch: number, lead: Lead, stalledFirst: boolean): string {
  const ctx = [
    `Lead first name: ${firstName(lead.name)}`,
    `What they do: ${lead.currentWork || "(not provided)"}`,
    `Where they want to be in 2-5 yrs: ${lead.futureVision || "(not provided)"}`,
    `Best time to talk: ${lead.bestTime || "(not provided)"}`,
    `Path they tapped on the post-submit page: ${lead.interest ?? "(not picked)"}`,
  ].join("\n");

  // Plain, no markdown. Periods and commas only — no em dashes.
  const guidance: Record<number, string> = {
    1: stalledFirst
      ? "TOUCH 1 (acknowledged return). They got a soft nudge from us earlier when they hadn't booked yet, and now they have booked. Don't reintroduce. Don't reset the conversation. Open warm, thank them for coming back, then ask one open question that builds on what they shared in the application. Under 90 words. No selling. No links."
      : "TOUCH 1, sent about 15 minutes after they submitted the application. Acknowledge they took the time. Ask one open question that builds on what they shared. Under 100 words. No selling. No links. Their reply earns the rest of the sequence.",
    2: "TOUCH 2, around day 2. Give them something real. A one-paragraph story, a result, or a specific frame that connects to their current work or future vision. No pitch. Under 120 words.",
    3: "TOUCH 3, around day 3-4. Address the objection they are probably sitting on without naming it as an objection. (Time? Skepticism? 'Is this MLM?') Speak to it directly, briefly, then offer the next conversation. Under 110 words.",
    4: "TOUCH 4, around day 7. Confidence frame. This isn't for everyone. Some people stay employees. Some build assets. Be calm, not pushy. Under 100 words.",
    5: "TOUCH 5, around day 14. Leave the door open. Zero pressure. The door stays open whenever they want to walk through it. Under 80 words.",
  };

  return `${ctx}\n\nWrite ${guidance[touch] ?? guidance[1]}`;
}

/**
 * Stall touch: prospect entered email and watched the first video, but never
 * submitted the booking form. Soft single-ask. Touch 1 fires around T+1h,
 * touch 2 around T+48h. Both touches no-op at fire time if the lead has since
 * booked (handled in the scheduler).
 *
 * submissionCount is the number of times this prospect has entered their email
 * on the squeeze page (we dedupe by partner+email at POST /api/leads). When
 * it's greater than 1 the copy acknowledges the return pattern instead of
 * pretending this is a fresh first-touch nudge.
 */
export function stallTouchUserPrompt(
  touch: number,
  lead: Lead,
  submissionCount: number,
  funnelUrl: string,
): string {
  const ctx = [
    `Lead first name: ${firstName(lead.name)}`,
    `Funnel URL where they can come back and book (use EXACTLY as-is, no markdown, no shortening): ${funnelUrl}`,
    submissionCount > 1
      ? `Return pattern: this prospect has now entered their email on the squeeze page ${submissionCount} times without ever booking the call. That is a real signal. They keep coming back without finishing.`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  if (submissionCount > 1) {
    const guidance: Record<number, string> = {
      1: "STALL TOUCH 1 (return pattern). They keep landing and re-entering their email without booking. Open by acknowledging that out loud, lightly and without making them feel called out: something like 'I noticed you've landed on my page a few times now.' Then ask one open, low-pressure question about what is holding them up. Don't pitch. Don't push for a booking. Make space for them to tell you what is in the way. Include the funnel URL above on its own line near the bottom so they have an easy way back if they want one. Under 90 words.",
      2: "STALL TOUCH 2 (return pattern, last touch). Still haven't booked after multiple returns. Briefly acknowledge the pattern, leave the door wide open, zero pressure, and tell them you'll stop reaching out unless they want me to. Include the funnel URL above on its own line near the bottom so the door stays visibly open. Under 80 words.",
    };
    return `${ctx}\n\nWrite ${guidance[touch] ?? guidance[1]}`;
  }

  const guidance: Record<number, string> = {
    1: "STALL TOUCH 1, sent about an hour after they entered their email and watched the first video. They haven't booked yet. Acknowledge they showed up and watched. One single soft invitation to come back and pick a time. Include the funnel URL above on its own line near the bottom so they can come back with one tap. Don't push. Don't pitch. Don't reintroduce yourself. Under 80 words.",
    2: "STALL TOUCH 2, sent about 48 hours after the first nudge. Still no booking. Last soft touch on this track. Acknowledge they're busy. Include the funnel URL above on its own line near the bottom. Leave the door open. Zero pressure. Under 65 words.",
  };
  return `${ctx}\n\nWrite ${guidance[touch] ?? guidance[1]}`;
}

/**
 * Default subject + body for the manual 'Send presentation' closing tool
 * (§9B). Color-aware so the email lands in the prospect's translation. First-
 * person partner voice, plain text, no banned phrases, no earnings claims.
 * The partner sees this in an editable modal before send and can tweak.
 */
export function presentationDefault(
  lead: Pick<Lead, "name" | "colorCode">,
  partner: Pick<Partner, "name" | "enrollmentLink">,
  presentationLink: string,
): { subject: string; body: string } {
  const first = firstName(lead.name);
  const partnerFirst = firstName(partner.name);
  const color = (lead.colorCode as ColorCode | null) ?? null;

  const intros: Record<ColorCode | "default", string> = {
    green:
      "Thanks for the time today. Here's the full walkthrough when you have 20 minutes. It covers the actual data, the BalanceTest protocol, and the 120-day cadence so you can see the structure for yourself.",
    red:
      "Twenty minutes. Full structure of the first 90 days, the rank ladder, the targets. Watch it when you have the time, then tell me if you want in.",
    yellow:
      "Thanks for the conversation. Here's the full walkthrough whenever you have 20 minutes. It shows who this is really helping and how we walk alongside them.",
    blue:
      "Quick one. Full breakdown when you have 20 minutes. After that, let's hop on a call.",
    default:
      "Thanks for the time today. Here's the full breakdown when you have 20 minutes.",
  };
  const intro = intros[color ?? "default"];

  const enrollLine = partner.enrollmentLink?.trim()
    ? `When you're ready to start, the link is here: ${partner.enrollmentLink.trim()}`
    : "";

  const body = [
    `Hey ${first},`,
    "",
    intro,
    "",
    presentationLink,
    "",
    "Once you've finished, let me know which package you'd like to join on and I'll get you set up.",
    enrollLine,
    "",
    partnerFirst,
  ]
    .filter((line) => line !== "" || true) // keep blanks for paragraph spacing
    .join("\n")
    .trim();

  return {
    subject: `The full walkthrough, ${first}`,
    body,
  };
}

/**
 * Cold touch: partner explicitly opted a manually-added contact into outreach
 * via the CRM. These prospects never went through the funnel, never opted
 * in to the platform, and may not have heard from this partner in a long
 * time. Pace and tone are deliberately gentler than warm — relationship
 * first, business later, never lead with a pitch.
 *
 * Cadence: T+15min (touch 1), day 4 (touch 2), day 10 (touch 3), day 21
 * (touch 4). Each touch has its own purpose:
 *   1: soft hello, zero ask
 *   2: light story or update, still no ask
 *   3: first soft invitation
 *   4: last note, door wide open
 */
export function coldTouchUserPrompt(touch: number, lead: Lead, funnelUrl: string): string {
  const ctx = [
    `Lead first name: ${firstName(lead.name)}`,
    `What I know about them: ${lead.currentWork || "(not much)"}`,
    `Notes from past conversations: ${lead.notes?.trim() || "(none)"}`,
    `Funnel URL where they can watch the 5-minute video and book (use EXACTLY as-is, only on touch 3 where invited, no markdown, no shortening): ${funnelUrl}`,
  ].join("\n");

  const guidance: Record<number, string> = {
    1: "COLD TOUCH 1, the first re-connect. This is someone from my existing world, not a fresh lead. Open warm. Acknowledge it's been a while if it makes sense. Ask one open question about how they're doing. Zero agenda. No mention of the business yet. Do NOT include any URL on this touch. Under 80 words. Plain text, first person.",
    2: "COLD TOUCH 2, sent about 4 days after the first. Still no pitch. Share one light, real thing about what I'm up to. Could be a small story, a current pursuit, or an observation. Then turn it back to them with a small question. Do NOT include any URL on this touch. Under 110 words.",
    3: "COLD TOUCH 3, sent about 10 days after the first. This is the first soft invitation. Tell them, in plain terms, that I'm building something on the side I'd like them to take a look at, and ask if they'd be open to a 5-minute video. Include the funnel URL above on its own line near the bottom so they can watch immediately if they want. Not a pitch, an invitation. Make it small and easy to say yes or no to. Under 100 words.",
    4: "COLD TOUCH 4, sent about 21 days after the first. Last note from me on this. Acknowledge if they haven't responded, leave the door wide open with zero pressure, and tell them I hope they're well either way. Do NOT include any URL on this touch. Under 70 words.",
  };

  return `${ctx}\n\nWrite ${guidance[touch] ?? guidance[1]}`;
}

export function coldSubjectFor(touch: number, lead: Lead): string {
  const name = firstName(lead.name);
  const map: Record<number, string> = {
    1: `Thinking about you, ${name}`,
    2: `Quick note, ${name}`,
    3: `One thing I'd love to share, ${name}`,
    4: `Last note for a while, ${name}`,
  };
  return map[touch] ?? `Hey ${name}`;
}

export function stallSubjectFor(touch: number, lead: Lead): string {
  const name = firstName(lead.name);
  const map: Record<number, string> = {
    1: `Still here whenever, ${name}`,
    2: `One last note, ${name}`,
  };
  return map[touch] ?? `Hey ${name}`;
}

export function subjectFor(touch: number, lead: Lead): string {
  const name = firstName(lead.name);
  const map: Record<number, string> = {
    1: `Quick one, ${name}`,
    2: `Saw your note, ${name}`,
    3: `Honest question, ${name}`,
    4: `Last note for a bit, ${name}`,
    5: `Door's open, ${name}`,
  };
  return map[touch] ?? `Hey ${name}`;
}

export function replySystemPrompt(partner: Partner, colorCode?: ColorCode | null): string {
  const tone = TONE_GUIDANCE[partner.toneProfile] ?? TONE_GUIDANCE.friendly;
  const colorLine = colorVoiceLine(colorCode);
  return [
    `You ARE ${partner.name}, an independent Zinzino partner replying personally to a prospect's email.`,
    "Writing IN FIRST PERSON. Never refer to yourself in third person.",
    "Never say things like 'Chris will reach out', say 'I'll reach out'.",
    `Voice: ${tone}`,
    colorLine ?? null,
    "Rules:",
    "- Plain text. No bullet points. No em dashes.",
    "- Match the energy of their reply. Short reply gets a short reply.",
    "- Under 100 words unless they asked a specific detailed question that deserves more.",
    "- Don't summarize what they said. Just respond.",
    "- If you include a URL, use ONLY a URL that was explicitly provided in the user prompt. NEVER write placeholders like [LINK], [URL], {link}, {{url}}, or '(insert link here)'. If no URL is provided, don't write one.",
    "- If they want to talk, schedule, jump on a call, want your number, want to meet, respond warmly, say you'll reach out directly at the time they suggested, and append [HANDOFF_REQUESTED] on a FINAL line of its own. The handoff token will be stripped before sending.",
    `- Sign with just: ${partner.name.split(" ")[0]}`,
    "Output ONLY the reply body.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function replyUserPrompt(thread: ConversationTurn[], lead: Lead): string {
  const ctx = `Lead context: name=${firstName(lead.name)}, occupation=${lead.currentWork ?? "?"}, vision=${lead.futureVision ?? "?"}, best time=${lead.bestTime ?? "?"}.`;
  const transcript = thread
    .map((t) => `${t.from === "partner" ? "Me" : firstName(lead.name)}: ${t.body.trim()}`)
    .join("\n\n---\n\n");
  return `${ctx}\n\nConversation so far:\n\n${transcript}\n\nWrite my reply now.`;
}

export interface ConversationTurn {
  from: "partner" | "lead";
  subject?: string | null;
  body: string;
  at: Date;
}

export function firstName(fullName: string): string {
  return (fullName.split(/\s+/)[0] ?? fullName).trim();
}

export function stripHandoffToken(body: string): { body: string; handoff: boolean } {
  const handoff = /\[HANDOFF_REQUESTED\]/i.test(body);
  return {
    body: body.replace(/\[HANDOFF_REQUESTED\]/gi, "").trim(),
    handoff,
  };
}
