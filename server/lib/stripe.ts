import Stripe from "stripe";

const SECRET = process.env.STRIPE_SECRET_KEY;
export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const stripe: Stripe | null = SECRET
  ? new Stripe(SECRET, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion })
  : null;

export function stripeConfigured(): boolean {
  return stripe !== null && STRIPE_PRICE_ID.length > 0;
}

if (!stripe) {
  console.log("[stripe] STRIPE_SECRET_KEY not set — billing is disabled. Set it to activate $14.95/mo subscriptions.");
} else if (!STRIPE_PRICE_ID) {
  console.log("[stripe] STRIPE_PRICE_ID not set — create a $14.95/mo recurring price in Stripe dashboard, then set this env var.");
}
