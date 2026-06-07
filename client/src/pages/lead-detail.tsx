import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Pause,
  Phone,
  Play,
  Save,
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
  const [status, setStatus] = useState<LeadStatus>(lead.status as LeadStatus);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [botBusy, setBotBusy] = useState(false);

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

          {(lead.colorCode || lead.interest || lead.timeline || lead.whatPulledIn) && (
            <div className="bfa-card-strong p-5 sm:p-6 mb-5 bfa-glow">
              <p className="bfa-pill inline-flex">Pre-call intel</p>
              {lead.colorCode && (
                <div className="mt-3">
                  <ColorBadge color={lead.colorCode as ColorCode} variant="full" />
                </div>
              )}
              <div className="mt-3 space-y-3">
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

          <div className="bfa-card p-5 sm:p-7 mb-5">
            <h2 className="font-display text-lg font-bold inline-flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-[var(--gold)]" /> Conversation
            </h2>
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Auto-follow-up emails + replies show here.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">Activates in Milestone 2.</p>
            </div>
          </div>
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
              {lead.phone && (
                <Button variant="primary" size="sm" className="w-full justify-start" asChild>
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

          <div className="bfa-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Auto-follow-up</p>
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
                <><Play className="h-3.5 w-3.5" /> Resume bot when M2 launches</>
              ) : (
                <><Pause className="h-3.5 w-3.5" /> Pause bot for this lead</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Bot doesn&apos;t send yet — but your pause/resume preference is saved and will respect this when M2 ships.
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
    </AuthShell>
  );
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
