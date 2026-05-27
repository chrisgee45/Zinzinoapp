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
      res.status(503).send("Inbound webhook not configured");
      return;
    }
    if (!verifySvixSignature(req.body, req)) {
      res.status(400).send("Invalid signature");
      return;
    }
    let payload: ResendInboundPayload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      res.status(400).send("Invalid JSON");
      return;
    }

    // Only handle inbound email events
    if (payload.type !== "email.received" || !payload.data) {
      res.json({ received: true, ignored: true });
      return;
    }

    const fromEmail = typeof payload.data.from === "string" ? payload.data.from : payload.data.from?.email;
    const subject = payload.data.subject ?? null;
    const body = (payload.data.text ?? payload.data.html ?? "").slice(0, 20_000);
    if (!fromEmail) {
      res.json({ received: true, ignored: true });
      return;
    }

    // Find lead by from email
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.email, fromEmail.toLowerCase())).limit(1);
    if (!lead) {
      res.json({ received: true, ignored: "no-lead" });
      return;
    }

    try {
      await handleInboundReply({ leadId: lead.id, fromEmail, subject, body });
    } catch (err) {
      console.error("[bot] inbound handler error:", err);
    }
    res.json({ received: true });
  },
];
