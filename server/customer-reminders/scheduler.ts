// Daily customer reminder tick.
//
// Three reminders, each owned by one column on `customers`:
//
//   * test_date          → +15 days  → "your results are ready, check at
//                                       zinzinotest.com"
//   * billing_date       → −3 days   → "heads-up, your renewal posts on Xth"
//   * retest_date        → −7 days   → "your retest is coming up next week"
//
// Each fire is gated on the corresponding *_reminder_sent_at column being
// null — once we send, we stamp it, so the next tick doesn't fire again
// for the same date. Clearing or changing the date from the UI resets the
// sent-at (see PATCH /api/customers/:id), which gives the partner a clean
// re-arm.
//
// Two recipients per reminder:
//   1. The customer (via the partner's slug@ bot sender)
//   2. The partner (via notify@ so they know it went out and can follow
//      up if needed)
//
// Templated plain text rather than AI-generated — these are utility
// touches where consistency matters more than warmth, and the customer-
// care AI already owns the long-form welcome + monthly drip flow.

import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { customers, customerEmails, partners } from "../../shared/schema.js";
import { sendBotEmail, sendPartnerNotification } from "../bot/email.js";

// Run hourly. The reminders themselves only fire on calendar
// transitions, so a tick that misses an hour is fine — the next tick
// will pick up anything still un-stamped.
const TICK_MS = 60 * 60 * 1000;

type ReminderKind = "test" | "billing" | "retest";

interface DueRow {
  id: number;
  partner_id: number;
  name: string;
  email: string;
  partner_name: string;
  partner_slug: string;
  partner_email: string;
  test_date: string | null;
  billing_date: string | null;
  retest_date: string | null;
  test_reminder_sent_at: Date | null;
  billing_reminder_sent_at: Date | null;
  retest_reminder_sent_at: Date | null;
}

// Pull every customer with at least one pending reminder, joined to
// their partner for the from-address and sign-off. Filters out paused
// AI / opt-out emails so we don't bypass the partner's intent.
async function dueCustomers(): Promise<DueRow[]> {
  try {
    const res = await db.execute<DueRow>(sql`
      SELECT
        c.id, c.partner_id, c.name, c.email,
        p.name AS partner_name, p.slug AS partner_slug, p.email AS partner_email,
        c.test_date::text     AS test_date,
        c.billing_date::text  AS billing_date,
        c.retest_date::text   AS retest_date,
        c.test_reminder_sent_at,
        c.billing_reminder_sent_at,
        c.retest_reminder_sent_at
      FROM customers c
      JOIN partners p ON p.id = c.partner_id
      WHERE c.email_consent = true
        AND c.ai_paused = false
        AND (
          (c.test_date IS NOT NULL
            AND c.test_reminder_sent_at IS NULL
            AND c.test_date <= (CURRENT_DATE - INTERVAL '15 days'))
          OR
          (c.billing_date IS NOT NULL
            AND c.billing_reminder_sent_at IS NULL
            AND c.billing_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days'))
          OR
          (c.retest_date IS NOT NULL
            AND c.retest_reminder_sent_at IS NULL
            AND c.retest_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days'))
        )
      LIMIT 200
    `);
    return (res as { rows?: DueRow[] }).rows ?? (res as unknown as DueRow[]);
  } catch (err) {
    // Schema-drift safety: if the new columns don't exist yet, skip
    // the tick instead of crashing. bootstrap-schema runs on each
    // boot and will add the columns; the next tick will pick up.
    console.warn("[customer-reminders] query failed (likely schema drift):", (err as Error).message);
    return [];
  }
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] ?? full;
}

function fmtDate(iso: string): string {
  // Treat the YYYY-MM-DD as a calendar date (not a UTC instant) so we
  // don't accidentally subtract a day for partners west of UTC.
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
}

// ── Templates ────────────────────────────────────────────────────────

// Same URL as referenced in server/products/customerCare.ts. Kept in
// sync here rather than imported across module boundaries so each
// scheduler entry-point is self-contained.
const LIFESTYLE_GUIDE_URL =
  "https://zinzinowebstorage.blob.core.windows.net/guides/lifestyle-en-US.pdf";

function testResultEmail(customer: DueRow): { subject: string; body: string } {
  const customerFirst = firstName(customer.name);
  const partnerFirst = firstName(customer.partner_name);
  const subject = `${customerFirst}, your Zinzino test results should be ready`;
  const body = [
    `Hey ${customerFirst},`,
    "",
    "Quick heads-up — it's been about 15 days since you sent in your test, which means your results should be live by now.",
    "",
    "You can pull them up here:",
    "https://www.zinzinotest.com",
    "",
    "Sign in with the same details you used when you registered the test, and your report will be waiting. If you'd like, reply to this email after you've had a look and I'll walk you through what stood out — totally happy to.",
    "",
    `Talk soon,`,
    partnerFirst,
    "",
    `P.S. — Your results tell you where you are; the Zinzino Lifestyle Guide gives you the playbook for what to do next. Worth a quick read: ${LIFESTYLE_GUIDE_URL}`,
  ].join("\n");
  return { subject, body };
}

function billingEmail(customer: DueRow): { subject: string; body: string } {
  const customerFirst = firstName(customer.name);
  const partnerFirst = firstName(customer.partner_name);
  const date = fmtDate(customer.billing_date!);
  const subject = `${customerFirst}, your Zinzino order is on its way (${date})`;
  const body = [
    `Hey ${customerFirst},`,
    "",
    `Just a friendly nudge — your next Zinzino order is set to ship on ${date}. Nothing you need to do; it auto-renews and arrives like clockwork.`,
    "",
    "Two quick things worth knowing:",
    "",
    "• If you want to switch a product, swap a flavor, or add anything to this shipment, just reply by the day before and I'll handle it for you.",
    "",
    "• Your Zinzino Cash (the shipping fee that returns to your account as store credit each month) keeps building. You can use it any time toward a new product or to try something you've been curious about — let me know if you'd like to see what's in your balance.",
    "",
    `Cheers,`,
    partnerFirst,
  ].join("\n");
  return { subject, body };
}

function retestEmail(customer: DueRow): { subject: string; body: string } {
  const customerFirst = firstName(customer.name);
  const partnerFirst = firstName(customer.partner_name);
  const date = fmtDate(customer.retest_date!);
  const subject = `${customerFirst}, time to book your follow-up test`;
  const body = [
    `Hey ${customerFirst},`,
    "",
    `It's almost time for your follow-up test — your retest is scheduled around ${date}.`,
    "",
    "This is the one that shows the real story. Most people see the biggest shift between their first test and their first retest, so it's worth taking the few minutes to do it.",
    "",
    "Reply here and I'll send over the simple steps to register and ship the test back in. Takes maybe ten minutes total.",
    "",
    `Talk soon,`,
    partnerFirst,
  ].join("\n");
  return { subject, body };
}

// ── Send helpers ─────────────────────────────────────────────────────

async function sendReminder(
  kind: ReminderKind,
  customer: DueRow,
  email: { subject: string; body: string },
): Promise<void> {
  const partner = {
    name: customer.partner_name,
    slug: customer.partner_slug,
  };

  // Customer-facing email goes out via the partner's branded sender.
  const send = await sendBotEmail({
    partner,
    to: customer.email,
    subject: email.subject,
    body: email.body,
  });
  if (!send.ok) {
    console.warn(`[customer-reminders] ${kind} send failed for customer ${customer.id}: ${send.error}`);
    return;
  }

  // Heads-up to the partner so they know the touch went out and can
  // jump in with a personal follow-up if they want.
  void sendPartnerNotification({
    to: customer.partner_email,
    subject: `[Reminder sent] ${customer.name} — ${kind} reminder`,
    body: [
      `Heads-up: the system just sent the ${kind} reminder to ${customer.name} (${customer.email}).`,
      "",
      `Subject: ${email.subject}`,
      "",
      `If you want to follow up personally, hop into their customer file and reply on the thread.`,
    ].join("\n"),
  }).catch((e) => console.warn(`[customer-reminders] partner notify failed:`, e));

  // Persist to the thread so the customer detail page shows the touch
  // alongside the welcome / drip history.
  try {
    await db.insert(customerEmails).values({
      customerId: customer.id,
      partnerId: customer.partner_id,
      direction: "outbound",
      kind: kind === "test" ? "reminder-test" : kind === "billing" ? "reminder-billing" : "reminder-retest",
      subject: email.subject,
      body: email.body,
      status: "sent",
    });
  } catch (e) {
    console.warn(`[customer-reminders] thread persist failed for customer ${customer.id}:`, (e as Error).message);
  }

  // Stamp the sent-at so the next tick skips this customer for this
  // reminder until the date changes.
  const stampColumn =
    kind === "test" ? "test_reminder_sent_at"
    : kind === "billing" ? "billing_reminder_sent_at"
    : "retest_reminder_sent_at";
  await db.execute(sql.raw(`UPDATE "customers" SET "${stampColumn}" = NOW() WHERE "id" = ${customer.id}`));
}

// ── Tick ─────────────────────────────────────────────────────────────

export async function runCustomerReminderTick(): Promise<void> {
  const rows = await dueCustomers();
  if (rows.length === 0) return;
  console.log(`[customer-reminders] ${rows.length} due — processing`);

  for (const c of rows) {
    // Order matters only when multiple reminders are due on the same
    // tick (rare but possible if the partner just added all three
    // dates). Each ships its own email.
    if (c.test_date && !c.test_reminder_sent_at) {
      // Re-check the 15-day condition in JS — Postgres already filtered
      // but a row could become eligible between query + send in a
      // long-running tick, and we want to be exact.
      const taken = new Date(c.test_date + "T12:00:00");
      const daysSince = Math.floor((Date.now() - taken.getTime()) / 86_400_000);
      if (daysSince >= 15) await sendReminder("test", c, testResultEmail(c));
    }
    if (c.billing_date && !c.billing_reminder_sent_at) {
      await sendReminder("billing", c, billingEmail(c));
    }
    if (c.retest_date && !c.retest_reminder_sent_at) {
      await sendReminder("retest", c, retestEmail(c));
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export function startCustomerReminderScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void runCustomerReminderTick().catch((e) =>
      console.warn("[customer-reminders] tick failed:", e),
    );
  }, TICK_MS);
  // Avoid the interval keeping the process alive past graceful shutdown.
  if (typeof timer.unref === "function") timer.unref();
}

export async function runCustomerReminderCatchup(): Promise<void> {
  await runCustomerReminderTick();
}
