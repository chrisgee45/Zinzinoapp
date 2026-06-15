import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import { ScheduleEventModal, type ReminderInput } from "@/components/calendar/schedule-modal";
import { useAuth } from "@/lib/auth";
import { api, getToken } from "@/lib/api";
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
  reminders?: ReminderInput[];
  leadId: number | null;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  leadColorCode: ColorCode | null;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Build the 6x7 grid for the month containing `anchor`. Starts on the first
// Sunday on or before the 1st, ends on the last Saturday on or after the
// last day of the month. Always 42 cells so the grid doesn't reflow per
// month.
function buildMonthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const firstWeekday = first.getDay(); // 0=Sun
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPage() {
  const { partner, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStart, setCreateDefaultStart] = useState<string | undefined>(undefined);
  const [editTarget, setEditTarget] = useState<CalendarEventRow | null>(null);

  // Fetch a window wide enough that switching ± a month doesn't re-fetch.
  const fromIso = useMemo(() => {
    const d = addMonths(startOfMonth(anchor), -1);
    return d.toISOString();
  }, [anchor]);
  const toIso = useMemo(() => {
    const d = addMonths(startOfMonth(anchor), 2);
    return d.toISOString();
  }, [anchor]);

  const eventsQuery = useQuery<{ events: CalendarEventRow[] }>({
    queryKey: ["calendar", "events", fromIso, toIso],
    queryFn: () => api(`/api/calendar/events?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`),
    enabled: !!partner,
  });

  const grid = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const events = eventsQuery.data?.events ?? [];

  // Map yyyy-mm-dd → events on that day (local time bucket).
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    for (const ev of events) {
      const d = new Date(ev.startsAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  const selectedDayEvents = useMemo(() => {
    const list = eventsByDay.get(dayKey(selected)) ?? [];
    return [...list].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [eventsByDay, selected]);

  function openCreateForDay(day: Date): void {
    // Default start time = 10am that day if it's today and now is before 10,
    // otherwise next half hour from the current time on that day.
    const start = new Date(day);
    if (isSameDay(day, new Date())) {
      const now = new Date();
      start.setHours(now.getHours(), now.getMinutes() < 30 ? 30 : 0, 0, 0);
      if (now.getMinutes() >= 30) start.setHours(start.getHours() + 1);
    } else {
      start.setHours(10, 0, 0, 0);
    }
    setCreateDefaultStart(start.toISOString());
    setCreateOpen(true);
  }

  async function patch(id: number, body: Record<string, unknown>): Promise<void> {
    await api(`/api/calendar/events/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await qc.invalidateQueries({ queryKey: ["calendar"] });
  }
  async function deleteEvent(id: number): Promise<void> {
    await api(`/api/calendar/events/${id}`, { method: "DELETE" });
    await qc.invalidateQueries({ queryKey: ["calendar"] });
  }

  if (loading) {
    return (
      <AuthShell>
        <div className="grid place-items-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
        </div>
      </AuthShell>
    );
  }

  const monthLabel = anchor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <AuthShell>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="bfa-card-strong p-5 sm:p-6 mb-5 bfa-glow flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/35 grid place-items-center shrink-0">
          <CalendarIcon className="h-5 w-5 text-[var(--gold)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="bfa-pill inline-flex">Your calendar</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 leading-tight drop-shadow-[0_2px_12px_rgba(201,168,76,0.25)]">
            <span className="text-[var(--gold)]">{monthLabel}</span>
          </h1>
        </div>
        <Button size="sm" onClick={() => openCreateForDay(selected)}>
          <Plus className="h-3.5 w-3.5" /> New event
        </Button>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAnchor(addMonths(anchor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(addMonths(anchor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAnchor(new Date()); setSelected(startOfDay(new Date())); }}>
            Today
          </Button>
        </div>
        {eventsQuery.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Grid */}
      <div className="bfa-card p-2 sm:p-3 mb-5">
        <div className="grid grid-cols-7 gap-1 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1 px-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d) => {
            const dayEvents = eventsByDay.get(dayKey(d)) ?? [];
            const inMonth = isSameMonth(d, anchor);
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selected);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelected(startOfDay(d))}
                className={cn(
                  "min-h-[64px] sm:min-h-[88px] rounded-lg p-1 sm:p-2 text-left transition",
                  "ring-1 ring-border/30",
                  inMonth ? "bg-secondary/20" : "bg-secondary/5 opacity-50",
                  isSelected && "ring-2 ring-[var(--gold)]",
                  !isSelected && "hover:ring-[var(--gold)]/40",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-[11px] sm:text-xs font-bold",
                      isToday && "inline-flex items-center justify-center h-5 w-5 rounded-full bg-[var(--gold)] text-[var(--navy)]",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const meta = ev.leadColorCode ? COLOR_META[ev.leadColorCode] : null;
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          "text-[10px] sm:text-[11px] truncate rounded px-1 py-0.5 font-semibold",
                          ev.status === "completed" && "line-through opacity-60",
                          ev.status === "cancelled" && "opacity-40 line-through",
                        )}
                        style={
                          meta
                            ? { backgroundColor: `${meta.hex}22`, color: meta.hex, boxShadow: `inset 0 0 0 1px ${meta.hex}55` }
                            : { backgroundColor: "var(--gold)", color: "var(--navy)" }
                        }
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">+ {dayEvents.length - 3} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      <div className="bfa-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold">
            {selected.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <Button size="sm" variant="secondary" onClick={() => openCreateForDay(selected)}>
            <Plus className="h-3 w-3" /> Add on this day
          </Button>
        </div>

        {selectedDayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-1 py-4 text-center">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {selectedDayEvents.map((ev) => (
              <EventRow
                key={ev.id}
                ev={ev}
                onEdit={() => setEditTarget(ev)}
                onPatch={patch}
                onDelete={deleteEvent}
              />
            ))}
          </ul>
        )}
      </div>

      <ScheduleEventModal
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setCreateDefaultStart(undefined);
        }}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["calendar"] })}
        initial={createDefaultStart ? { startsAt: createDefaultStart } : undefined}
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
            durationMinutes: Math.round(
              (new Date(editTarget.endsAt).getTime() - new Date(editTarget.startsAt).getTime()) / 60000,
            ),
            location: editTarget.location ?? undefined,
            notes: editTarget.notes,
            leadId: editTarget.leadId,
            reminders: editTarget.reminders,
          }}
        />
      )}
    </AuthShell>
  );
}

function EventRow({
  ev,
  onEdit,
  onPatch,
  onDelete,
}: {
  ev: CalendarEventRow;
  onEdit: () => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const start = new Date(ev.startsAt);
  const end = new Date(ev.endsAt);
  const isPast = start.getTime() < Date.now();
  const meta = ev.leadColorCode ? COLOR_META[ev.leadColorCode] : null;

  async function downloadIcs(): Promise<void> {
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
        "rounded-xl bg-secondary/30 ring-1 ring-border/40 p-3 sm:p-4 flex items-start gap-3",
        ev.status === "cancelled" && "opacity-50",
      )}
    >
      <div className="text-center shrink-0 w-12">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {start.toLocaleString("en-US", { hour: "numeric" })}
        </p>
        <p className="font-display text-lg font-bold leading-none mt-0.5">
          {start.toLocaleString("en-US", { minute: "2-digit", hour12: false }).split(":")[0]
            ? start.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
            : ""}
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

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}
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
          {ev.reminders && ev.reminders.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Bell className="h-3 w-3" /> {ev.reminders.length} reminder{ev.reminders.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {ev.notes && <p className="mt-1.5 text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed">{ev.notes}</p>}

        <div className="mt-2 flex flex-wrap gap-2">
          {ev.status === "scheduled" && (
            <>
              <Button size="sm" variant="secondary" onClick={onEdit}>
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
