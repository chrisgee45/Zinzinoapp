import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { siteContent } from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Whitelisted keys — keeps the table tidy and prevents arbitrary blobs.
// Note: teaser_video_id and full_video_id were intentionally removed —
// videos are platform-controlled for compliance. Partner overrides for
// videos are no longer accepted or read by the funnel.
const CONTENT_KEYS = [
  "headline",
  "subheadline",
  "meta_pixel_id",
  "tiktok_pixel_id",
  "ga_measurement_id",
  "testimonials",
  "headline_variants",
  // Training workbook persistence — partner-authored values from the
  // interactive exercises. Long values (especially prospect_list which is
  // a JSON array of up to 100 contacts) drive the larger max length below.
  "vision_text",
  "why_text",
  "prospect_list",
  // Six Questions rating block — JSON map of itemIndex → 1-10 rating.
  "ratings_six_questions",
  // Graduation checklists, one key per module. JSON map of itemIndex → bool.
  "graduation_foundation",
  "graduation_level_1",
  "graduation_level_2",
  "graduation_level_3",
  "graduation_level_4",
  "graduation_toolkit",
  "graduation_closing",
  // Inline checklist blocks inside training steps.
  "checklist_closing_mindset",
] as const;

type ContentKey = (typeof CONTENT_KEYS)[number];

// 60kb cap — comfortably fits a 100-name workbook (avg ~150 bytes/row x
// 100 = 15kb) plus headroom, while still being small enough for a single
// row in the table.
const upsertSchema = z.object({
  key: z.enum(CONTENT_KEYS),
  value: z.string().max(60_000),
});

router.get("/", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const rows = await db
    .select({ key: siteContent.key, value: siteContent.value })
    .from(siteContent)
    .where(eq(siteContent.partnerId, req.partner.id));
  const content: Partial<Record<ContentKey, string>> = {};
  for (const row of rows) {
    if ((CONTENT_KEYS as readonly string[]).includes(row.key)) {
      content[row.key as ContentKey] = row.value;
    }
  }
  res.json({ content });
});

router.put("/", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const partnerId = req.partner.id;
  const [existing] = await db
    .select({ id: siteContent.id })
    .from(siteContent)
    .where(and(eq(siteContent.partnerId, partnerId), eq(siteContent.key, parsed.data.key)))
    .limit(1);

  if (existing) {
    await db
      .update(siteContent)
      .set({ value: parsed.data.value, updatedAt: new Date() })
      .where(eq(siteContent.id, existing.id));
  } else {
    await db.insert(siteContent).values({
      partnerId,
      key: parsed.data.key,
      value: parsed.data.value,
    });
  }
  res.json({ ok: true });
});

router.delete("/:key", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const key = String(req.params.key);
  if (!(CONTENT_KEYS as readonly string[]).includes(key)) {
    res.status(400).json({ error: "Unknown key" });
    return;
  }
  await db
    .delete(siteContent)
    .where(and(eq(siteContent.partnerId, req.partner.id), eq(siteContent.key, key)));
  res.json({ ok: true });
});

export { CONTENT_KEYS };
export default router;
