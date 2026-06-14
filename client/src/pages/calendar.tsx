import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthShell } from "@/components/layout/auth-shell";
import { ScheduleEventModal } from "@/components/calendar/schedule-modal";
import { useAuth } from "@/lib/auth";
import { api, ApiError, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { COLOR_META, type ColorCode } from "@shared/colorCode";

interface CalendarEventRow {
  id: number;
  title: string;
  notes: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "completed" | "cancelled";
  leadId: number | null;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  leadColorCode: ColorCode | null;
}

export default function CalendarPage() {
  const { partner, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const eventsQuery = useQuery<{ events: CalendarEventRow[] }>({
    queryKey: ["calendar", "events"],
    queryFn: () => {
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      return api(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    },
    enabled: !!partner,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CalendarEventRow | null>(null);

  const events = eventsQuery.data?.events ?? [];

  // Bucket: today, this week, later, past. Sort each by startsAt asc.
  const buckets = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfNextWeek = new Date(startOfToday);
    startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

    const today: CalendarEventRow[] = [];
    const thisWeek: CalendarEventRow[] = [];
    const later: CalendarEventRow[] = [];
    const past: CalendarEventRow[] = [];

    for (const ev of events) {
      const start = new Date(ev.startsAt);
      if (ev.status === "scheduled" && start < startOfToday) past.push(ev);
      else if (start < startOfToday) past.push(ev);
      else if (start < startOfTomorrow) today.push(ev);
      else if (start < startOfNextWeek) thisWeek.push(ev);
      else later.push(ev);
    }
    return { today, thisWeek, later, past };
  }, [events]);

  async function patch(id: number, body: Record<string, unknown>) {
    await api(`/api/calendar/events/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await qc.invalidateQueries({ queryKey: ["calendar"] });
  }
  async function deleteEvent(id: number) {
    await api(`/api/calendar/events/${id}`, { method: "DELETE" });
    await qc.invalidateQueries({ queryKey: ["calendar"] });
  }

  if (loading || eventsQuery.isPending) {
    return (
      <AuthShell>
        <div className="grid place-items-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      <div className="bfa-card-strong p-6 sm:p-7 mb-6 bfa-glow">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/35 grid place-items-center shrink-0">
            <CalendarIcon className="h-5 w-5 text-[var(--gold)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="bfa-pill inline-flex">Your calendar</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 leading-tight drop-shadow-[0_2px_12px_rgba(201,168,76,0.25)]">
              What's on your <span className="text-[var(--gold)]">plate</span>?
            </h1>
            <p className="text-sm text-foreground/80 mt-2 leading-relaxed max-w-xl">
              Every commitment gets email + push reminders so you can stop juggling apps. Tap any event to reschedule, mark done, or download an ICS to your phone's calendar.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New event
          </Button>
        </div>
      </div>

      <SectionList label="Today" events={buckets.today} onEdit={setEditTarget} onPatch={patch} onDelete={deleteEvent} emphasis />
      <SectionList label="This week" events={buckets.thisWeek} onEdit={setEditTarget} onPatch={patch} onDelete={deleteEvent} />
      <SectionList label="Later" events={buckets.later} onEdit={setEditTarget} onPatch={patch} onDelete={deleteEvent} />
      {buckets.past.length > 0 && (
        <SectionList label="Past" events={buckets.past} onEdit={setEditTarget} onPatch={patch} onDelete={deleteEvent} dim />
      )}

      {buckets.today.length === 0 && buckets.thisWeek.length === 0 && buckets.later.length === 0 && (
        <div className="bfa-card p-8 text-center">
          <CalendarIcon className="h-8 w-8 text-[var(--gold)]/60 mx-auto mb-3" />
          <p className="font-display text-lg mb-1">Nothing on the calendar yet.</p>
          <p className="text-sm text-muted-foreground mb-4">Schedule your next call so the day shapes itself.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add the first one
          </Button>
        </div>
      )}

      <ScheduleEventModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["calendar"] })}
      />
      {editTarget && (
        <ScheduleEventModal
          open={Boolean(editTarget)}
          onOpenChange={(o) => !o && setEditTarget(null)}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["calendar"] })}
          eventId={editTarget.id}
          leadId={editTarget.leadId ?? undefined}
          leadName={editTarget.leadName ?? undefined}
          initial={{
            title: editTarget.title,
            startsAt: editTarget.startsAt,
            durationMinutes: Math.round((new Date(editTarget.endsAt).getTime() - new Date(editTarget.startsAt).getTime()) / 60000),
            location: editTarget.location ?? undefined,
            notes: editTarget.notes,
          }}
        />
      )}
    </AuthShell>
  );
}

function SectionList({
  label,
  events,
  onEdit,
  onPatch,
  onDelete,
  emphasis,
  dim,
}: {
  label: string;
  events: CalendarEventRow[];
  onEdit: (e: CalendarEventRow) => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  emphasis?: boolean;
  dim?: boolean;
}) {
  if (events.length === 0 && !emphasis) return null;
  return (
    <section className={cn("mb-6", dim && "opacity-70")}>
      <h2 className="font-display text-lg font-bold mb-3 inline-flex items-center gap-2">
        {label}
        <span className="text-xs text-muted-foreground font-normal">({events.length})</span>
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-1">Nothing here. Yet.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRow key={ev.id} ev={ev} onEdit={onEdit} onPatch={onPatch} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EventRow({
  ev,
  onEdit,
  onPatch,
  onDelete,
}: {
  ev: CalendarEventRow;
  onEdit: (e: CalendarEventRow) => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const start = new Date(ev.startsAt);
  const end = new Date(ev.endsAt);
  const isPast = start.getTime() < Date.now();
  const meta = ev.leadColorCode ? COLOR_META[ev.leadColorCode] : null;

  async function downloadIcs() {
    const token = getToken();
    const res = await fetch(`/api/calendar/events/${ev.id}/ics`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-${ev.id}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <li
      className={cn(
        "bfa-card p-4 sm:p-5 flex items-start gap-4",
        ev.status === "cancelled" && "opacity-50",
      )}
    >
      <div className="text-center shrink-0 w-14">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {start.toLocaleString("en-US", { month: "short" })}
        </p>
        <p className="font-display text-2xl font-bold leading-none">
          {start.toLocaleString("en-US", { day: "numeric" })}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("font-semibold", ev.status === "completed" && "line-through")}>{ev.title}</p>
          {ev.status === "completed" && <Badge tone="customer">Done</Badge>}
          {ev.status === "cancelled" && <Badge tone="muted">Cancelled</Badge>}
          {meta && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: `${meta.hex}1f`,
                color: meta.hex,
                boxShadow: `inset 0 0 0 1px ${meta.hex}55`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.hex }} />
              {meta.label.split(" ")[0]}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {start.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
            {" → "}
            {end.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {ev.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {ev.location}
            </span>
          )}
          {ev.leadId && ev.leadName && (
            <Link href={`/dashboard/leads/${ev.leadId}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <User className="h-3 w-3" /> {ev.leadName}
            </Link>
          )}
        </div>

        {ev.notes && <p className="mt-2 text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed">{ev.notes}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {ev.status === "scheduled" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => onEdit(ev)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              {!isPast && (
                <Button size="sm" variant="ghost" onClick={() => void onPatch(ev.id, { status: "completed" })}>
                  <CheckCircle2 className="h-3 w-3" /> Mark done
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => void onPatch(ev.id, { status: "cancelled" })}>
                <XCircle className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void downloadIcs()}>
                <Download className="h-3 w-3" /> ICS
              </Button>
            </>
          )}
          {ev.status !== "scheduled" && (
            <Button size="sm" variant="ghost" onClick={() => void onDelete(ev.id)} className="text-destructive-foreground/80">
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
