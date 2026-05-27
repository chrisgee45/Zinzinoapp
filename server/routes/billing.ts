import { Router, type Request, type Response } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { partners } from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";
import { stripe, stripeConfigured, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET } from "../lib/stripe.js";

const router = Router();

function publicBaseUrl(req: Request): string {
  const fromEnv = process.env.PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

router.get("/status", authenticate, (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.json({
    configured: stripeConfigured(),
    status: req.partner.subscriptionStatus,
    hasCustomer: Boolean(req.partner.stripeCustomerId),
    hasSubscription: Boolean(req.partner.stripeSubscriptionId),
  });
});

router.post("/checkout", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!stripe || !stripeConfigured()) {
    res.status(503).json({ error: "Billing is not configured yet." });
    return;
  }

  const base = publicBaseUrl(req);

  // Reuse a customer if we have one; otherwise create + persist.
  let customerId = req.partner.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.partner.email,
      name: req.partner.name,
      metadata: { partnerId: String(req.partner.id), slug: req.partner.slug },
    });
    customerId = customer.id;
    await db
      .update(partners)
      .set({ stripeCustomerId: customerId })
      .where(eq(partners.id, req.partner.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/dashboard?subscribed=1`,
    cancel_url: `${base}/settings?billing=cancelled`,
    metadata: { partnerId: String(req.partner.id) },
    subscription_data: {
      metadata: { partnerId: String(req.partner.id) },
    },
  });

  res.json({ url: session.url });
});

router.post("/portal", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!stripe || !req.partner.stripeCustomerId) {
    res.status(400).json({ error: "No billing account yet. Subscribe first." });
    return;
  }
  const base = publicBaseUrl(req);
  const portal = await stripe.billingPortal.sessions.create({
    customer: req.partner.stripeCustomerId,
    return_url: `${base}/settings`,
  });
  res.json({ url: portal.url });
});

// Webhook handler — MUST receive the raw body, so we mount express.raw() here
// instead of relying on the global express.json() that wraps the rest of /api.
export const webhookHandler = [
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      res.status(503).send("Webhook not configured");
      return;
    }
    const signature = req.header("stripe-signature");
    if (!signature) {
      res.status(400).send("Missing signature");
      return;
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn("[stripe] webhook signature mismatch:", (err as Error).message);
      res.status(400).send("Invalid signature");
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const partnerId = Number(session.metadata?.partnerId);
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (Number.isFinite(partnerId) && subscriptionId) {
            await db
              .update(partners)
              .set({
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: "active",
              })
              .where(eq(partners.id, partnerId));
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const partnerId = Number(sub.metadata?.partnerId);
          if (Number.isFinite(partnerId)) {
            await db
              .update(partners)
              .set({
                stripeSubscriptionId: sub.id,
                subscriptionStatus: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
              })
              .where(eq(partners.id, partnerId));
          }
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (err) {
      console.error("[stripe] webhook handler error:", err);
      res.status(500).send("Handler error");
    }
  },
];

export default router;
