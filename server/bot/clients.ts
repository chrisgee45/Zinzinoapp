import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;

export const anthropic: Anthropic | null = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
export const resend: Resend | null = RESEND_KEY ? new Resend(RESEND_KEY) : null;

export const BOT_MODEL = "claude-sonnet-4-6";
export const BOT_FROM_DOMAIN = process.env.BOT_FROM_DOMAIN ?? "buildfromanywhere.com";
export const BOT_REPLY_TO = process.env.BOT_FROM_EMAIL ?? `bot@${BOT_FROM_DOMAIN}`;
export const RESEND_SIGNING_KEY = process.env.RESEND_SIGNING_KEY ?? "";
export const RESEND_RECEIVING_API_KEY = process.env.RESEND_RECEIVING_API_KEY ?? "";

export function botCanSend(): boolean {
  return Boolean(anthropic && resend);
}

if (!anthropic) console.log("[bot] ANTHROPIC_API_KEY missing — outbound bot is disabled until set.");
if (!resend) console.log("[bot] RESEND_API_KEY missing — email sending is disabled until set.");
