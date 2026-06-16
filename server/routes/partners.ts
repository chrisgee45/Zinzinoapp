import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { siteContent, type PublicPartner } from "../../shared/schema.js";
import { loadPartnerBySlug } from "../lib/loadPartner.js";

const router = Router();

router.get("/:slug", async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const partner = await loadPartnerBySlug(slug);
  if (!partner) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  const contentRows = await db
    .select({ key: siteContent.key, value: siteContent.value })
    .from(siteContent)
    .where(eq(siteContent.partnerId, partner.id));
  // Compliance: videos are platform-controlled. Even if legacy rows exist in
  // the table, never expose teaser_video_id / full_video_id to the funnel.
  const BLOCKED_KEYS = new Set(["teaser_video_id", "full_video_id"]);
  const content: Record<string, string> = {};
  for (const row of contentRows) {
    if (BLOCKED_KEYS.has(row.key)) continue;
    content[row.key] = row.value;
  }

  const publicPartner: PublicPartner & { content: Record<string, string> } = {
    id: partner.id,
    name: partner.name,
    slug: partner.slug,
    bio: partner.bio,
    photoUrl: partner.photoUrl,
    facebookUrl: partner.facebookUrl,
    instagramUrl: partner.instagramUrl,
    tiktokUrl: partner.tiktokUrl,
    enrollmentLink: partner.enrollmentLink,
    seoTitle: partner.seoTitle,
    seoDescription: partner.seoDescription,
    seoKeywords: partner.seoKeywords,
    content,
  };
  res.json(publicPartner);
});

export default router;
