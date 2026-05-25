import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { partners } from "../shared/schema.js";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin2026";
const ADMIN_SLUG = "admin";

export async function seedAdmin(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: partners.id, isAdmin: partners.isAdmin })
      .from(partners)
      .where(eq(partners.email, ADMIN_EMAIL))
      .limit(1);
    if (existing) {
      if (!existing.isAdmin) {
        await db.update(partners).set({ isAdmin: true }).where(eq(partners.id, existing.id));
      }
      return;
    }
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.insert(partners).values({
      email: ADMIN_EMAIL,
      password: hash,
      name: "Platform Admin",
      slug: ADMIN_SLUG,
      isAdmin: true,
      subscriptionStatus: "active",
    });
    console.log("[seed] Created default admin account (admin@example.com).");
  } catch (err) {
    console.warn("[seed] Admin seed skipped:", (err as Error).message);
  }
}
