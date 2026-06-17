// Customer-Care AI Robot — Feature A of the Z Force product AI spec.
//
// Three jobs:
//   1. sendWelcomeEmail — fires once when a customer is added.
//   2. sendMonthlyDrip — every ~30 days picks ONE product the customer
//      hasn't been introduced to and writes a friendly check-in.
//   3. sendInboundAutoReply — replies to a customer email, grounded in KB
//      + catalog facts.
//
// Hard gating happens at the caller (routes / scheduler). This module just
// owns prompt assembly + the Anthropic call + writing the customer_emails
// row.

import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { anthropic, BOT_MODEL, botCanSend } from "../bot/clients.js";
import { sendBotEmail } from "../bot/email.js";
import { customers, customerEmails, partners, type Customer, type Partner } from "../../shared/schema.js";
import { GUARDRAILS_BLOCK, CURATED_KB } from "./guardrails.js";
import { searchProducts, findProduct, catalogBlock, allProducts, type Product } from "./catalog.js";
import type Anthropic from "@anthropic-ai/sdk";

// Tone-profile copy reused from the prospect bot — same partner voice
// across both surfaces.
const VOICE_LINES: Record<string, string> = {
  friendly: "Voice: warm and casual, like a friend you've known for years.",
  direct: "Voice: no fluff, get to the point, respect their time.",
  professional: "Voice: polished and measured, clean grammar, calm pacing.",
  faith_based: "Voice: warm with a quiet faith undercurrent. Family-forward, hope-forward, never preachy.",
};

const SIGNOFF_DISCLAIMER =
  "* These statements have not been evaluated by the FDA. Products are not intended to diagnose, treat, cure, or prevent any disease.";

function systemPromptBase(partner: Partner): string {
  const voice = VOICE_LINES[partner.toneProfile] ?? VOICE_LINES.friendly;
  return [
    `You are an email-writing assistant acting as ${partner.name}, an independent Zinzino partner, writing to one of YOUR EXISTING, valued customers.`,
    "You are warm, genuinely appreciative, and helpful. You are caring for a customer, not selling to a prospect. Never use pressure or hype.",
    voice,
    "",
    GUARDRAILS_BLOCK,
    "",
    "KNOWLEDGE BASE (your only source of Zinzino facts):",
    CURATED_KB,
    "",
    `Format: start with a subject line as "Subject: ..." on the first line, then a blank line, then the body. Sign as ${partner.name.split(/\s+/)[0]}. Keep it concise (about 90 to 150 words). End the body with a brief, compliant disclaimer line.`,
  ].join("\n");
}

interface DraftResult {
  subject: string;
  body: string;
}

// The model returns "Subject: …\n\n<body>". Split into the two parts; if the
// model strays from the format we synthesize a safe fallback subject so we
// still deliver something rather than silently dropping the touch.
function parseSubjectAndBody(text: string, fallbackSubject: string): DraftResult {
  const trimmed = text.trim();
  const match = trimmed.match(/^Subject:\s*(.+?)\n\n([\s\S]*)$/i);
  if (match) {
    return { subject: match[1].trim().slice(0, 120), body: match[2].trim() };
  }
  // Try a looser parse — single newline between Subject: and body
  const loose = trimmed.match(/^Subject:\s*(.+?)\n([\s\S]*)$/i);
  if (loose) {
    return { subject: loose[1].trim().slice(0, 120), body: loose[2].trim() };
  }
  return { subject: fallbackSubject, body: trimmed };
}

async function generate(systemPrompt: string, userPrompt: string, maxTokens = 700): Promise<string | null> {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model: BOT_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    return res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
  } catch (e) {
    console.error("[customer-care] anthropic call failed:", e);
    return null;
  }
}

// ── Welcome ─────────────────────────────────────────────────────────────────
const WELCOME_TASK =
  "Write a short, warm WELCOME email thanking this person for being a valued customer. Let them know you are here for them personally if they ever have a question about their products, and that you will check in now and then with something useful. Do not pitch or upsell in this first email.";

export async function sendWelcomeEmail(customerId: number): Promise<{ ok: boolean; reason?: string }> {
  if (!botCanSend()) return { ok: false, reason: "ai-or-email-not-configured" };
  const [cust] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!cust) return { ok: false, reason: "customer-not-found" };
  if (cust.aiPaused) return { ok: false, reason: "ai-paused" };
  if (!cust.emailConsent) return { ok: false, reason: "no-consent" };
  if (cust.welcomeSentAt) return { ok: false, reason: "already-sent" };

  const [partner] = await db.select().from(partners).where(eq(partners.id, cust.partnerId)).limit(1);
  if (!partner) return { ok: false, reason: "partner-not-found" };

  const userPrompt = [
    `Customer first name: ${cust.name.split(/\s+/)[0]}`,
    "",
    WELCOME_TASK,
  ].join("\n");

  const raw = await generate(systemPromptBase(partner), userPrompt, 500);
  if (!raw) return { ok: false, reason: "generation-failed" };

  const fallback = `Welcome, ${cust.name.split(/\s+/)[0]}`;
  const { subject, body } = parseSubjectAndBody(raw, fallback);

  const send = await sendBotEmail({
    partner: { name: partner.name, slug: partner.slug },
    to: cust.email,
    subject,
    body: ensureDisclaimer(body),
  });

  await db.insert(customerEmails).values({
    customerId,
    partnerId: partner.id,
    direction: "outbound",
    kind: "welcome",
    subject,
    body: ensureDisclaimer(body),
    status: send.ok ? "sent" : `error:${send.error?.slice(0, 200) ?? "unknown"}`,
  });

  if (send.ok) {
    await db.update(customers).set({ welcomeSentAt: new Date() }).where(eq(customers.id, customerId));
  }
  return send.ok ? { ok: true } : { ok: false, reason: send.error };
}

// ── Monthly drip ────────────────────────────────────────────────────────────

// Pool of "featured" products the drip rotates through first — the
// flagship Zinzino line. We fall back to the full catalog once these are
// exhausted, skipping anything the customer's already heard about.
const DRIP_FEATURED = [
  "BalanceOil+ Kit",
  "ZinoBiotic+ Kit",
  "LeanShake Kit",
  "Xtend+ Kit",
  "ZinoShine+ Kit",
  "Skin Serum",
  "Cleanse+ Kit",
  "Burn+ Kit",
  "Protect+ Kit",
  "Collagen Boozt Kit",
];

function pickNextProductForDrip(introduced: string[]): Product | null {
  const introducedLower = new Set(introduced.map((s) => s.toLowerCase()));
  for (const name of DRIP_FEATURED) {
    if (introducedLower.has(name.toLowerCase())) continue;
    const p = findProduct(name);
    if (p) return p;
  }
  // Long-tail fallback: the first catalog product the customer hasn't seen.
  for (const p of allProducts()) {
    if (introducedLower.has(p.name.toLowerCase())) continue;
    if (!p.priceLine || !p.overview) continue;
    return p;
  }
  return null;
}

export async function sendMonthlyDrip(customerId: number): Promise<{ ok: boolean; reason?: string }> {
  if (!botCanSend()) return { ok: false, reason: "ai-or-email-not-configured" };
  const [cust] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!cust) return { ok: false, reason: "customer-not-found" };
  if (cust.aiPaused) return { ok: false, reason: "ai-paused" };
  if (!cust.emailConsent) return { ok: false, reason: "no-consent" };

  const [partner] = await db.select().from(partners).where(eq(partners.id, cust.partnerId)).limit(1);
  if (!partner) return { ok: false, reason: "partner-not-found" };

  const introduced = cust.introducedProducts ?? [];
  const product = pickNextProductForDrip(introduced);
  if (!product) return { ok: false, reason: "no-products-left" };

  const userPrompt = [
    `Customer first name: ${cust.name.split(/\s+/)[0]}`,
    `Product to introduce this month: ${product.name}`,
    introduced.length
      ? `Products already introduced (do NOT repeat): ${introduced.join(", ")}`
      : "Products already introduced: (none)",
    "",
    `Write this month's friendly check-in to an existing customer. Do two things, warmly and briefly: (1) introduce ONE more product they may not have tried yet, specifically ${product.name}, using only general wellness language grounded in the knowledge base; (2) give a light, no-pressure reminder that their Zinzino Cash (the shipping fee returned to them as store credit) is building up and can be used toward something new. Invite them to reply with any questions. Do not state any specific dollar balance.`,
    "",
    catalogBlock([product]),
  ].join("\n");

  const raw = await generate(systemPromptBase(partner), userPrompt, 700);
  if (!raw) return { ok: false, reason: "generation-failed" };

  const fallback = `A quick check-in, ${cust.name.split(/\s+/)[0]}`;
  const { subject, body } = parseSubjectAndBody(raw, fallback);

  const send = await sendBotEmail({
    partner: { name: partner.name, slug: partner.slug },
    to: cust.email,
    subject,
    body: ensureDisclaimer(body),
  });

  await db.insert(customerEmails).values({
    customerId,
    partnerId: partner.id,
    direction: "outbound",
    kind: "drip",
    subject,
    body: ensureDisclaimer(body),
    status: send.ok ? "sent" : `error:${send.error?.slice(0, 200) ?? "unknown"}`,
  });

  if (send.ok) {
    const nextIntroduced = [...introduced, product.name];
    await db
      .update(customers)
      .set({ lastDripAt: new Date(), introducedProducts: nextIntroduced })
      .where(eq(customers.id, customerId));
  }
  return send.ok ? { ok: true } : { ok: false, reason: send.error };
}

// ── Inbound auto-reply ──────────────────────────────────────────────────────

export async function sendInboundAutoReply(
  customerId: number,
  incomingMessage: string,
): Promise<{ ok: boolean; reason?: string; subject?: string; body?: string }> {
  if (!botCanSend()) return { ok: false, reason: "ai-or-email-not-configured" };
  const [cust] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!cust) return { ok: false, reason: "customer-not-found" };
  if (cust.aiPaused) return { ok: false, reason: "ai-paused" };

  const [partner] = await db.select().from(partners).where(eq(partners.id, cust.partnerId)).limit(1);
  if (!partner) return { ok: false, reason: "partner-not-found" };

  // Pull recent thread context — last 8 messages, oldest first.
  const thread = await db
    .select()
    .from(customerEmails)
    .where(and(eq(customerEmails.customerId, customerId), eq(customerEmails.partnerId, partner.id)));
  const recent = thread
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
    .slice(-8);

  const transcript = recent
    .map((m) => `${m.direction === "inbound" ? "Customer" : partner.name}: ${m.body.slice(0, 600)}`)
    .join("\n\n");

  const matches = searchProducts(incomingMessage, 3);

  const userPrompt = [
    `Customer first name: ${cust.name.split(/\s+/)[0]}`,
    "",
    "Recent conversation (oldest first):",
    transcript || "(no prior messages)",
    "",
    "Latest message from the customer:",
    incomingMessage.slice(0, 2000),
    "",
    `The customer has emailed you. Write a helpful, warm reply that directly answers what they wrote, grounded only in the knowledge base. If you do not have a verified answer, say you will look into it and get back to them, or invite them to share more. Never invent facts, figures, or medical or income claims.`,
    "",
    matches.length > 0 ? catalogBlock(matches) : "(no specific products matched their message)",
  ].join("\n");

  const raw = await generate(systemPromptBase(partner), userPrompt, 700);
  if (!raw) return { ok: false, reason: "generation-failed" };

  const fallback = `Re: your note, ${cust.name.split(/\s+/)[0]}`;
  const { subject, body } = parseSubjectAndBody(raw, fallback);
  const finalBody = ensureDisclaimer(body);

  // Record the incoming first so the thread reads correctly, then the reply.
  await db.insert(customerEmails).values({
    customerId,
    partnerId: partner.id,
    direction: "inbound",
    kind: "inbound",
    subject: null,
    body: incomingMessage.slice(0, 8000),
    status: "received",
  });

  const send = await sendBotEmail({
    partner: { name: partner.name, slug: partner.slug },
    to: cust.email,
    subject,
    body: finalBody,
  });

  await db.insert(customerEmails).values({
    customerId,
    partnerId: partner.id,
    direction: "outbound",
    kind: "reply",
    subject,
    body: finalBody,
    status: send.ok ? "sent" : `error:${send.error?.slice(0, 200) ?? "unknown"}`,
  });

  return send.ok
    ? { ok: true, subject, body: finalBody }
    : { ok: false, reason: send.error, subject, body: finalBody };
}

// Ensure every outbound carries the compliant disclaimer footer once. We
// don't want to surprise the partner by relying on the model alone.
function ensureDisclaimer(body: string): string {
  if (/not been evaluated by the FDA/i.test(body)) return body;
  return `${body.trim()}\n\n${SIGNOFF_DISCLAIMER}`;
}

export { Customer };
