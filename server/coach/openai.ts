import OpenAI from "openai";
import type { Lead, Partner } from "../../shared/schema.js";
import type { ActionRecommendation } from "./actions.js";

const KEY = process.env.OPENAI_API_KEY;
export const openai: OpenAI | null = KEY ? new OpenAI({ apiKey: KEY }) : null;
export const COACH_MODEL = "gpt-4.1-mini";

if (!openai) console.log("[coach] OPENAI_API_KEY missing — AI message drafts disabled.");

const TONE: Record<string, string> = {
  friendly: "Warm, casual, conversational. Like texting a friend.",
  direct: "No fluff. One clear thought. Respect their time.",
  professional: "Polished but human. Measured, clean grammar.",
  faith_based: "Warm with a quiet faith undercurrent. Family-forward. Never preachy.",
};

export interface MessageDraft {
  sms: string;
  dm: string;
}

export async function generateDrafts({
  partner,
  action,
  lead,
}: {
  partner: Partner;
  action: ActionRecommendation;
  lead?: Lead;
}): Promise<MessageDraft | null> {
  if (!openai) return null;

  const tone = TONE[partner.toneProfile] ?? TONE.friendly;
  const leadCtx = lead
    ? `Lead: ${lead.name}. Occupation: ${lead.currentWork ?? "?"}. Vision: ${lead.futureVision ?? "?"}. Best time to talk: ${lead.bestTime ?? "?"}.`
    : "No specific lead — outreach to a contact in their phone.";

  const system = [
    `You are coaching ${partner.name}, an independent network-marketing partner.`,
    "Write IN FIRST PERSON, as the partner. Never refer to them in third person.",
    `Voice: ${tone}`,
    "Rules:",
    "- SMS: under 160 characters. No emojis unless friendly tone.",
    "- DM: 2-3 sentences max, plain text, no bullet points, no em dashes.",
    "- Never say 'journey', 'amazing', 'game-changer', 'I wanted to reach out'.",
    "- Don't pitch. Don't ask for a sale. Open a conversation.",
    'Return ONLY valid JSON: {"sms": "...", "dm": "..."}',
  ].join("\n");

  const user = [
    `Today's recommended action: ${action.title}`,
    `Why: ${action.rationale}`,
    `Channel: ${action.channel}`,
    leadCtx,
    "Write the SMS and DM versions for this exact moment.",
  ].join("\n\n");

  try {
    const completion = await openai.chat.completions.create({
      model: COACH_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.7,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MessageDraft>;
    if (typeof parsed.sms !== "string" || typeof parsed.dm !== "string") return null;
    return { sms: parsed.sms.trim().slice(0, 320), dm: parsed.dm.trim().slice(0, 600) };
  } catch (err) {
    console.error("[coach] openai draft failed:", err);
    return null;
  }
}
