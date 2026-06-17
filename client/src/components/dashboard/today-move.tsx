import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

interface MessageDraft {
  sms: string;
  dm: string;
}

interface TodayAction {
  signal: string;
  title: string;
  body: string;
  leadId?: number;
  leadName?: string;
  channel: "sms" | "dm" | "share" | "self";
  rationale: string;
}

interface TodayResponse {
  date: string;
  action: TodayAction;
  drafts: MessageDraft | null;
  completed: boolean;
  aiAvailable: boolean;
}

// Per-signal urgency label + accent tone. The accent flows through to the
// left rule + dot color so the card reads as urgent without being loud.
const SIGNAL_META: Record<string, { label: string; rule: string; dot: string; tint: string }> = {
  high_intent: {
    label: "Hot signal",
    rule: "var(--success)",
    dot: "var(--success)",
    tint: "rgba(34,197,94,0.10)",
  },
  follow_up_gap: {
    label: "Follow-up overdue",
    rule: "var(--warning)",
    dot: "var(--warning)",
    tint: "rgba(245,158,11,0.10)",
  },
  fresh_lead: {
    label: "Fresh lead",
    rule: "var(--gold)",
    dot: "var(--gold)",
    tint: "rgba(212,175,55,0.10)",
  },
  activation_rescue: {
    label: "Activation rescue",
    rule: "#a78bfa",
    dot: "#a78bfa",
    tint: "rgba(167,139,250,0.10)",
  },
  default: {
    label: "Today",
    rule: "var(--border-gold)",
    dot: "var(--gold)",
    tint: "rgba(212,175,55,0.06)",
  },
};

export function TodayMoveCard() {
  const queryClient = useQueryClient();
  const today = useQuery<TodayResponse>({
    queryKey: ["coach", "today"],
    queryFn: () => api<TodayResponse>("/api/coach/today"),
  });

  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateDraft() {
    if (generating) return;
    setError(null);
    setGenerating(true);
    try {
      const data = await api<{ drafts: MessageDraft }>("/api/coach/generate-draft", { method: "POST" });
      queryClient.setQueryData<TodayResponse>(["coach", "today"], (prev) =>
        prev ? { ...prev, drafts: data.drafts } : prev,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't draft a message right now.");
    } finally {
      setGenerating(false);
    }
  }

  async function markDone() {
    if (completing) return;
    setCompleting(true);
    try {
      await api("/api/coach/complete", { method: "POST" });
      queryClient.setQueryData<TodayResponse>(["coach", "today"], (prev) =>
        prev ? { ...prev, completed: true } : prev,
      );
    } catch {
      /* swallow */
    } finally {
      setCompleting(false);
    }
  }

  if (today.isPending) {
    return (
      <div className="bfa-card p-5 sm:p-6 mb-4 sm:mb-5 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--gold)]" />
        <p className="text-sm text-muted-foreground">Reading your pipeline…</p>
      </div>
    );
  }
  if (today.isError || !today.data) return null;

  const { action, drafts, completed, aiAvailable } = today.data;
  const meta = SIGNAL_META[action.signal] ?? SIGNAL_META.default;

  return (
    <article
      className="bfa-card-strong bfa-glow mb-4 sm:mb-5 overflow-hidden relative bfa-animate-in"
      style={{
        background: `linear-gradient(135deg, ${meta.tint} 0%, transparent 60%), var(--surface-2)`,
      }}
    >
      {/* Left accent rule */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: meta.rule }}
      />

      <div className="p-5 sm:p-7">
        {/* Top row: Command Intel framing on the left, completed pill on
            the right. The framing acts as a header for the whole card so
            the partner reads "this is THE move" before any content. */}
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5 flex-wrap">
          <div className="inline-flex items-center gap-2">
            <span className="bfa-eyebrow" style={{ color: "var(--gold)" }}>Command Intel</span>
            <span className="text-muted-foreground/40 text-[10px]">·</span>
            <span className="bfa-eyebrow text-muted-foreground/80">Today&apos;s move</span>
          </div>
          {/* Urgency pill — small, refined. Tinted to the signal tone
              with a hairline ring instead of a heavy border. */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{
              background: meta.tint,
              boxShadow: `inset 0 0 0 1px ${meta.rule}55`,
              color: meta.dot,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: meta.dot, boxShadow: `0 0 0 2.5px ${meta.tint}` }}
            />
            {meta.label}
          </span>
        </div>

        {/* Headline + body. The target tile carries the gold accent so
            the action title sits in service of "the move to make right
            now," not a generic icon-headline pair. */}
        <div className="flex items-start gap-3.5 sm:gap-5">
          <span
            className="hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
            style={{
              background: "color-mix(in oklab, var(--gold) 14%, transparent)",
              border: "1px solid var(--border-gold)",
              color: "var(--gold)",
            }}
          >
            <Target className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            {/* Lead name as a soft eyebrow above the headline — directly
                answers "who do I act on" before "what do I say." Reads
                in foreground tone, not gold, so the gold accent stays
                reserved for the Command Intel framing + the headline
                action. */}
            {action.leadName && (
              <p className="bfa-eyebrow mb-1.5 text-foreground/70">
                {action.leadName}
              </p>
            )}
            <h2
              className="font-display text-[22px] sm:text-[26px] font-bold leading-[1.12] tracking-tight"
              style={{ textDecoration: completed ? "line-through" : "none", color: completed ? "hsl(var(--muted-foreground))" : undefined }}
            >
              {action.title}
            </h2>
            <p className="text-[14px] text-foreground/85 mt-2.5 leading-relaxed max-w-2xl">
              {action.body}
            </p>
            {/* Why this lead — coach's rationale gets its own muted
                callout block so it reads as "the reason behind the move"
                instead of small italic afterthought text. */}
            {action.rationale && (
              <div
                className="mt-4 pl-3 py-1 max-w-xl border-l"
                style={{ borderColor: "var(--border-muted)" }}
              >
                <span className="bfa-eyebrow mr-1.5 text-muted-foreground/60">Why</span>
                <span className="text-[13px] text-muted-foreground/90 leading-relaxed">
                  {action.rationale}
                </span>
              </div>
            )}
          </div>
        </div>

        {drafts && drafts.sms && drafts.dm && (
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <DraftCard label="SMS / iMessage" body={drafts.sms} />
            <DraftCard label="DM" body={drafts.dm} />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2 mt-4">
            {error}
          </p>
        )}

        {/* Action row: primary CTA (open the lead) sized lg for command
            weight, secondary draft action right next to it, mark-done
            sits on the right as a quieter completion. */}
        <div
          className="mt-6 pt-5 border-t flex flex-wrap gap-2 items-center"
          style={{ borderColor: "var(--border-muted)" }}
        >
          {action.leadId && (
            <Button size="lg" asChild>
              <Link href={`/dashboard/leads/${action.leadId}`}>
                Open {action.leadName ? action.leadName.split(" ")[0] : "lead"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {aiAvailable && (
            <Button size="lg" variant="secondary" onClick={generateDraft} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : drafts ? (
                <><RefreshCw className="h-4 w-4" /> Regenerate draft</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Draft a message</>
              )}
            </Button>
          )}
          {!completed ? (
            <Button size="sm" variant="ghost" onClick={markDone} disabled={completing} className="ml-auto">
              {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Mark done</>}
            </Button>
          ) : (
            <span className="text-[12px] text-[color:var(--success)] inline-flex items-center gap-1.5 ml-auto font-semibold">
              <Zap className="h-3.5 w-3.5" /> One move, made.
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function DraftCard({ label, body }: { label: string; body: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    // navigator.clipboard.writeText(undefined) coerces to the literal
    // string "undefined" — this bug shipped to prod once.
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  }
  return (
    <div className="bfa-card-flat p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="bfa-eyebrow inline-flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" /> {label}
        </p>
        <button onClick={copy} className="text-[11px] text-[var(--gold)] hover:text-[var(--gold-soft)] inline-flex items-center gap-1 transition">
          {copied ? <><Check className="h-3 w-3" /> copied</> : <><Copy className="h-3 w-3" /> copy</>}
        </button>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}
