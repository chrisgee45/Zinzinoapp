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

export async function sendBotEmail({ partner, to, subject, body, inReplyTo }: SendArgs): Promise<SendResult> {
  if (!resend) return { ok: false, error: "Resend not configured" };

  const fromAddress = `${partner.slug}@${BOT_FROM_DOMAIN}`;
  const fromHeader = `${partner.name} <${fromAddress}>`;

  try {
    const result = await resend.emails.send({
      from: fromHeader,
      to,
      subject,
      text: body,
      replyTo: BOT_REPLY_TO,
      headers: inReplyTo ? { "In-Reply-To": inReplyTo } : undefined,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
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
