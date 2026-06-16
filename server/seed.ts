import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { partners } from "../shared/schema.js";

// Email of the partner account that should hold platform-admin access.
// Configurable via env so production can override without a code change.
// Falls back to the current owner's address.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "chris@gee4inc.com").toLowerCase();

// Seeder runs on every server boot. We deliberately do NOT auto-create
// the admin partner anymore — that creates a stray account with a
// predictable password whenever the database is fresh. Instead we look
// up the configured admin email; if it exists as a real registered
// partner, we make sure is_admin is true. If it doesn't exist, we log
// and move on — the partner just signs up normally first, then a boot
// promotes them.
export async function seedAdmin(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: partners.id, isAdmin: partners.isAdmin })
      .from(partners)
      .where(eq(partners.email, ADMIN_EMAIL))
      .limit(1);
    if (!existing) {
      console.log(
        `[seed] No partner found for ADMIN_EMAIL=${ADMIN_EMAIL} yet — sign up that account, then restart to promote.`,
      );
      return;
    }
    if (!existing.isAdmin) {
      await db.update(partners).set({ isAdmin: true }).where(eq(partners.id, existing.id));
      console.log(`[seed] Promoted ${ADMIN_EMAIL} to platform admin.`);
    }
  } catch (err) {
    console.warn("[seed] Admin seed skipped:", (err as Error).message);
  }
}
