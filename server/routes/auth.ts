import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db.js";
import { sendPartnerNotification } from "../bot/email.js";
import { PUBLIC_BASE_URL } from "../bot/clients.js";
import {
  partners,
  forgotPasswordSchema,
  loginSchema,
  registerPartnerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../../shared/schema.js";
import { signToken } from "../lib/jwt.js";
import { authenticate } from "../middleware/auth.js";
import { loadPartnerByEmail } from "../lib/loadPartner.js";

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
  const partner = await loadPartnerByEmail(email);
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

// Forgot password: always responds 200 so an attacker can't enumerate which
// addresses are real partner accounts. Quietly issues a reset token and
// emails it to the address only if it matches a partner. Raw token lives in
// the email link; only a sha256 hash + 60-min expiry land in the DB so a
// leaked snapshot can't be used to reset arbitrary accounts.
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

router.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const partner = await loadPartnerByEmail(parsed.data.email);
  if (partner) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db
      .update(partners)
      .set({ passwordResetHash: hashToken(rawToken), passwordResetExpiresAt: expires })
      .where(eq(partners.id, partner.id));

    const resetUrl = `${PUBLIC_BASE_URL}/reset-password?token=${rawToken}`;
    const firstName = partner.name.split(/\s+/)[0] ?? partner.name;
    const body = [
      `Hey ${firstName},`,
      "",
      "Someone (likely you) asked to reset your Build From Anywhere password.",
      "",
      "Open this link to pick a new one. It expires in 60 minutes:",
      resetUrl,
      "",
      "If you didn't ask for this, ignore the email and your password stays the same.",
      "",
      "Build From Anywhere",
    ].join("\n");

    // Fire-and-forget so the response timing doesn't leak whether an
    // address matched a partner (constant-time response from the client's
    // perspective).
    void sendPartnerNotification({
      to: partner.email,
      subject: "Reset your Build From Anywhere password",
      body,
    }).catch((e) => console.warn("[auth] forgot-password email failed:", e));
  } else {
    console.log(`[auth] forgot-password requested for unknown email "${parsed.data.email}" — silent no-op.`);
  }

  res.json({ ok: true });
});

router.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors.newPassword?.[0] ?? "Invalid input" });
    return;
  }

  const tokenHash = hashToken(parsed.data.token);
  const now = new Date();
  const [partner] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.passwordResetHash, tokenHash), gt(partners.passwordResetExpiresAt, now)))
    .limit(1);
  if (!partner) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Request a fresh one." });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db
    .update(partners)
    .set({ password: newHash, passwordResetHash: null, passwordResetExpiresAt: null })
    .where(eq(partners.id, partner.id));

  res.json({ ok: true });
});

export default router;
