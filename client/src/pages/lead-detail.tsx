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

  // Derive a single urgency hint for the header pill. Real data only —
  // never invents. Order matters: the most actionable signal wins.
  const urgency = (() => {
    const ageMs = Date.now() - created.getTime();
    const DAY = 24 * 60 * 60 * 1000;
    if (status === "handoff") {
      return { tone: "success" as const, label: "Wants a call", body: "Get this on the calendar today." };
    }
    if (status === "engaged") {
      return { tone: "success" as const, label: "Conversation in motion", body: "Keep the back-and-forth going." };
    }
    if (status === "customer") {
      return { tone: "success" as const, label: "Customer", body: "They're in. Move them to the next thing." };
    }
    if (lead.detailsSubmittedAt && !lead.presentationSentAt) {
      return { tone: "accent" as const, label: "Booked the call", body: "Run the presentation when you're together." };
    }
    if (status === "new" && ageMs > DAY) {
      const days = Math.max(1, Math.floor(ageMs / DAY));
      return { tone: "warning" as const, label: "Follow-up due", body: `Untouched for ${days} day${days === 1 ? "" : "s"}.` };
    }
    if (status === "new" && ageMs <= DAY) {
      return { tone: "accent" as const, label: "Fresh lead", body: "Be the first response in their inbox." };
    }
    return null;
  })();

  const URGENCY_TONE: Record<"success" | "warning" | "accent", { color: string; bg: string; rule: string }> = {
    success: { color: "var(--success)", bg: "rgba(34,197,94,0.10)", rule: "var(--success)" },
    warning: { color: "var(--warning)", bg: "rgba(245,158,11,0.10)", rule: "var(--warning)" },
    accent: { color: "var(--gold)", bg: "rgba(212,175,55,0.10)", rule: "var(--gold)" },
  };

  return (
    <AuthShell>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4 transition">
        <ArrowLeft className="h-3 w-3" /> Back to all leads
      </Link>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 lg:gap-6">
        <div className="min-w-0">
          {/* ── Dossier header ────────────────────────────────────────── */}
          <article className="bfa-card-strong p-5 sm:p-7 mb-4 sm:mb-5 bfa-animate-in relative overflow-hidden">
            {urgency && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: URGENCY_TONE[urgency.tone].rule }}
              />
            )}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
              <div
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl grid place-items-center font-display text-xl sm:text-2xl shrink-0"
                style={{
                  background: "color-mix(in oklab, var(--gold) 14%, transparent)",
                  color: "var(--gold)",
                  border: "1px solid var(--border-gold)",
                  boxShadow: "inset 0 1px 0 0 rgb(var(--overlay-rgb) / 0.06)",
                }}
              >
                {lead.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="bfa-eyebrow">Sales dossier</p>
                <h1 className="font-display text-[22px] sm:text-[28px] font-bold leading-tight mt-1 truncate">
                  {lead.name}
                </h1>
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <Badge tone={leadStatusTone(status)}>{status}</Badge>
                  <ColorBadge color={lead.colorCode as ColorCode | null} variant="chip" />
                  {lead.botPaused && <Badge tone="muted">Bot paused</Badge>}
                  {urgency && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        background: URGENCY_TONE[urgency.tone].bg,
                        border: `1px solid ${URGENCY_TONE[urgency.tone].color}40`,
                        color: URGENCY_TONE[urgency.tone].color,
                      }}
                    >
                      {urgency.label}
                    </span>
                  )}
                </div>
                {urgency && (
                  <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">{urgency.body}</p>
                )}
              </div>
            </div>

            {/* Contact + first-touch row — bottom of header, more
                refined than the original 2-col grid. */}
            <div
              className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t grid grid-cols-1 sm:grid-cols-3 gap-3"
              style={{ borderColor: "var(--border-muted)" }}
            >
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition min-w-0"
              >
                <Mail className="h-3.5 w-3.5 text-[var(--gold)] shrink-0" />
                <span className="truncate">{lead.email}</span>
              </a>
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition"
                >
                  <Phone className="h-3.5 w-3.5 text-[var(--gold)] shrink-0" />
                  {lead.phone}
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground/60 italic">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> No phone on file
                </span>
              )}
              <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-[var(--gold)] shrink-0" />
                First touch {created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </article>

          {/* ── Pre-call intel ───────────────────────────────────────── */}
          {(lead.colorCode || lead.interest || lead.timeline || lead.whatPulledIn || (lead.submissionCount ?? 1) > 1) && (
            <article className="bfa-card-strong bfa-glow p-5 sm:p-6 mb-4 sm:mb-5 relative overflow-hidden">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: "var(--gold)" }}
              />
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                  <h2 className="font-display text-lg font-bold">Pre-call intel</h2>
                </div>
                <span className="bfa-eyebrow hidden sm:block">Your battle plan</span>
              </div>

              {/* Top: color tag + a primary "How to talk to them" CTA. */}
              {lead.colorCode && (
                <div
                  className="bfa-card-flat p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between"
                >
                  <div className="min-w-0">
                    <p className="bfa-eyebrow mb-1.5">Color tag</p>
                    <ColorBadge color={lead.colorCode as ColorCode} variant="full" />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setScriptsOpen(true)}
                    className="shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    How to talk to {firstName}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Structured intel rows — each one is real-data-only and
                  renders only when populated. */}
              <ul className="space-y-2.5">
                {(lead.submissionCount ?? 1) > 1 && (
                  <IntelRow
                    label="Return pattern"
                    accent={`${lead.submissionCount} squeeze submissions`}
                    body={`${firstName} keeps coming back without booking the call. They're on the edge.`}
                  />
                )}
                {lead.whatPulledIn && (
                  <IntelRow
                    label="What pulled them in"
                    accent={`"${lead.whatPulledIn}"`}
                    body={null}
                  />
                )}
                {lead.interest && (
                  <IntelRow
                    label="Their tap"
                    accent={lead.interest === "products" ? "Science & products side" : "Income & freedom side"}
                    body={`Lead with that angle. The other side becomes the bonus that closes ${firstName}.`}
                  />
                )}
                {lead.timeline && (
                  <IntelRow
                    label="Timeline"
                    accent={timelineLabel(lead.timeline)}
                    body={lead.timeline === "now"
                      ? `${firstName} is ready to move. Same-day call beats a scheduled one.`
                      : null}
                  />
                )}
              </ul>
            </article>
          )}

          {/* ── What they told you ───────────────────────────────────── */}
          <article className="bfa-card p-5 sm:p-6 mb-4 sm:mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-[var(--gold)]" />
              <h2 className="font-display text-lg font-bold">What they told you</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Fact icon={Briefcase} label="Current work" value={lead.currentWork} fallback={`${firstName} didn't finish the funnel form`} />
              <Fact icon={Target} label="Where they're heading" value={lead.futureVision} fallback="—" />
              <Fact icon={Clock} label="Best time to connect" value={lead.bestTime} fallback="—" />
            </div>
          </article>

          {/* ── Your notes ───────────────────────────────────────────── */}
          <article className="bfa-card p-5 sm:p-6 mb-4 sm:mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-bold inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[var(--gold)]" /> Your notes
              </h2>
              {savedNotes && (
                <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--success)" }}>
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
            <Textarea
              rows={5}
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
          </article>

          <ConversationErrorBoundary>
            <ConversationCard leadId={lead.id} firstName={firstName} />
          </ConversationErrorBoundary>
        </div>

        {/* ── Right rail: command surface ───────────────────────────── */}
        <aside className="space-y-3 sm:space-y-4">
          {/* Quick actions live first — schedule is the primary action,
              everything else is one tap. */}
          <RailCard label="Quick actions">
            <Button
              variant="primary"
              size="sm"
              className="w-full justify-start"
              onClick={() => setScheduleOpen(true)}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Schedule a call
            </Button>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {lead.phone ? (
                <RailIconButton href={`tel:${lead.phone}`} icon={<Phone className="h-4 w-4" />} label="Call" />
              ) : (
                <RailIconButton disabled icon={<Phone className="h-4 w-4" />} label="Call" />
              )}
              <RailIconButton href={`mailto:${lead.email}`} icon={<Mail className="h-4 w-4" />} label="Email" />
              {lead.phone ? (
                <RailIconButton href={`sms:${lead.phone}`} icon={<MessageCircle className="h-4 w-4" />} label="Text" />
              ) : (
                <RailIconButton disabled icon={<MessageCircle className="h-4 w-4" />} label="Text" />
              )}
            </div>
          </RailCard>

          <RailCard label="Status">
            <Select value={status} onChange={(e) => void updateStatus(e.target.value as LeadStatus)}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </RailCard>

          <RailCard label="Color">
            <ColorPicker
              current={lead.colorCode as ColorCode | null}
              onChange={(c) => void setColor(c)}
            />
            <p className="text-[11px] text-muted-foreground/80 mt-3 leading-relaxed">
              {lead.colorCode
                ? "Self-sorted from the funnel. Tap a different one to correct it."
                : "Not picked yet. Tap one to tag this lead manually."}
            </p>
          </RailCard>

          {lead.detailsSubmittedAt && (
            <RailCard label="Closing">
              {lead.presentationSentAt ? (
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--gold)" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Presentation sent
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    Sent {new Date(lead.presentationSentAt).toLocaleString()}. The auto-follow-up bot is paused for {firstName} so you can run the close yourself.
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
                    <Send className="h-3.5 w-3.5" /> Send the walkthrough
                  </Button>
                  <p className="text-[11px] text-muted-foreground/80 mt-2 leading-relaxed">
                    The 20-minute platform presentation, in your voice. Pauses the bot for {firstName} on send.
                  </p>
                </>
              )}
            </RailCard>
          )}

          <RailCard label="Auto-follow-up">
            <BotStateLine
              botPaused={lead.botPaused}
              detailsSubmittedAt={lead.detailsSubmittedAt}
              coldStartedAt={lead.coldStartedAt}
              firstName={firstName}
            />
            {!lead.detailsSubmittedAt &&
              !lead.coldStartedAt &&
              status !== "customer" &&
              status !== "lost" && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-start mt-3 mb-2"
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
              className="w-full justify-start mt-2"
              disabled={botBusy}
              onClick={toggleBot}
            >
              {botBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : lead.botPaused ? (
                <><Play className="h-3.5 w-3.5" /> Resume bot</>
              ) : (
                <><Pause className="h-3.5 w-3.5" /> Pause for this lead</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              {!lead.detailsSubmittedAt && !lead.coldStartedAt
                ? `Cold outreach is a 4-touch gentle drip over 21 days. First touch lands ~15 min after you start.`
                : "Pause stops upcoming touches. Resume picks up from where it left off."}
            </p>
          </RailCard>

          <article
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(239,68,68,0.25)",
              background: "color-mix(in oklab, var(--surface-1) 92%, transparent)",
            }}
          >
            <p className="bfa-eyebrow mb-3" style={{ color: "rgba(239,68,68,0.85)" }}>Danger zone</p>
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
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete lead
              </Button>
            )}
          </article>
        </aside>
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
    <article className="bfa-card p-5 sm:p-6 mb-4 sm:mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold inline-flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[var(--gold)]" /> Conversation
        </h2>
        {thread.length > 0 && (
          <span className="bfa-eyebrow tabular-nums">
            {thread.length} {thread.length === 1 ? "message" : "messages"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
        </div>
      ) : thread.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-6 text-center"
          style={{ borderColor: "var(--border-muted)" }}
        >
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
    </article>
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
        className="rounded-2xl p-3.5 sm:p-4 max-w-[92%] ml-auto border"
        style={{
          background: failed ? "rgba(245,158,11,0.08)" : "color-mix(in oklab, var(--gold) 7%, var(--surface-2))",
          borderColor: failed ? "rgba(245,158,11,0.30)" : "var(--border-gold)",
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: failed ? "var(--warning)" : "var(--gold)" }}
          >
            You · {label}
          </span>
          <span className="text-[10px] text-muted-foreground/80 uppercase tracking-[0.18em]">· {stamp}</span>
          {failed && (
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--warning)" }}>
              · not sent
            </span>
          )}
        </div>
        {subject && <p className="font-semibold text-[14px] mb-1.5">{subject}</p>}
        {body ? (
          <>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-foreground/90">
              {visibleBody}
              {isLong && !expanded && "…"}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 text-[11px] font-semibold text-[var(--gold)] hover:text-[var(--gold-soft)] transition"
              >
                {expanded ? "Show less" : "Show full message"}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs italic text-muted-foreground">(empty body)</p>
        )}
        {failed && (
          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--warning)" }}>
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
    <li
      className="rounded-2xl p-3.5 sm:p-4 max-w-[92%] mr-auto border"
      style={{
        background: "color-mix(in oklab, var(--success) 5%, var(--surface-2))",
        borderColor: "color-mix(in oklab, var(--success) 30%, var(--border-muted))",
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--success)" }}
        >
          {firstName} replied
        </span>
        <span className="text-[10px] text-muted-foreground/80 uppercase tracking-[0.18em]">· {stamp}</span>
      </div>
      {subject && <p className="font-semibold text-[14px] mb-1.5">Re: {subject}</p>}
      <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-foreground/90">
        {visibleBody}
        {isLong && !expanded && "…"}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] font-semibold text-[var(--gold)] hover:text-[var(--gold-soft)] transition"
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
    <div className="bfa-card-flat p-3.5 min-w-0">
      <p className="bfa-eyebrow inline-flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className={value ? "text-sm mt-1.5 leading-relaxed" : "text-sm mt-1.5 text-muted-foreground italic"}>
        {value || fallback}
      </p>
    </div>
  );
}

// IntelRow — one row inside the Pre-call Intel card. Label on the left,
// gold-accented value on the right with optional sub-copy.
function IntelRow({
  label,
  accent,
  body,
}: {
  label: string;
  accent: string;
  body: string | null;
}) {
  return (
    <li className="bfa-card-flat px-3.5 py-3">
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 items-start">
        <span className="bfa-eyebrow pt-0.5">{label}</span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--gold)] leading-snug break-words">{accent}</p>
          {body && (
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{body}</p>
          )}
        </div>
      </div>
    </li>
  );
}

// RailCard — uniform card for the right rail sections. Cuts the
// repetitive `<div className="bfa-card p-5"><p className="text-xs…">…`
// boilerplate from five places into one component.
function RailCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <article className="bfa-card p-4 sm:p-5">
      <p className="bfa-eyebrow mb-3">{label}</p>
      <div>{children}</div>
    </article>
  );
}

// RailIconButton — square tile button for the rail's quick action row.
// Single icon over a tiny label, gold tint on hover/focus, disabled
// state for when phone isn't on file.
function RailIconButton({
  href,
  icon,
  label,
  disabled,
}: {
  href?: string;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const className =
    "flex flex-col items-center justify-center gap-1 rounded-xl border h-16 text-[10px] font-semibold uppercase tracking-wider transition";
  const style: React.CSSProperties = {
    borderColor: "var(--border-muted)",
    background: "color-mix(in oklab, var(--surface-2) 70%, transparent)",
    color: disabled ? "rgb(148 163 184 / 0.45)" : "rgb(148 163 184)",
  };
  if (disabled || !href) {
    return (
      <div className={className} style={style} aria-disabled="true">
        {icon}
        {label}
      </div>
    );
  }
  return (
    <a
      href={href}
      className={`${className} hover:!text-[var(--gold)] hover:!border-[var(--border-gold)]`}
      style={style}
    >
      {icon}
      {label}
    </a>
  );
}

// One-liner describing where the auto-follow-up engine is for this lead.
// Pulled out so the rail body stays focused on the actions; reading the
// state stays a single, scannable sentence.
function BotStateLine({
  botPaused,
  detailsSubmittedAt,
  coldStartedAt,
  firstName,
}: {
  botPaused: boolean;
  detailsSubmittedAt: Date | string | null;
  coldStartedAt: Date | string | null;
  firstName: string;
}) {
  if (botPaused) {
    return (
      <p className="text-[13px] text-muted-foreground inline-flex items-center gap-1.5">
        <Pause className="h-3 w-3" /> Bot is paused for {firstName}.
      </p>
    );
  }
  if (detailsSubmittedAt) {
    return (
      <p className="text-[13px] text-muted-foreground inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
        Warm campaign is running.
      </p>
    );
  }
  if (coldStartedAt) {
    return (
      <p className="text-[13px] text-muted-foreground inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--cyan)" }} />
        Cold outreach started {new Date(coldStartedAt).toLocaleDateString()}.
      </p>
    );
  }
  return (
    <p className="text-[13px] text-muted-foreground italic">No automated touches yet.</p>
  );
}
