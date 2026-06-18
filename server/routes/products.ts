// Partner Product Advisor — Feature B of the Z Force product AI spec.
//
// Two endpoints behind partner auth:
//   GET  /api/products/search?q=...        → top ~12 search results
//   POST /api/products/ask  { question }   → { answer, products }
//
// The ask endpoint grounds the answer in (a) the curated KB and (b) the top
// 5 catalog hits formatted via catalogBlock. The system prompt injects the
// guardrails verbatim. The model gets no access to its own training for
// product facts.

import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { anthropic, BOT_MODEL } from "../bot/clients.js";
import {
  searchProducts,
  formatProduct,
  catalogBlock,
  type Product,
} from "../products/catalog.js";
import { GUARDRAILS_BLOCK, CURATED_KB } from "../products/guardrails.js";
import { partnerIdFromEnrollmentLink, personalizeProductUrl } from "../lib/partnerUrls.js";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();

const SEARCH_LIMIT = 12;

router.get("/search", authenticate, (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const results = q.trim() ? searchProducts(q, SEARCH_LIMIT) : [];
  const partnerId = partnerIdFromEnrollmentLink(req.partner.enrollmentLink);
  res.json({ products: results.map((p) => toClientShape(p, partnerId)) });
});

const askSchema = z.object({
  question: z.string().trim().min(1).max(800),
});

router.post("/ask", authenticate, async (req, res) => {
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
    res.status(503).json({ error: "AI not configured" });
    return;
  }

  const { question } = parsed.data;
  const matches = searchProducts(question, 5);

  // System prompt assembly per spec §3. Curated KB lives below the
  // guardrails + catalog-use note so the model treats it as the source-of-
  // truth for the core flagship products, with the catalog filling in the
  // long tail. The catalog-use note is included automatically by
  // catalogBlock; we pass it through here unchanged.
  const system = [
    "You are a product-knowledge assistant for independent Zinzino partners. A partner asks you questions about the products so they can confidently help their prospects and customers. Be accurate, concise, and practical, and suggest the right product for a stated goal when asked.",
    "",
    GUARDRAILS_BLOCK,
    "",
    "Curated Zinzino knowledge base (prefer this for the core products):",
    CURATED_KB,
  ].join("\n");

  const userPrompt = [
    `Partner question: ${question}`,
    "",
    matches.length > 0 ? catalogBlock(matches) : "(No catalog matches found for this query. Answer from the curated knowledge base above, or say you are not certain.)",
    "",
    "Answer the partner directly in plain text (no markdown). If you mention a price, use the catalog figure exactly. Keep it under 180 words.",
  ].join("\n");

  try {
    const result = await anthropic.messages.create({
      model: BOT_MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const answer = result.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    const partnerId = partnerIdFromEnrollmentLink(req.partner.enrollmentLink);
    res.json({ answer, products: matches.map((p) => toClientShape(p, partnerId)) });
  } catch (e) {
    console.error("[advisor] anthropic call failed:", e);
    res.status(502).json({ error: "AI request failed" });
  }
});

// Slim wire shape for the client — strips the long catalog text the UI
// doesn't need on the card. The Advisor page renders name, brand, price
// summary, tagline, a 1-2 line overview, fact-sheet link, and a
// product-page link rewritten to the partner's replicated Zinzino
// store so any click flows credit through their personal site.
function toClientShape(p: Product, partnerId: string | null) {
  return {
    name: p.name,
    brand: p.brand,
    tagline: p.tagline,
    priceLine: p.priceLine,
    overview: p.overview,
    url: personalizeProductUrl(p.url, partnerId),
    factSheet: p.factSheet,
  };
}

export default router;
