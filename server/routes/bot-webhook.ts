import express, { type Request, type Response } from "express";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { leads } from "../../shared/schema.js";
import { RESEND_SIGNING_KEY } from "../bot/clients.js";
import { handleInboundReply } from "../bot/scheduler.js";

interface ResendInboundPayload {
  type?: string;
  data?: {
    email_id?: string;
    from?: { email?: string } | string;
    to?: Array<{ email?: string }> | string;
    subject?: string;
    text?: string;
    html?: string;
  };
}

function verifySvixSignature(rawBody: Buffer, req: Request): boolean {
  if (!RESEND_SIGNING_KEY) return false;
  const id = req.header("svix-id");
  const timestamp = req.header("svix-timestamp");
  const signatureHeader = req.header("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const signedPayload = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
  // RESEND_SIGNING_KEY is base64-encoded after the "whsec_" prefix
  const secret = RESEND_SIGNING_KEY.startsWith("whsec_")
    ? RESEND_SIGNING_KEY.slice("whsec_".length)
    : RESEND_SIGNING_KEY;
  const secretBytes = Buffer.from(secret, "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

  const sigs = signatureHeader.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  return sigs.some((s) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(s, "base64"), Buffer.from(expected, "base64"));
    } catch {
      return false;
    }
  });
}

export const inboundEmailHandler = [
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response) => {
    if (!RESEND_SIGNING_KEY) {
      console.warn("[bot/inbound] RESEND_SIGNING_KEY env var is not set — every webhook will return 503. Set it in Railway to the whsec_... value from Resend's webhook config.");
      res.status(503).send("Inbound webhook not configured");
      return;
    }
    if (!verifySvixSignature(req.body, req)) {
      console.warn("[bot/inbound] Svix signature verification failed. Either RESEND_SIGNING_KEY does not match the webhook's signing key in Resend, or the body got mangled by a middleware before us.");
      res.status(400).send("Invalid signature");
      return;
    }
    let payload: ResendInboundPayload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      console.warn("[bot/inbound] Body was not valid JSON.");
      res.status(400).send("Invalid JSON");
      return;
    }

    if (payload.type !== "email.received" || !payload.data) {
      console.log(`[bot/inbound] Ignored event of type "${payload.type ?? "?"}". This webhook only handles email.received. If you want this in scope, update the subscription in Resend.`);
      res.json({ received: true, ignored: true });
      return;
    }

    const fromEmail = typeof payload.data.from === "string" ? payload.data.from : payload.data.from?.email;
    const toEmail = Array.isArray(payload.data.to)
      ? payload.data.to[0]?.email
      : typeof payload.data.to === "string"
        ? payload.data.to
        : undefined;
    const subject = payload.data.subject ?? null;
    const body = (payload.data.text ?? payload.data.html ?? "").slice(0, 20_000);
    console.log(`[bot/inbound] email.received from=${fromEmail ?? "(none)"} to=${toEmail ?? "(none)"} subject="${subject ?? ""}" bodyLen=${body.length}`);
    if (!fromEmail) {
      console.warn("[bot/inbound] No from address on payload, ignoring.");
      res.json({ received: true, ignored: true });
      return;
    }

    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.email, fromEmail.toLowerCase())).limit(1);
    if (!lead) {
      console.log(`[bot/inbound] No lead found for fromEmail=${fromEmail.toLowerCase()}. This means the address that just replied isn't a known prospect — either the lead record is gone, or the reply came from a forwarded address that doesn't match the original lead email.`);
      res.json({ received: true, ignored: "no-lead" });
      return;
    }

    console.log(`[bot/inbound] Matched lead id=${lead.id} for fromEmail=${fromEmail.toLowerCase()}. Handing off to handleInboundReply.`);
    try {
      await handleInboundReply({ leadId: lead.id, fromEmail, subject, body });
      console.log(`[bot/inbound] handleInboundReply completed for lead id=${lead.id}.`);
    } catch (err) {
      console.error(`[bot/inbound] handleInboundReply threw for lead id=${lead.id}:`, err);
    }
    res.json({ received: true });
  },
];
