import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../db.js";
import { botEmails, leadReplies, leads, type Lead } from "../../shared/schema.js";

export type SignalKind =
  | "high_intent"
  | "follow_up_gap"
  | "activation_rescue"
  | "fresh_lead"
  | "default";

export interface Signal {
  kind: SignalKind;
  priority: number;
  lead?: Lead;
  reason: string;
}

const PRIORITY: Record<SignalKind, number> = {
  high_intent: 100,
  follow_up_gap: 80,
  fresh_lead: 60,
  activation_rescue: 40,
  default: 0,
};

const DAY = 24 * 60 * 60 * 1000;

export async function computeSignals(partnerId: number): Promise<Signal[]> {
  const signals: Signal[] = [];
  const now = Date.now();

  // Pull the partner's recent leads
  const partnerLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.partnerId, partnerId))
    .orderBy(desc(leads.createdAt))
    .limit(100);

  // SIGNAL: high_intent — a lead has replied in the last 7 days but hasn't been handed off yet
  for (const lead of partnerLeads) {
    if (lead.status === "customer" || lead.status === "lost") continue;
    const recentReplies = await db
      .select({ id: leadReplies.id })
      .from(leadReplies)
      .where(and(eq(leadReplies.leadId, lead.id), gte(leadReplies.receivedAt, new Date(now - 7 * DAY))));
    if (recentReplies.length >= 1) {
      signals.push({
        kind: "high_intent",
        priority: PRIORITY.high_intent + recentReplies.length, // tiebreak: more replies = higher
        lead,
        reason: `${firstName(lead.name)} replied ${recentReplies.length === 1 ? "once" : `${recentReplies.length} times`} in the last 7 days`,
      });
    }
  }

  // SIGNAL: follow_up_gap — qualified lead with no outbound + no inbound in 3+ days
  for (const lead of partnerLeads) {
    if (lead.status === "customer" || lead.status === "lost" || lead.status === "handoff") continue;
    const [lastOut] = await db
      .select({ at: botEmails.sentAt })
      .from(botEmails)
      .where(eq(botEmails.leadId, lead.id))
      .orderBy(desc(botEmails.sentAt))
      .limit(1);
    const [lastIn] = await db
      .select({ at: leadReplies.receivedAt })
      .from(leadReplies)
      .where(eq(leadReplies.leadId, lead.id))
      .orderBy(desc(leadReplies.receivedAt))
      .limit(1);
    const lastTouch = Math.max(
      lastOut?.at?.getTime() ?? lead.createdAt.getTime(),
      lastIn?.at?.getTime() ?? lead.createdAt.getTime(),
    );
    const gapDays = (now - lastTouch) / DAY;
    if (gapDays >= 3 && gapDays <= 21) {
      signals.push({
        kind: "follow_up_gap",
        priority: PRIORITY.follow_up_gap + Math.floor(gapDays),
        lead,
        reason: `${Math.floor(gapDays)} days since you've touched ${firstName(lead.name)}`,
      });
    }
  }

  // SIGNAL: fresh_lead — net-new lead in the last 24h that's still in 'new' status
  for (const lead of partnerLeads) {
    if (lead.status !== "new") continue;
    const ageHours = (now - lead.createdAt.getTime()) / (60 * 60 * 1000);
    if (ageHours <= 24) {
      signals.push({
        kind: "fresh_lead",
        priority: PRIORITY.fresh_lead + (24 - ageHours), // sooner = higher
        lead,
        reason: `${firstName(lead.name)} just landed — strike while it's warm`,
      });
    }
  }

  // SIGNAL: activation_rescue — no leads yet at all
  if (partnerLeads.length === 0) {
    signals.push({
      kind: "activation_rescue",
      priority: PRIORITY.activation_rescue,
      reason: "Zero leads in your pipeline yet — let's get your first one in",
    });
  }

  // Always include a default low-priority signal so we never return empty
  signals.push({
    kind: "default",
    priority: PRIORITY.default,
    reason: "Stay sharp — one share, one DM, one follow-up beats a perfect plan",
  });

  // Sort by priority descending
  signals.sort((a, b) => b.priority - a.priority);
  return signals;
}

export function firstName(fullName: string): string {
  return (fullName.split(/\s+/)[0] ?? fullName).trim();
}
