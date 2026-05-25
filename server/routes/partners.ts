import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { partners, type PublicPartner } from "../../shared/schema.js";

const router = Router();

router.get("/:slug", async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const [partner] = await db.select().from(partners).where(eq(partners.slug, slug)).limit(1);
  if (!partner) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  const publicPartner: PublicPartner = {
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
  };
  res.json(publicPartner);
});

export default router;
