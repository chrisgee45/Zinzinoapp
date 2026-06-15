import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Square,
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

type ViewMode = "month" | "week" | "day" | "agenda";

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

// ────────────────────────── date utils ──────────────────────────
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfWeek(d: Date): Date {
  const sd = startOfDay(d);
  sd.setDate(sd.getDate() - sd.getDay()); // Sunday
  return sd;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function buildMonthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  return days;
}
function buildWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const VIEW_STORAGE_KEY = "bfa_calendar_view";

export default function CalendarPage() {
  const { partner, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "month";
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null;
    return stored && ["month", "week", "day", "agenda"].includes(stored) ? stored : "month";
  });
  useEffect(() => {
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* noop */ }
  }, [view]);

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStart, setCreateDefaultStart] = useState<string | undefined>(undefined);
  const [editTarget, setEditTarget] = useState<CalendarEventRow | null>(null);

  // Fetch a generous window so navigation rarely refetches.
  const fromIso = useMemo(() => addMonths(startOfMonth(anchor), -1).toISOString(), [anchor]);
  const toIso = useMemo(() => addMonths(startOfMonth(anchor), 2).toISOString(), [anchor]);

  const eventsQuery = useQuery<{ events: CalendarEventRow[] }>({
    queryKey: ["calendar", "events", fromIso, toIso],
    queryFn: () => api(`/api/calendar/events?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`),
    enabled: !!partner,
  });

  const events = eventsQuery.data?.events ?? [];

  // Map yyyy-m-d → sorted events. Used by every view.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    for (const ev of events) {
      const d = new Date(ev.startsAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [events]);

  function navigate(direction: -1 | 1): void {
    if (view === "month") setAnchor(addMonths(anchor, direction));
    else if (view === "week") setAnchor(addDays(anchor, direction * 7));
    else if (view === "day") {
      const next = addDays(selected, direction);
      setSelected(next);
      setAnchor(next);
    } else {
      // agenda: jump by 14 days
      setAnchor(addDays(anchor, direction * 14));
    }
  }

  function goToday(): void {
    const now = new Date();
    setAnchor(now);
    setSelected(startOfDay(now));
  }

  function openCreateForDay(day: Date, hourHint?: number): void {
    const start = new Date(day);
    if (hourHint !== undefined) {
      start.setHours(hourHint, 0, 0, 0);
    } else if (isSameDay(day, new Date())) {
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

  // Header label depends on view
  const headerLabel = (() => {
    if (view === "month") return anchor.toLocaleString("en-US", { month: "long", year: "numeric" });
    if (view === "week") {
      const days = buildWeekDays(anchor);
      const first = days[0];
      const last = days[6];
      const sameMonth = first.getMonth() === last.getMonth();
      const monthFmt = (d: Date) => d.toLocaleString("en-US", { month: "short" });
      return sameMonth
        ? `${monthFmt(first)} ${first.getDate()}–${last.getDate()}, ${last.getFullYear()}`
        : `${monthFmt(first)} ${first.getDate()} – ${monthFmt(last)} ${last.getDate()}, ${last.getFullYear()}`;
    }
    if (view === "day") return selected.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return "Agenda";
  })();

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
            <span className="text-[var(--gold)]">{headerLabel}</span>
          </h1>
        </div>
        <Button size="sm" onClick={() => openCreateForDay(selected)}>
          <Plus className="h-3.5 w-3.5" /> New event
        </Button>
      </div>

      {/* Nav + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="inline-flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={goToday}>Today</Button>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {/* View body */}
      {view === "month" && (
        <MonthView
          anchor={anchor}
          selected={selected}
          eventsByDay={eventsByDay}
          onSelectDay={(d) => setSelected(d)}
          onOpenDay={(d) => { setSelected(d); setView("day"); }}
          onAddOnDay={openCreateForDay}
          onEdit={setEditTarget}
          onPatch={patch}
          onDelete={deleteEvent}
        />
      )}
      {view === "week" && (
        <WeekView
          anchor={anchor}
          eventsByDay={eventsByDay}
          onOpenDay={(d) => { setSelected(d); setView("day"); }}
          onAddOnDay={openCreateForDay}
          onEdit={setEditTarget}
        />
      )}
      {view === "day" && (
        <DayView
          day={selected}
          events={eventsByDay.get(dayKey(selected)) ?? []}
          onAdd={(hr) => openCreateForDay(selected, hr)}
          onEdit={setEditTarget}
          onPatch={patch}
          onDelete={deleteEvent}
        />
      )}
      {view === "agenda" && (
        <AgendaView
          anchor={anchor}
          eventsByDay={eventsByDay}
          onEdit={setEditTarget}
          onPatch={patch}
          onDelete={deleteEvent}
        />
      )}

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
            durationMinutes: Math.round((new Date(editTarget.endsAt).getTime() - new Date(editTarget.startsAt).getTime()) / 60000),
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

// ────────────────────────── view toggle ──────────────────────────
function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const items: Array<{ id: ViewMode; label: string; icon: typeof CalendarIcon }> = [
    { id: "month", label: "Month", icon: LayoutGrid },
    { id: "week", label: "Week", icon: CalendarDays },
    { id: "day", label: "Day", icon: Square },
    { id: "agenda", label: "Agenda", icon: List },
  ];
  return (
    <div className="inline-flex rounded-full ring-1 ring-border/60 bg-secondary/30 p-1">
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold transition",
              active ? "bg-[var(--gold)] text-[var(--navy)]" : "text-foreground/70 hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────── month view ──────────────────────────
function MonthView({
  anchor,
  selected,
  eventsByDay,
  onSelectDay,
  onOpenDay,
  onAddOnDay,
  onEdit,
  onPatch,
  onDelete,
}: {
  anchor: Date;
  selected: Date;
  eventsByDay: Map<string, CalendarEventRow[]>;
  onSelectDay: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  onAddOnDay: (d: Date) => void;
  onEdit: (ev: CalendarEventRow) => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const grid = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const today = new Date();
  const selectedDayEvents = eventsByDay.get(dayKey(selected)) ?? [];

  return (
    <>
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
                onClick={() => onSelectDay(startOfDay(d))}
                onDoubleClick={() => onOpenDay(startOfDay(d))}
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
                  {dayEvents.slice(0, 3).map((ev) => (
                    <EventChip key={ev.id} ev={ev} />
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">+ {dayEvents.length - 3} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bfa-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold">
            {selected.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <Button size="sm" variant="secondary" onClick={() => onAddOnDay(selected)}>
            <Plus className="h-3 w-3" /> Add on this day
          </Button>
        </div>
        {selectedDayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-1 py-4 text-center">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {selectedDayEvents.map((ev) => (
              <EventRow key={ev.id} ev={ev} onEdit={() => onEdit(ev)} onPatch={onPatch} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ────────────────────────── week view ──────────────────────────
function WeekView({
  anchor,
  eventsByDay,
  onOpenDay,
  onAddOnDay,
  onEdit,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEventRow[]>;
  onOpenDay: (d: Date) => void;
  onAddOnDay: (d: Date) => void;
  onEdit: (ev: CalendarEventRow) => void;
}) {
  const days = useMemo(() => buildWeekDays(anchor), [anchor]);
  const today = new Date();
  return (
    <div className="bfa-card p-2 sm:p-3">
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const dayEvents = eventsByDay.get(dayKey(d)) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="min-h-[260px] sm:min-h-[320px] flex flex-col">
              <button
                type="button"
                onClick={() => onOpenDay(startOfDay(d))}
                className="text-left mb-2 px-1.5 py-1 rounded-lg hover:bg-secondary/30 transition"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {d.toLocaleString("en-US", { weekday: "short" })}
                </p>
                <p
                  className={cn(
                    "font-display text-lg font-bold",
                    isToday && "inline-flex items-center justify-center h-7 w-7 rounded-full bg-[var(--gold)] text-[var(--navy)]",
                  )}
                >
                  {d.getDate()}
                </p>
              </button>
              <div className="flex-1 space-y-1.5 px-0.5">
                {dayEvents.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAddOnDay(d)}
                    className="w-full text-[10px] text-muted-foreground/60 italic hover:text-foreground border border-dashed border-border/40 rounded-md py-2"
                  >
                    + Add
                  </button>
                ) : (
                  dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onEdit(ev)}
                      className="w-full text-left"
                    >
                      <EventBlock ev={ev} />
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────── day view ──────────────────────────
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22; // 10pm
const HOUR_HEIGHT = 56; // px

function DayView({
  day,
  events,
  onAdd,
  onEdit,
  onPatch,
  onDelete,
}: {
  day: Date;
  events: CalendarEventRow[];
  onAdd: (hour: number) => void;
  onEdit: (ev: CalendarEventRow) => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i),
    [],
  );

  // Sort events into:
  //   - timeline events (within visible 6am-10pm window)
  //   - all-day or out-of-range events (listed above the timeline)
  const { timeline, outOfRange } = useMemo(() => {
    const tl: CalendarEventRow[] = [];
    const oor: CalendarEventRow[] = [];
    for (const ev of events) {
      const start = new Date(ev.startsAt);
      if (start.getHours() >= DAY_START_HOUR && start.getHours() < DAY_END_HOUR) tl.push(ev);
      else oor.push(ev);
    }
    return { timeline: tl, outOfRange: oor };
  }, [events]);

  function topFor(start: Date): number {
    const hr = start.getHours() + start.getMinutes() / 60;
    return (hr - DAY_START_HOUR) * HOUR_HEIGHT;
  }
  function heightFor(start: Date, end: Date): number {
    const mins = (end.getTime() - start.getTime()) / 60000;
    return Math.max(28, (mins / 60) * HOUR_HEIGHT - 2);
  }

  const now = new Date();
  const showNowLine = isSameDay(now, day) && now.getHours() >= DAY_START_HOUR && now.getHours() < DAY_END_HOUR;
  const nowTop = showNowLine ? topFor(now) : 0;

  return (
    <>
      {outOfRange.length > 0 && (
        <div className="bfa-card p-4 mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Outside visible hours</p>
          <ul className="space-y-2">
            {outOfRange.map((ev) => (
              <EventRow key={ev.id} ev={ev} onEdit={() => onEdit(ev)} onPatch={onPatch} onDelete={onDelete} />
            ))}
          </ul>
        </div>
      )}

      <div className="bfa-card p-2 sm:p-3 overflow-hidden">
        <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Hour grid */}
          {hours.map((h, idx) => (
            <button
              key={h}
              type="button"
              onClick={() => onAdd(h)}
              className="absolute left-0 right-0 border-t border-border/30 hover:bg-secondary/20 transition group"
              style={{ top: idx * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="absolute left-2 top-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {new Date(2000, 0, 1, h).toLocaleString("en-US", { hour: "numeric", hour12: true })}
              </span>
              <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                + add
              </span>
            </button>
          ))}

          {/* Now line */}
          {showNowLine && (
            <div
              className="absolute left-0 right-0 h-px bg-[var(--gold)] z-10"
              style={{ top: nowTop, boxShadow: "0 0 0 1px rgba(201,168,76,0.4)" }}
            >
              <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-[var(--gold)]" />
            </div>
          )}

          {/* Events */}
          {timeline.map((ev) => {
            const start = new Date(ev.startsAt);
            const end = new Date(ev.endsAt);
            const meta = ev.leadColorCode ? COLOR_META[ev.leadColorCode] : null;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onEdit(ev)}
                className={cn(
                  "absolute left-14 right-2 rounded-lg text-left px-2.5 py-1.5 shadow-sm transition hover:scale-[1.005]",
                  ev.status === "cancelled" && "opacity-40 line-through",
                )}
                style={{
                  top: topFor(start),
                  height: heightFor(start, end),
                  backgroundColor: meta ? `${meta.hex}22` : "var(--gold)",
                  color: meta ? meta.hex : "var(--navy)",
                  boxShadow: meta ? `inset 0 0 0 1px ${meta.hex}77` : "inset 0 0 0 1px rgba(0,0,0,0.2)",
                }}
              >
                <p className="text-xs font-bold truncate">{ev.title}</p>
                <p className="text-[10px] opacity-90 truncate">
                  {start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}
                  {" – "}
                  {end.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}
                  {ev.leadName ? ` · ${ev.leadName}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ────────────────────────── agenda view ──────────────────────────
function AgendaView({
  anchor,
  eventsByDay,
  onEdit,
  onPatch,
  onDelete,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEventRow[]>;
  onEdit: (ev: CalendarEventRow) => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  // Show 30 days starting from anchor.
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(startOfDay(anchor), i)), [anchor]);
  const withEvents = days.filter((d) => (eventsByDay.get(dayKey(d)) ?? []).length > 0);

  if (withEvents.length === 0) {
    return (
      <div className="bfa-card p-8 text-center">
        <CalendarIcon className="h-8 w-8 text-[var(--gold)]/60 mx-auto mb-3" />
        <p className="font-display text-lg mb-1">Nothing on the agenda for the next 30 days.</p>
        <p className="text-sm text-muted-foreground">Tap New event up top to add the first commitment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {withEvents.map((d) => {
        const list = eventsByDay.get(dayKey(d)) ?? [];
        return (
          <section key={d.toISOString()}>
            <h2 className="font-display text-lg font-bold mb-2">
              {d.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            <ul className="space-y-2">
              {list.map((ev) => (
                <EventRow key={ev.id} ev={ev} onEdit={() => onEdit(ev)} onPatch={onPatch} onDelete={onDelete} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ────────────────────────── shared bits ──────────────────────────
function EventChip({ ev }: { ev: CalendarEventRow }) {
  const meta = ev.leadColorCode ? COLOR_META[ev.leadColorCode] : null;
  return (
    <div
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
}

function EventBlock({ ev }: { ev: CalendarEventRow }) {
  const start = new Date(ev.startsAt);
  const meta = ev.leadColorCode ? COLOR_META[ev.leadColorCode] : null;
  return (
    <div
      className={cn(
        "rounded-md p-1.5 transition",
        ev.status === "completed" && "opacity-60 line-through",
        ev.status === "cancelled" && "opacity-40 line-through",
      )}
      style={
        meta
          ? { backgroundColor: `${meta.hex}22`, color: meta.hex, boxShadow: `inset 0 0 0 1px ${meta.hex}55` }
          : { backgroundColor: "var(--gold)", color: "var(--navy)" }
      }
    >
      <p className="text-[10px] sm:text-xs font-bold truncate">{ev.title}</p>
      <p className="text-[9px] sm:text-[10px] opacity-90 truncate">
        {start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}
        {ev.leadName ? ` · ${ev.leadName}` : ""}
      </p>
    </div>
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
          {start.toLocaleString("en-US", { hour: "numeric", hour12: true }).replace(/\s/g, "")}
        </p>
        <p className="font-display text-base font-bold leading-none mt-0.5">
          {start.toLocaleString("en-US", { minute: "2-digit" })}
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
