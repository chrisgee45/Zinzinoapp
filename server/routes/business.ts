// Partner Business Advisor endpoint.
//
//   POST /api/business/ask  { question }  → { answer }
//
// Auth required. Read-only — no tenant scoping beyond auth, since the
// knowledge base is global Zinzino compensation plan content. Anthropic
// is mandatory; if not configured, returns 503 so the client can
// surface a clean error rather than a hung request.

import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { anthropic } from "../bot/clients.js";
import { answerBusinessQuestion } from "../business/advisor.js";

const router = Router();

const askSchema = z.object({
  question: z.string().trim().min(2).max(1000),
});

router.post("/ask", authenticate, async (req, res, next) => {
  try {
    if (!req.partner) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
      return;
    }
    if (!anthropic) {
      res.status(503).json({ error: "AI is not configured (set ANTHROPIC_API_KEY)." });
      return;
    }
    const result = await answerBusinessQuestion(parsed.data.question);
    res.json(result);
  } catch (err) {
    // Express 4 swallow guard — without this an Anthropic timeout would
    // hang the response indefinitely. See server/routes/analytics.ts
    // for the same pattern.
    next(err);
  }
});

export default router;
