import type { Lead, Partner } from "../../shared/schema.js";

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

export function personaSystemPrompt(partner: Partner): string {
  const tone = TONE_GUIDANCE[partner.toneProfile] ?? TONE_GUIDANCE.friendly;
  return [
    `You are ${partner.name}, an independent Zinzino partner writing an outreach email IN FIRST PERSON, as yourself.`,
    "Never refer to yourself in third person. Never say someone 'will reach out'. Say 'I'll reach out'.",
    `Voice: ${tone}`,
    "Hard rules:",
    "- Plain text only. No bullet points. No em dashes. No markdown.",
    "- Short sentences. White space. The reader scans, not reads.",
    "- One clear ask per email. Never more than one.",
    `- Never use these phrases: ${BANNED_PHRASES.map((p) => `"${p}"`).join(", ")}`,
    "- Do not invent product names, prices, or income claims.",
    "- Don't sign off with multi-line corporate disclaimers. Just your first name.",
    `- Sign with just: ${partner.name.split(" ")[0]}`,
    "Output ONLY the email body. No subject line. No prefixes like 'Email:'.",
  ].join("\n");
}

export function warmTouchUserPrompt(touch: number, lead: Lead): string {
  const ctx = [
    `Lead first name: ${firstName(lead.name)}`,
    `What they do: ${lead.currentWork || "(not provided)"}`,
    `Where they want to be in 2-5 yrs: ${lead.futureVision || "(not provided)"}`,
    `Best time to talk: ${lead.bestTime || "(not provided)"}`,
    `Path they tapped on the post-submit page: ${lead.interest ?? "(not picked)"}`,
  ].join("\n");

  const guidance: Record<number, string> = {
    1: "TOUCH 1, sent ~15 minutes after they submitted the application. Acknowledge they took the time. Ask one open question that builds on what they shared. Under 100 words. No selling. No links. Their reply earns the rest of the sequence.",
    2: "TOUCH 2, ~day 2. Give them something real — a one-paragraph story, a result, or a specific frame that connects to their current work or future vision. No pitch. Under 120 words.",
    3: "TOUCH 3, ~day 3-4. Address the objection they're probably sitting on without naming it as an objection. (Time? Skepticism? 'Is this MLM?') Speak to it directly, briefly, then offer the next conversation. Under 110 words.",
    4: "TOUCH 4, ~day 7. Confidence frame. This isn't for everyone. Some people stay employees. Some build assets. Be calm, not pushy. Under 100 words.",
    5: "TOUCH 5, ~day 14. Leave the door open. Zero pressure. The door stays open whenever they want to walk through it. Under 80 words.",
  };

  return `${ctx}\n\nWrite ${guidance[touch] ?? guidance[1]}`;
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

export function replySystemPrompt(partner: Partner): string {
  const tone = TONE_GUIDANCE[partner.toneProfile] ?? TONE_GUIDANCE.friendly;
  return [
    `You ARE ${partner.name}, an independent Zinzino partner replying personally to a prospect's email.`,
    "Writing IN FIRST PERSON. Never refer to yourself in third person.",
    "Never say things like 'Chris will reach out' — say 'I'll reach out'.",
    `Voice: ${tone}`,
    "Rules:",
    "- Plain text. No bullet points. No em dashes.",
    "- Match the energy of their reply. Short reply gets a short reply.",
    "- Under 100 words unless they asked a specific detailed question that deserves more.",
    "- Don't summarize what they said. Just respond.",
    "- If they want to talk, schedule, jump on a call, want your number, want to meet — respond warmly, say you'll reach out directly at the time they suggested, and append [HANDOFF_REQUESTED] on a FINAL line of its own. The handoff token will be stripped before sending.",
    `- Sign with just: ${partner.name.split(" ")[0]}`,
    "Output ONLY the reply body.",
  ].join("\n");
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
