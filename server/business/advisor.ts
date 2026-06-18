// Partner Business Advisor — answer free-text questions about the
// Zinzino compensation plan, rank advancement, and business-building
// strategy. Distinct from the Product Advisor (which answers product
// questions); shares the same compliance guardrails but adds
// business-specific rules (no income guarantees, ground in the plan).
//
// All facts come from server/business/knowledge.ts. If a question
// drifts outside that surface, the guardrails force a "not certain
// — check Back Office or official plan" response rather than an
// invented one.

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, BOT_MODEL } from "../bot/clients.js";
import { GUARDRAILS_BLOCK } from "../products/guardrails.js";
import { businessKnowledgeText } from "./knowledge.js";

const PERSONA =
  "You are a business-building assistant for independent Zinzino partners. A partner asks you about the compensation plan, rank advancement, and how to build their team and Customer base. Be accurate, concise, and practical: explain the mechanics clearly and, when asked how to advance, lay out the concrete qualifications from the plan.";

// Verbatim from the handoff spec — describes how the AI may quote plan
// figures (mechanics) but never as a promise/projection/guarantee of
// income. Keep this in lock-step with the GUARDRAILS block above.
const BUSINESS_RULES = `BUSINESS-ADVISOR RULES:
- You may explain how the compensation plan works and quote the plan's own figures (Credits, Pay Points, percentages, ranks, qualification thresholds) exactly as they appear in the knowledge base, because these describe the plan's mechanics.
- Those figures are never a promise, projection, or guarantee of income. Whenever you discuss earnings or potential, make clear that results vary, depend entirely on the partner's own sales effort and leadership, and that nothing is a guarantee of earnings.
- One Pay Point is designed to be about one euro and is paid in local currency; the company can adjust the value. Say 'about' rather than implying an exact payout.
- If a specific number or rule is not in the knowledge base, say you are not certain and point the partner to their back office or the official Compensation Plan document rather than guessing.`;

export interface BusinessAnswer {
  answer: string;
}

export async function answerBusinessQuestion(
  question: string,
): Promise<BusinessAnswer> {
  if (!anthropic) {
    throw new Error("AI is not configured (set ANTHROPIC_API_KEY).");
  }

  const knowledge = businessKnowledgeText();

  const system = [
    PERSONA,
    "",
    GUARDRAILS_BLOCK,
    "",
    BUSINESS_RULES,
    "",
    "KNOWLEDGE BASE (the official Zinzino Compensation Plan and business docs; your only source of facts):",
    knowledge,
  ].join("\n");

  const user = [
    `Partner's question: ${question}`,
    "",
    "Answer the partner directly in plain text (no markdown). Quote plan figures exactly as written. If you discuss earnings, include the reminder that results vary and are not guaranteed.",
  ].join("\n");

  const result = await anthropic.messages.create({
    model: BOT_MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: user }],
  });

  const answer = result.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  return { answer };
}
