import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;

export const anthropic: Anthropic | null = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
export const resend: Resend | null = RESEND_KEY ? new Resend(RESEND_KEY) : null;

export const BOT_MODEL = "claude-sonnet-4-6";
export const BOT_FROM_DOMAIN = process.env.BOT_FROM_DOMAIN ?? "buildfromanywhere.com";
// The Reply-To header on every outbound bot email. Prospects who hit reply
// land here, and Resend's inbound webhook routes from this address to the
// bot. The default is info@<domain> — never bot@ — because prospects see
// the Reply-To in their inbox and it has to read as a human-friendly box.
// Override per-environment with BOT_FROM_EMAIL if needed.
export const BOT_REPLY_TO = process.env.BOT_FROM_EMAIL ?? `info@${BOT_FROM_DOMAIN}`;
export const RESEND_SIGNING_KEY = process.env.RESEND_SIGNING_KEY ?? "";
export const RESEND_RECEIVING_API_KEY = process.env.RESEND_RECEIVING_API_KEY ?? "";

export function botCanSend(): boolean {
  return Boolean(anthropic && resend);
}

if (!anthropic) console.log("[bot] ANTHROPIC_API_KEY missing — outbound bot is disabled until set.");
if (!resend) console.log("[bot] RESEND_API_KEY missing — email sending is disabled until set.");
