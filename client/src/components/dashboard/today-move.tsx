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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

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

const SIGNAL_TONE: Record<string, string> = {
  high_intent: "border-emerald-500/40 bg-emerald-500/8",
  follow_up_gap: "border-amber-500/40 bg-amber-500/8",
  fresh_lead: "border-[var(--gold)]/40 bg-[var(--gold)]/8",
  activation_rescue: "border-violet-500/40 bg-violet-500/8",
  default: "border-border/50 bg-secondary/40",
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
      <div className="bfa-card p-5 sm:p-6 mb-6 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--gold)]" />
        <p className="text-sm text-muted-foreground">Reading your pipeline…</p>
      </div>
    );
  }
  if (today.isError || !today.data) return null;

  const { action, drafts, completed, aiAvailable } = today.data;
  const tone = SIGNAL_TONE[action.signal] ?? SIGNAL_TONE.default;

  return (
    <div className={cn("rounded-2xl border p-5 sm:p-7 mb-6 bfa-animate-in", tone)}>
      <div className="flex items-start gap-3">
        <Target className="h-5 w-5 text-[var(--gold)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Today&apos;s ONE move</p>
          <h2 className={cn("font-display text-xl sm:text-2xl font-bold mt-1", completed && "line-through text-muted-foreground")}>
            {action.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">{action.body}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-2 italic">{action.rationale}</p>

          {drafts && (
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <DraftCard label="SMS / iMessage" body={drafts.sms} />
              <DraftCard label="DM" body={drafts.dm} />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2 mt-3">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2 items-center">
            {action.leadId && (
              <Button size="sm" asChild>
                <Link href={`/dashboard/leads/${action.leadId}`}>
                  Open {action.leadName ? action.leadName.split(" ")[0] : "lead"} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            {aiAvailable && (
              <Button size="sm" variant="secondary" onClick={generateDraft} disabled={generating}>
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : drafts ? (
                  <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Draft message</>
                )}
              </Button>
            )}
            {!completed ? (
              <Button size="sm" variant="ghost" onClick={markDone} disabled={completing}>
                {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Mark done</>}
              </Button>
            ) : (
              <p className="text-xs text-emerald-300 inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Nice work — done for today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftCard({ label, body }: { label: string; body: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  }
  return (
    <div className="rounded-xl bg-background/40 border border-border/50 p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" /> {label}
        </p>
        <button onClick={copy} className="text-[11px] text-[var(--gold)] hover:underline inline-flex items-center gap-1">
          {copied ? <><Check className="h-3 w-3" /> copied</> : <><Copy className="h-3 w-3" /> copy</>}
        </button>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}
