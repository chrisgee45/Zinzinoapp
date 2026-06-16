import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Pause,
  Phone,
  Play,
  Save,
  Send,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge, LEAD_STATUSES, leadStatusTone, type LeadStatus } from "@/components/ui/badge";
import { AuthShell } from "@/components/layout/auth-shell";
import { ColorBadge, ColorPicker } from "@/components/lead/color-badge";
import { ColorScriptsModal } from "@/components/lead/color-scripts-modal";
import { SendPresentationModal } from "@/components/lead/send-presentation-modal";
import { ScheduleEventModal } from "@/components/calendar/schedule-modal";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Lead } from "@shared/schema";
import type { ColorCode } from "@shared/colorCode";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New — needs a first touch",
  qualified: "Qualified — finished the funnel",
  engaged: "Engaged — conversation in motion",
  handoff: "Handoff — wants a call",
  customer: "Customer — they're in",
  lost: "Closed — wrap it up",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const leadId = Number(id);
  const leadQuery = useQuery<{ lead: Lead }>({
    queryKey: ["lead", leadId],
    queryFn: () => api<{ lead: Lead }>(`/api/leads/${leadId}`),
    enabled: Number.isFinite(leadId) && !!partner,
  });

  if (loading || leadQuery.isPending) {
    return (
      <AuthShell>
        <div className="grid place-items-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
        </div>
      </AuthShell>
    );
  }

  if (leadQuery.isError || !leadQuery.data) {
    const notFound = leadQuery.error instanceof ApiError && leadQuery.error.status === 404;
    return (
      <AuthShell>
        <div className="bfa-card p-8 text-center max-w-md mx-auto">
          <p className="font-display text-xl mb-2">{notFound ? "Lead not found" : "Couldn't load this lead"}</p>
          <p className="text-sm text-muted-foreground mb-5">
            {notFound ? "Maybe it was deleted, or the URL is wrong." : "Try again in a moment."}
          </p>
          <Button asChild variant="secondary">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return <LeadDetailView lead={leadQuery.data.lead} onChange={() => {
    void queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  }} />;
}

function LeadDetailView({ lead, onChange }: { lead: Lead; onChange: () => void }) {
  const [, setLocation] = useLocation();
  const { partner } = useAuth();
  const [status, setStatus] = useState<LeadStatus>(lead.status as LeadStatus);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [botBusy, setBotBusy] = useState(false);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Sync from lead prop when refetched
  useEffect(() => {
    setStatus(lead.status as LeadStatus);
    setNotes(lead.notes ?? "");
  }, [lead.id, lead.status, lead.notes]);

  const firstName = lead.name.split(" ")[0] ?? lead.name;
  const created = new Date(lead.createdAt);

  async function updateStatus(next: LeadStatus) {
    const prev = status;
    setStatus(next);
    try {
      await api(`/api/leads/${lead.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      onChange();
    } catch {
      setStatus(prev);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    setNotesError(null);
    try {
      await api(`/api/leads/${lead.id}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) });
      onChange();
      setSavedNotes(true);
      window.setTimeout(() => setSavedNotes(false), 2000);
    } catch (e) {
      setNotesError(e instanceof ApiError ? e.message : "Couldn't save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function deleteLead() {
    setDeleting(true);
    try {
      await api(`/api/leads/${lead.id}`, { method: "DELETE" });
      setLocation("/dashboard");
    } catch (e) {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function toggleBot() {
    setBotBusy(true);
    try {
      const endpoint = lead.botPaused ? "bot-resume" : "bot-pause";
      await api(`/api/leads/${lead.id}/${endpoint}`, { method: "POST" });
      onChange();
    } finally {
      setBotBusy(false);
    }
  }

  async function startCold() {
    setBotBusy(true);
    try {
      await api(`/api/leads/${lead.id}/start-cold`, { method: "POST" });
      onChange();
    } finally {
      setBotBusy(false);
    }
  }

  // Last-write-wins override. Same endpoint the funnel button calls; the lead
  // is partner-scoped via the dashboard query so the partner can only ever
  // see their own leads here. Fires onChange so the badge re-renders.
  async function setColor(color: ColorCode) {
    const prev = lead.colorCode;
    if (prev === color) return;
    try {
      await api(`/api/leads/${lead.id}/color`, {
        method: "PATCH",
        body: JSON.stringify({ colorCode: color }),
      });
      onChange();
    } catch {
      /* silently revert by letting onChange re-fetch */
      onChange();
    }
  }

  return (
    <AuthShell>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to all leads
      </Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="bfa-card-strong p-6 sm:p-7 mb-5 bfa-animate-in">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/35 grid place-items-center font-display text-xl text-[var(--gold)] shrink-0">
                {lead.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("") || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">{lead.name}</h1>
                  <Badge tone={leadStatusTone(status)}>{status}</Badge>
                  <ColorBadge color={lead.colorCode as ColorCode | null} variant="chip" />
                  {lead.botPaused && <Badge tone="muted">Bot paused</Badge>}
                </div>
                <div className="mt-2 grid sm:grid-cols-2 gap-1 text-sm text-muted-foreground">
                  <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <Mail className="h-3.5 w-3.5" /> {lead.email}
                  </a>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                      <Phone className="h-3.5 w-3.5" /> {lead.phone}
                    </a>
                  )}
                  <p className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> First touch {created.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {(lead.colorCode || lead.interest || lead.timeline || lead.whatPulledIn || (lead.submissionCount ?? 1) > 1) && (
            <div className="bfa-card-strong p-5 sm:p-6 mb-5 bfa-glow">
              <p className="bfa-pill inline-flex">Pre-call intel</p>
              {lead.colorCode && (
                <div className="mt-3 space-y-3">
                  <ColorBadge color={lead.colorCode as ColorCode} variant="full" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setScriptsOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    How to talk to {firstName}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="mt-3 space-y-3">
                {(lead.submissionCount ?? 1) > 1 && (
                  <p className="text-base">
                    Return pattern:{" "}
                    <span className="font-semibold text-[var(--gold)]">{firstName} has entered their email {lead.submissionCount} times</span>{" "}
                    on the squeeze page without booking the call. They keep coming back.
                  </p>
                )}
                {lead.whatPulledIn && (
                  <p className="text-base">
                    What pulled them in:{" "}
                    <span className="font-semibold text-foreground">&ldquo;{lead.whatPulledIn}&rdquo;</span>
                  </p>
                )}
                {lead.interest && (
                  <p className="text-base">
                    On the post-submit screen, <span className="font-semibold text-foreground">{firstName}</span> tapped{" "}
                    <span className="font-semibold text-[var(--gold)]">
                      {lead.interest === "products" ? "the science & products side" : "the income & freedom side"}
                    </span>
                    .
                  </p>
                )}
                {lead.timeline && (
                  <p className="text-base">
                    Timeline: <span className="font-semibold text-[var(--gold)]">{timelineLabel(lead.timeline)}</span>
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {lead.timeline === "now"
                  ? `${firstName} is ready to move, don't waste the warmth. Same-day call beats a scheduled one.`
                  : lead.interest
                    ? "Lead with that angle. The other side becomes the bonus that closes them."
                    : "Use what you've got to set the angle on the first call."}
              </p>
            </div>
          )}

          <div className="bfa-card p-5 sm:p-7 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-[var(--gold)]" />
              <h2 className="font-display text-lg font-bold">What they told you</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Fact icon={Briefcase} label="Current work" value={lead.currentWork} fallback={`${firstName} didn't finish the funnel form`} />
              <Fact icon={Target} label="Where they're heading (2-5 yr)" value={lead.futureVision} fallback="—" />
              <Fact icon={Clock} label="Best time to connect" value={lead.bestTime} fallback="—" />
            </div>
          </div>

          <div className="bfa-card p-5 sm:p-7 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-bold inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[var(--gold)]" /> Your notes
              </h2>
              {savedNotes && <span className="text-xs text-emerald-300">Saved</span>}
            </div>
            <Textarea
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you talk about? What's their why? What do they need to hear next?"
            />
            {notesError && (
              <p className="mt-2 text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {notesError}
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save notes</>}
              </Button>
            </div>
          </div>

          <ConversationErrorBoundary>
            <ConversationCard leadId={lead.id} firstName={firstName} />
          </ConversationErrorBoundary>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bfa-card p-5">
            <Label className="mb-2 inline-block">Status</Label>
            <Select value={status} onChange={(e) => void updateStatus(e.target.value as LeadStatus)}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </div>

          <div className="bfa-card p-5">
            <Label className="mb-2 inline-block">Color</Label>
            <ColorPicker
              current={lead.colorCode as ColorCode | null}
              onChange={(c) => void setColor(c)}
            />
            <p className="text-[11px] text-muted-foreground/80 mt-3 leading-relaxed">
              {lead.colorCode
                ? "Self-sorted from the funnel. Tap a different one to correct it."
                : "Not picked yet. Tap one to tag this lead manually."}
            </p>
          </div>

          <div className="bfa-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Quick actions</p>
            <div className="space-y-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-start"
                onClick={() => setScheduleOpen(true)}
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Schedule a call
              </Button>
              {lead.phone && (
                <Button variant="secondary" size="sm" className="w-full justify-start" asChild>
                  <a href={`tel:${lead.phone}`}><Phone className="h-3.5 w-3.5" /> Call {firstName}</a>
                </Button>
              )}
              <Button variant="secondary" size="sm" className="w-full justify-start" asChild>
                <a href={`mailto:${lead.email}`}><Mail className="h-3.5 w-3.5" /> Email {firstName}</a>
              </Button>
              {lead.phone && (
                <Button variant="secondary" size="sm" className="w-full justify-start" asChild>
                  <a href={`sms:${lead.phone}`}><MessageCircle className="h-3.5 w-3.5" /> Text {firstName}</a>
                </Button>
              )}
            </div>
          </div>

          {/* Send-presentation closing tool (§9B / Phase F). Only meaningful
              after the lead has finished the booking form — that's when it's
              a partner-driven closing move, not an automated outreach. */}
          {lead.detailsSubmittedAt && (
            <div className="bfa-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Closing</p>
              {lead.presentationSentAt ? (
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Presentation sent
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    Sent {new Date(lead.presentationSentAt).toLocaleString()}. The auto-follow-up bot is paused for {firstName} so you can run the close yourself. Resume below if you want it back on.
                  </p>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setPresentationOpen(true)}
                  >
                    <Send className="h-3.5 w-3.5" /> Send the full walkthrough
                  </Button>
                  <p className="text-[11px] text-muted-foreground/80 mt-2 leading-relaxed">
                    The 20-minute platform presentation, in your voice. Pauses the bot for {firstName} on send.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="bfa-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Auto-follow-up</p>

            {/* Current track state, one liner. */}
            {(() => {
              if (lead.botPaused) {
                return (
                  <p className="text-sm text-muted-foreground mb-3">
                    Bot is paused for {firstName}.
                  </p>
                );
              }
              if (lead.detailsSubmittedAt) {
                return (
                  <p className="text-sm text-muted-foreground mb-3">
                    Warm campaign is running.
                  </p>
                );
              }
              if (lead.coldStartedAt) {
                return (
                  <p className="text-sm text-muted-foreground mb-3">
                    Cold outreach started {new Date(lead.coldStartedAt).toLocaleDateString()}.
                  </p>
                );
              }
              return (
                <p className="text-sm text-muted-foreground mb-3">
                  No automated touches yet.
                </p>
              );
            })()}

            {/* Cold outreach opt-in: only relevant before booking, before
                cold, and only for active leads. Becomes the primary CTA
                when applicable. */}
            {!lead.detailsSubmittedAt &&
              !lead.coldStartedAt &&
              status !== "customer" &&
              status !== "lost" && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-start mb-2"
                  disabled={botBusy}
                  onClick={startCold}
                >
                  {botBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Start cold outreach</>
                  )}
                </Button>
              )}

            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              disabled={botBusy}
              onClick={toggleBot}
            >
              {botBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : lead.botPaused ? (
                <><Play className="h-3.5 w-3.5" /> Resume bot</>
              ) : (
                <><Pause className="h-3.5 w-3.5" /> Pause bot for this lead</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              {!lead.detailsSubmittedAt && !lead.coldStartedAt
                ? `Cold outreach is a 4-touch gentle drip over 21 days for ${firstName}. First touch lands ~15 minutes after you start so you can cancel if you misclick.`
                : "Pause stops all upcoming auto-follow-ups for this lead. Resume picks the campaign back up from where it left off."}
            </p>
          </div>

          <div className="bfa-card border-destructive/30 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-destructive-foreground/80 mb-3">Danger zone</p>
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs">Permanent — can&apos;t be undone.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={deleteLead} disabled={deleting} className="flex-1">
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, delete"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full justify-start text-destructive-foreground/90" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete lead
              </Button>
            )}
          </div>
        </div>
      </div>

      {lead.colorCode && partner && (
        <ColorScriptsModal
          open={scriptsOpen}
          onOpenChange={setScriptsOpen}
          color={lead.colorCode as ColorCode}
          leadFirstName={firstName}
          partnerFirstName={partner.name.split(" ")[0] ?? partner.name}
        />
      )}

      <SendPresentationModal
        open={presentationOpen}
        onOpenChange={setPresentationOpen}
        leadId={lead.id}
        leadFirstName={firstName}
        onSent={() => {
          onChange();
        }}
      />

      <ScheduleEventModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSaved={() => onChange()}
        leadId={lead.id}
        leadName={lead.name}
        leadBestTime={lead.bestTime}
      />
    </AuthShell>
  );
}

interface BotEmailRow {
  id: number;
  touchNumber: number;
  leadType: string; // 'warm' | 'stall' | 'cold' | 'reply' | 'presentation'
  subject: string;
  body: string;
  status: string;
  sentAt: string;
}
interface LeadReplyRow {
  id: number;
  fromEmail: string;
  subject: string | null;
  body: string;
  receivedAt: string;
}
type ThreadEntry =
  | { kind: "out"; at: string; row: BotEmailRow }
  | { kind: "in"; at: string; row: LeadReplyRow };

function ConversationCard({ leadId, firstName }: { leadId: number; firstName: string }) {
  const emailsQuery = useQuery<{ emails: BotEmailRow[] }>({
    queryKey: ["lead", leadId, "bot-emails"],
    queryFn: () => api(`/api/leads/${leadId}/bot-emails`),
    refetchInterval: 60_000, // pick up new bot sends without a manual reload
  });
  const repliesQuery = useQuery<{ replies: LeadReplyRow[] }>({
    queryKey: ["lead", leadId, "replies"],
    queryFn: () => api(`/api/leads/${leadId}/replies`),
    refetchInterval: 60_000,
  });

  const emails = emailsQuery.data?.emails ?? [];
  const replies = repliesQuery.data?.replies ?? [];

  // Merge outbound + inbound into a single chronological thread. Defensive
  // against missing timestamps so a single malformed row can't crash the
  // sort (NaN return on getTime would still complete, but unstable order).
  const thread = useMemo<ThreadEntry[]>(() => {
    const out: ThreadEntry[] = emails
      .filter((row) => row && typeof row.id === "number")
      .map((row) => ({ kind: "out", at: row.sentAt ?? "", row }));
    const inc: ThreadEntry[] = replies
      .filter((row) => row && typeof row.id === "number")
      .map((row) => ({ kind: "in", at: row.receivedAt ?? "", row }));
    return [...out, ...inc].sort((a, b) => {
      const at = new Date(a.at).getTime();
      const bt = new Date(b.at).getTime();
      return (Number.isFinite(at) ? at : 0) - (Number.isFinite(bt) ? bt : 0);
    });
  }, [emails, replies]);

  const loading = emailsQuery.isPending || repliesQuery.isPending;

  return (
    <div className="bfa-card p-5 sm:p-7 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-bold inline-flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[var(--gold)]" /> Conversation
        </h2>
        {thread.length > 0 && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {thread.length} {thread.length === 1 ? "message" : "messages"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
        </div>
      ) : thread.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No bot follow-ups or replies on this lead yet.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
            When the auto-follow-up engine sends, or when {firstName} replies, the thread shows up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {thread.map((entry, idx) => (
            <ThreadBubble key={`${entry.kind}-${entry.row.id}-${idx}`} entry={entry} firstName={firstName} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ThreadBubble({ entry, firstName }: { entry: ThreadEntry; firstName: string }) {
  const [expanded, setExpanded] = useState(false);
  const isOut = entry.kind === "out";
  const at = new Date(entry.at);
  const stamp = at.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (isOut) {
    const row = entry.row;
    const status = row.status ?? "";
    const failed = !status.startsWith("sent");
    const subject = row.subject ?? "";
    const body = row.body ?? "";
    const isLong = body.length > 280;
    const visibleBody = expanded ? body : body.slice(0, 280);
    const label = typeLabel(row.leadType ?? "", row.touchNumber ?? 0);
    return (
      <li
        className={cn(
          "rounded-2xl p-3.5 sm:p-4 max-w-[92%]",
          "ml-auto",
          failed
            ? "bg-amber-500/10 ring-1 ring-amber-500/30"
            : "bg-[var(--gold)]/10 ring-1 ring-[var(--gold)]/30",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] mb-1">
          <span className={cn("font-semibold", failed ? "text-amber-300" : "text-[var(--gold)]")}>
            You · {label}
          </span>
          <span className="text-muted-foreground/80">· {stamp}</span>
          {failed && <span className="text-amber-300">· not sent</span>}
        </div>
        {subject && <p className="font-semibold text-sm mb-1">{subject}</p>}
        {body ? (
          <>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {visibleBody}
              {isLong && !expanded && "…"}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 text-[11px] font-semibold text-[var(--gold)] hover:underline"
              >
                {expanded ? "Show less" : "Show full message"}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs italic text-muted-foreground">(empty body)</p>
        )}
        {failed && (
          <p className="text-[11px] text-amber-300/90 mt-1.5 leading-relaxed">
            Delivery problem: {status.replace(/^error:/, "")}
          </p>
        )}
      </li>
    );
  }

  // inbound reply
  const row = entry.row;
  const body = row.body ?? "";
  const subject = row.subject ?? "";
  const isLong = body.length > 280;
  const visibleBody = expanded ? body : body.slice(0, 280);
  return (
    <li className="rounded-2xl p-3.5 sm:p-4 max-w-[92%] mr-auto bg-secondary/40 ring-1 ring-border/50">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] mb-1">
        <span className="font-semibold text-foreground/80">{firstName} replied</span>
        <span className="text-muted-foreground/80">· {stamp}</span>
      </div>
      {subject && <p className="font-semibold text-sm mb-1">Re: {subject}</p>}
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
        {visibleBody}
        {isLong && !expanded && "…"}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] font-semibold text-[var(--gold)] hover:underline"
        >
          {expanded ? "Show less" : "Show full message"}
        </button>
      )}
    </li>
  );
}

// Class component because React error boundaries require componentDidCatch,
// which functional components can't implement. Scoped narrowly around the
// ConversationCard so a render bug in the thread can't blank the entire
// lead detail page — every other section above (intel, schedule, notes,
// status, color) keeps working even if the conversation render throws.
class ConversationErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[conversation] render crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="bfa-card p-5 sm:p-7 mb-5">
          <h2 className="font-display text-lg font-bold inline-flex items-center gap-2 mb-3">
            <MessageCircle className="h-4 w-4 text-[var(--gold)]" /> Conversation
          </h2>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold text-amber-300">Couldn't render the conversation thread.</p>
            <p className="text-foreground/80 mt-1 leading-relaxed">
              The bot history is in your database — this is just a UI hiccup. Refresh the page or try again in a minute. If it sticks, share the lead id and we'll look at the row.
            </p>
            <p className="text-[11px] text-foreground/55 mt-2 font-mono">{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function typeLabel(leadType: string, touchNumber: number): string {
  switch (leadType) {
    case "warm":
      return `Warm touch ${touchNumber}`;
    case "stall":
      return `Stall nudge ${touchNumber}`;
    case "cold":
      return `Cold touch ${touchNumber}`;
    case "presentation":
      return "Sent presentation";
    case "reply":
      return "Auto-reply";
    default:
      return leadType;
  }
}

function timelineLabel(t: string): string {
  if (t === "now") return "Ready to move now";
  if (t === "soon") return "1–3 months out";
  if (t === "researching") return "Just researching";
  return t;
}

function Fact({
  icon: Icon,
  label,
  value,
  fallback,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string | null | undefined;
  fallback: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className={value ? "text-sm mt-1.5" : "text-sm mt-1.5 text-muted-foreground italic"}>
        {value || fallback}
      </p>
    </div>
  );
}
