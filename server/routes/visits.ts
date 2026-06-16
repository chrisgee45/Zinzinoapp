import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { pageVisits, partners } from "../../shared/schema.js";

const router = Router();

const visitSchema = z.object({
  partnerId: z.number().int().positive(),
  page: z.enum(["landing", "presentation", "breakdown", "main", "dashboard"]),
  referrer: z.string().max(500).optional(),
});

function hashIp(req: import("express").Request): string {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? "";
  return crypto.createHash("sha256").update(ip + (process.env.IP_HASH_SALT ?? "bfa")).digest("hex").slice(0, 32);
}

router.post("/", async (req, res) => {
  const parsed = visitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [partner] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.id, parsed.data.partnerId))
    .limit(1);
  if (!partner) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  await db.insert(pageVisits).values({
    partnerId: parsed.data.partnerId,
    page: parsed.data.page,
    ipHash: hashIp(req),
    userAgent: req.header("user-agent") ?? null,
    referrer: parsed.data.referrer ?? req.header("referer") ?? null,
  });
  res.status(201).json({ ok: true });
});

export default router;
