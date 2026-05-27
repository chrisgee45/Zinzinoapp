import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  partners,
  loginSchema,
  registerPartnerSchema,
  updateProfileSchema,
} from "../../shared/schema.js";
import { signToken } from "../lib/jwt.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

function partnerToSession(partner: typeof partners.$inferSelect) {
  const { password: _pw, ...safe } = partner;
  return safe;
}

router.post("/register", async (req, res) => {
  const parsed = registerPartnerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const { name, email, password, slug } = parsed.data;

  const [emailClash] = await db.select({ id: partners.id }).from(partners).where(eq(partners.email, email)).limit(1);
  if (emailClash) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }
  const [slugClash] = await db.select({ id: partners.id }).from(partners).where(eq(partners.slug, slug)).limit(1);
  if (slugClash) {
    res.status(409).json({ error: "That slug is taken — try another" });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const [partner] = await db
    .insert(partners)
    .values({ name, email, password: hash, slug, subscriptionStatus: "inactive" })
    .returning();

  const token = signToken({ sub: partner.id, email: partner.email, isAdmin: partner.isAdmin });
  res.status(201).json({ token, partner: partnerToSession(partner) });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const [partner] = await db.select().from(partners).where(eq(partners.email, email)).limit(1);
  if (!partner) {
    res.status(401).json({ error: "Email or password is incorrect" });
    return;
  }
  const ok = await bcrypt.compare(password, partner.password);
  if (!ok) {
    res.status(401).json({ error: "Email or password is incorrect" });
    return;
  }
  const token = signToken({ sub: partner.id, email: partner.email, isAdmin: partner.isAdmin });
  res.json({ token, partner: partnerToSession(partner) });
});

router.get("/me", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.json({ partner: partnerToSession(req.partner) });
});

router.put("/profile", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const [updated] = await db
    .update(partners)
    .set(parsed.data)
    .where(eq(partners.id, req.partner.id))
    .returning();
  res.json({ partner: partnerToSession(updated) });
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(8, "At least 8 characters"),
});

router.put("/password", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const ok = await bcrypt.compare(parsed.data.currentPassword, req.partner.password);
  if (!ok) {
    res.status(401).json({ error: "Current password doesn't match" });
    return;
  }
  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(partners).set({ password: hash }).where(eq(partners.id, req.partner.id));
  res.json({ ok: true });
});

export default router;
