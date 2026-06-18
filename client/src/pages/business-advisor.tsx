import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Loader2, Send, TrendingUp } from "lucide-react";
import { AuthShell, Section } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

// Suggestion chips — verbatim from the handoff spec §5. Clicking one
// submits it immediately rather than just pre-filling the input, since
// the partner explicitly chose a vetted starting question.
const SUGGESTED: string[] = [
  "How do I qualify to be an active Partner?",
  "What do I need to reach Executive?",
  "How does Team Commission work?",
  "Explain the Fast Start Plan.",
  "What is the difference between ECB and RCB?",
  "How does the Zinzino4Free program work?",
  "What is a Balanced Credit 2:1?",
  "How do I earn the Mentor Matching Bonus?",
];

const DISCLAIMER =
  "For business education only. Plan figures describe how the compensation plan works and are not a guarantee or projection of income. Results vary and depend on your own effort.";

export default function BusinessAdvisorPage() {
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setAnswer("");
    setError(null);
    try {
      const res = await api<{ answer: string }>("/api/business/ask", {
        method: "POST",
        body: JSON.stringify({ question: trimmed }),
      });
      setAnswer(res.answer);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the business advisor.");
    } finally {
      setAsking(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  return (
    <AuthShell>
      <Section
        title="Business advisor"
        icon={TrendingUp}
        description="Ask anything about the Zinzino opportunity: the compensation plan, rank advancement, and building plans. Answers are grounded in the official Compensation Plan."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="relative">
            <TrendingUp className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What do I need to reach Executive?"
              className="pl-9 pr-24"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <Button type="submit" size="sm" disabled={asking || !question.trim()}>
                {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Ask</>}
              </Button>
            </div>
          </div>

          {/* Suggestion chips — clicking one fires the question
              immediately so the partner doesn't have to confirm twice. */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
                disabled={asking}
                className="text-[11.5px] px-2.5 py-1 rounded-full border transition disabled:opacity-50"
                style={{
                  background: "color-mix(in oklab, var(--gold) 4%, transparent)",
                  borderColor: "var(--border-gold)",
                  color: "var(--gold)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <p className="mt-4 text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {(answer || asking) && (
          <article className="bfa-card-strong mt-5 p-5 sm:p-6">
            <p className="bfa-eyebrow mb-2" style={{ color: "var(--gold)" }}>Answer</p>
            {asking && !answer ? (
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading the Compensation Plan…
              </div>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {answer}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/80 mt-5 leading-snug">
              {DISCLAIMER}
            </p>
          </article>
        )}
      </Section>
    </AuthShell>
  );
}
