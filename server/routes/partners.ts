import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { partners, siteContent, type PublicPartner } from "../../shared/schema.js";

const router = Router();

router.get("/:slug", async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const [partner] = await db.select().from(partners).where(eq(partners.slug, slug)).limit(1);
  if (!partner) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  const contentRows = await db
    .select({ key: siteContent.key, value: siteContent.value })
    .from(siteContent)
    .where(eq(siteContent.partnerId, partner.id));
  const content: Record<string, string> = {};
  for (const row of contentRows) content[row.key] = row.value;

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
