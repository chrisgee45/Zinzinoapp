import { resend, BOT_FROM_DOMAIN, BOT_REPLY_TO } from "./clients.js";
import type { Partner } from "../../shared/schema.js";

export interface SendArgs {
  partner: Pick<Partner, "name" | "slug">;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

// Resend's default plan caps at 5 outbound emails per second. When a
// partner imports a batch of internet leads we kick a cold-touch-1
// email for each one, and even with import-side throttling the warm
// stall touches + manual sends running concurrently can push us over.
// On a 429 we sleep through the rate window and retry once or twice
// instead of writing the row off as a failed delivery.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimit(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("rate limit") || m.includes("too many requests") || m.includes("429");
}

export async function sendBotEmail({ partner, to, subject, body, inReplyTo }: SendArgs): Promise<SendResult> {
  if (!resend) return { ok: false, error: "Resend not configured" };

  const fromAddress = `${partner.slug}@${BOT_FROM_DOMAIN}`;
  const fromHeader = `${partner.name} <${fromAddress}>`;

  // Up to 3 attempts. Backoff grows: 350ms, 1.2s. After the second
  // retry we surface the error so the bot_emails row records the
  // failure honestly instead of looking like a successful send.
  const delays = [0, 350, 1200];
  let lastError = "";
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    try {
      const result = await resend.emails.send({
        from: fromHeader,
        to,
        subject,
        text: body,
        replyTo: BOT_REPLY_TO,
        headers: inReplyTo ? { "In-Reply-To": inReplyTo } : undefined,
      });
      if (result.error) {
        lastError = result.error.message;
        if (isRateLimit(lastError)) continue;
        return { ok: false, error: lastError };
      }
      return { ok: true, id: result.data?.id };
    } catch (e) {
      lastError = (e as Error).message;
      if (isRateLimit(lastError)) continue;
      return { ok: false, error: lastError };
    }
  }
  return { ok: false, error: lastError || "Resend rate-limit retries exhausted" };
}

export async function sendPartnerNotification({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  if (!resend) return { ok: false, error: "Resend not configured" };
  try {
    const result = await resend.emails.send({
      from: `Build From Anywhere <notify@${BOT_FROM_DOMAIN}>`,
      to,
      subject,
      text: body,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
