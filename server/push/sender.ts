import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { pushSubscriptions } from "../../shared/schema.js";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@buildfromanywhere.com";

let configured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
    console.log("[push] VAPID configured. Push notifications enabled.");
  } catch (e) {
    console.error("[push] setVapidDetails failed:", e);
  }
} else {
  console.log("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing — push notifications disabled until set.");
}

export function pushEnabled(): boolean {
  return configured;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // path the service worker should open on click
  tag?: string; // de-dupes notifications with the same tag
}

/**
 * Fans a single payload out to every active push subscription for a partner.
 * Cleans up subscriptions that respond 404/410 (the browser disposed of
 * them — common when a user clears site data or uninstalls the PWA).
 */
export async function sendPushToPartner(partnerId: number, payload: PushPayload): Promise<void> {
  if (!configured) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.partnerId, partnerId));
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription is gone. Stop trying to reach it.
          await db
            .delete(pushSubscriptions)
            .where(
              and(
                eq(pushSubscriptions.endpoint, sub.endpoint),
                eq(pushSubscriptions.partnerId, partnerId),
              ),
            )
            .catch(() => undefined);
          return;
        }
        console.warn(`[push] send to partner=${partnerId} failed (status=${status}):`, err);
      }
    }),
  );
}
