import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { FileText, Loader2, Search, Sparkles } from "lucide-react";
import { AuthShell, Section } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

interface ProductCard {
  name: string;
  brand: string;
  tagline: string;
  priceLine: string;
  overview: string;
  url: string;
  factSheet: string;
}

const SUGGESTED = [
  "What is the BalanceOil+ Kit and who is it for?",
  "Compare BalanceOil+ vs BalanceOil+ Vegan",
  "What do I recommend for gut health?",
  "How does the Subscribe & Save program work?",
  "Which Brand Shop product helps with weight management?",
];

export default function AdvisorPage() {
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [answerProducts, setAnswerProducts] = useState<ProductCard[]>([]);
  const [askError, setAskError] = useState<string | null>(null);

  const [browseQuery, setBrowseQuery] = useState("");
  const [browseResults, setBrowseResults] = useState<ProductCard[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    setAnswer("");
    setAnswerProducts([]);
    try {
      const res = await api<{ answer: string; products: ProductCard[] }>(
        "/api/products/ask",
        { method: "POST", body: JSON.stringify({ question: q }) },
      );
      setAnswer(res.answer);
      setAnswerProducts(res.products ?? []);
    } catch (e) {
      setAskError(e instanceof ApiError ? e.message : "AI request failed.");
    } finally {
      setAsking(false);
    }
  }

  async function runBrowse(q: string) {
    if (!q.trim()) {
      setBrowseResults([]);
      return;
    }
    setBrowseLoading(true);
    try {
      const res = await api<{ products: ProductCard[] }>(
        `/api/products/search?q=${encodeURIComponent(q)}`,
      );
      setBrowseResults(res.products ?? []);
    } catch {
      setBrowseResults([]);
    } finally {
      setBrowseLoading(false);
    }
  }

  // Debounce the browse query so each keystroke doesn't trigger a request.
  useEffect(() => {
    const id = window.setTimeout(() => void runBrowse(browseQuery), 250);
    return () => window.clearTimeout(id);
  }, [browseQuery]);

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  return (
    <AuthShell title="Product Advisor" subtitle="Grounded in the official Zinzino catalog plus curated program facts. Use it when a prospect or customer asks something product-specific and you want a fast, compliant answer.">
      <Section
        title="Ask the advisor"
        icon={Sparkles}
      >
        <form onSubmit={onAsk} className="space-y-3">
          <Textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What's the best Zinzino product for someone focused on gut health?"
          />
          <div className="flex flex-wrap gap-1.5">
            <span className="bfa-eyebrow self-center mr-1">Try</span>
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuestion(s)}
                className="text-[11.5px] px-3 py-1 rounded-full border transition"
                style={{
                  borderColor: "var(--border-muted)",
                  background: "color-mix(in oklab, var(--surface-2) 70%, transparent)",
                  color: "rgb(148 163 184)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Stays within structure/function wording — never makes medical or income claims.
            </p>
            <Button type="submit" disabled={asking || !question.trim()}>
              {asking ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</>
              ) : (
                <>Ask <Sparkles className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </form>

        {askError && (
          <p className="mt-4 text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
            {askError}
          </p>
        )}

        {answer && (
          <div
            className="mt-5 rounded-2xl border p-5 whitespace-pre-wrap text-[13.5px] leading-relaxed relative overflow-hidden"
            style={{
              borderColor: "var(--border-gold)",
              background: "linear-gradient(135deg, rgba(212,175,55,0.05), transparent 60%), var(--surface-2)",
            }}
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-[2px]" style={{ background: "var(--gold)" }} />
            <span className="pl-2 block">{answer}</span>
          </div>
        )}

        {answerProducts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="bfa-eyebrow">Referenced products</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {answerProducts.map((p) => (
                <ProductTile key={`${p.brand}:${p.name}`} p={p} />
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Browse the catalog"
        icon={Search}
        description="Type a keyword, ingredient, or goal. Search runs across all 6 lines — Zinzino core plus the Brand Shop lines (Bode Pro, Truvy, Valentus, Zurvita, It Works!)."
      >
        <div className="space-y-3">
          <Input
            placeholder="Try: omega vegan, gut, collagen, energy, weight…"
            value={browseQuery}
            onChange={(e) => setBrowseQuery(e.target.value)}
          />
          {browseLoading ? (
            <div className="p-6 text-center text-[12px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-1.5" /> Searching…
            </div>
          ) : browseResults.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {browseResults.map((p) => (
                <ProductTile key={`${p.brand}:${p.name}`} p={p} />
              ))}
            </div>
          ) : browseQuery.trim() ? (
            <p className="text-[12px] text-muted-foreground p-4 text-center">
              No products matched that query.
            </p>
          ) : null}
        </div>
      </Section>
    </AuthShell>
  );
}

function ProductTile({ p }: { p: ProductCard }) {
  // Card-as-link pattern — the whole tile is clickable to the product
  // page (partner-personalized URL when their enrollment link is set).
  // The Fact sheet link below is a separate target with stopPropagation
  // so clicking it doesn't also fire the outer navigation.
  return (
    <a
      href={p.url || "#"}
      target="_blank"
      rel="noreferrer"
      className="bfa-card-flat bfa-card-hover p-5 sm:p-5 flex flex-col gap-2 group no-underline"
    >
      {/* Brand tag (subtle eyebrow) — only when a non-Zinzino acquired
          brand. Zinzino-original products skip the tag entirely so
          the visual flow lands straight on the product name. */}
      {p.brand && p.brand !== "Zinzino" && (
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--gold)]">
          {p.brand}
        </div>
      )}

      {/* Title — display font, prominent. Word-break so longer names
          like "BalanceOil+ Premium x2 Kit with Test" still fit two
          lines on narrow cards rather than overflowing. */}
      <h3 className="font-display text-[16px] sm:text-[17px] font-bold leading-tight text-foreground break-words">
        {p.name}
      </h3>

      {/* Tagline — sits cleanly under the title, NOT italic. */}
      {p.tagline && (
        <p className="text-[12.5px] text-muted-foreground leading-snug">{p.tagline}</p>
      )}

      {/* Price line — the visual anchor of the card. Gold accent,
          regular sans (not monospace) so it reads cleanly. */}
      {p.priceLine && (
        <p
          className="text-[13.5px] font-semibold leading-snug tabular-nums"
          style={{ color: "var(--gold)" }}
        >
          {p.priceLine}
        </p>
      )}

      {/* Description — overview if present, otherwise nothing.
          line-clamp-3 keeps cards even-height in a grid. */}
      {p.overview && (
        <p className="text-[12.5px] leading-relaxed text-foreground/75 mt-0.5 line-clamp-3">
          {p.overview}
        </p>
      )}

      {/* Fact sheet CTA — single anchor at the bottom, slightly more
          prominent than before. Stops propagation so the click goes
          to the PDF, not the outer product-page link. */}
      {p.factSheet && (
        <div className="pt-2 mt-auto">
          <a
            href={p.factSheet}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[12px] font-medium inline-flex items-center gap-1.5 text-[var(--gold)] hover:text-[var(--gold-soft)] transition"
          >
            <FileText className="h-3.5 w-3.5" /> Fact sheet
          </a>
        </div>
      )}
    </a>
  );
}
