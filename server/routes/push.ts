import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { pushSubscribeSchema, pushSubscriptions } from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/public-key", (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  res.json({ key });
});

router.post("/subscribe", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = pushSubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid subscription payload" });
    return;
  }
  const { endpoint, keys } = parsed.data;

  const [existing] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ partnerId: req.partner.id, p256dh: keys.p256dh, auth: keys.auth })
      .where(eq(pushSubscriptions.id, existing.id));
    res.json({ ok: true, updated: true });
    return;
  }

  await db.insert(pushSubscriptions).values({
    partnerId: req.partner.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });
  res.status(201).json({ ok: true });
});

router.post("/unsubscribe", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : null;
  if (!endpoint) {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.partnerId, req.partner.id)));
  res.json({ ok: true });
});

export default router;
