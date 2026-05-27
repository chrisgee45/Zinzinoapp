import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { aiRecommendations, leads, partners } from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";
import { computeSignals } from "../coach/signals.js";
import { actionFor, type ActionRecommendation } from "../coach/actions.js";
import { generateDrafts, openai, type MessageDraft } from "../coach/openai.js";

const router = Router();

function todayDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

interface TodayResponse {
  date: string;
  action: ActionRecommendation;
  drafts: MessageDraft | null;
  completed: boolean;
  aiAvailable: boolean;
}

router.get("/today", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const partnerId = req.partner.id;
  const date = todayDate();

  // Check cache first — never generate AI on page load.
  const [existing] = await db
    .select()
    .from(aiRecommendations)
    .where(and(eq(aiRecommendations.partnerId, partnerId), eq(aiRecommendations.date, date)))
    .limit(1);

  if (existing) {
    const response: TodayResponse = {
      date,
      action: existing.nextAction as unknown as ActionRecommendation,
      drafts: (existing.messageDrafts as unknown as MessageDraft | null) ?? null,
      completed: existing.completed,
      aiAvailable: openai !== null,
    };
    res.json(response);
    return;
  }

  // Compute today's action from signals (no AI call yet — just heuristics).
  const signals = await computeSignals(partnerId);
  const top = signals[0];
  const action = actionFor(top);

  await db
    .insert(aiRecommendations)
    .values({
      partnerId,
      date,
      nextAction: action as unknown as Record<string, unknown>,
      messageDrafts: {},
      reasoning: { signals: signals.slice(0, 3).map((s) => ({ kind: s.kind, reason: s.reason })) },
      completed: false,
    })
    .onConflictDoNothing();

  const response: TodayResponse = {
    date,
    action,
    drafts: null,
    completed: false,
    aiAvailable: openai !== null,
  };
  res.json(response);
});

router.post("/complete", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  await db
    .update(aiRecommendations)
    .set({ completed: true })
    .where(
      and(
        eq(aiRecommendations.partnerId, req.partner.id),
        eq(aiRecommendations.date, todayDate()),
      ),
    );
  res.json({ ok: true });
});

router.post("/generate-draft", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!openai) {
    res.status(503).json({ error: "AI coaching is not configured (OPENAI_API_KEY missing)." });
    return;
  }

  // Rate limit: max 1 generation + 1 regen per day per partner
  const today = todayDate();
  const todayDateObj = new Date(today);
  const sameDay = req.partner.lastAiCallDate?.toString() === today;
  const dailyCalls = sameDay ? req.partner.dailyAiCalls : 0;
  if (dailyCalls >= 2) {
    res.status(429).json({ error: "Daily AI draft limit reached — comes back tomorrow." });
    return;
  }

  const [rec] = await db
    .select()
    .from(aiRecommendations)
    .where(
      and(eq(aiRecommendations.partnerId, req.partner.id), eq(aiRecommendations.date, today)),
    )
    .limit(1);
  if (!rec) {
    res.status(400).json({ error: "No action yet — load Today's Move first." });
    return;
  }

  const action = rec.nextAction as unknown as ActionRecommendation;
  let lead = undefined;
  if (action.leadId) {
    const [found] = await db.select().from(leads).where(eq(leads.id, action.leadId)).limit(1);
    if (found && found.partnerId === req.partner.id) lead = found;
  }

  const drafts = await generateDrafts({ partner: req.partner, action, lead });
  if (!drafts) {
    res.status(500).json({ error: "Couldn't generate a draft — try again in a moment." });
    return;
  }

  await db
    .update(aiRecommendations)
    .set({ messageDrafts: drafts as unknown as Record<string, unknown> })
    .where(eq(aiRecommendations.id, rec.id));

  await db
    .update(partners)
    .set({
      lastAiCallDate: todayDateObj.toISOString().slice(0, 10),
      dailyAiCalls: dailyCalls + 1,
    })
    .where(eq(partners.id, req.partner.id));

  res.json({ drafts });
});

export default router;
