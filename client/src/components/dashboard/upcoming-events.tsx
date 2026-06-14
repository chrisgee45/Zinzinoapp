import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, CalendarPlus, Clock, MapPin } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleEventModal } from "@/components/calendar/schedule-modal";
import { api } from "@/lib/api";
import type { ColorCode } from "@shared/colorCode";
import { COLOR_META } from "@shared/colorCode";

interface UpcomingEvent {
  id: number;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  status: "scheduled" | "completed" | "cancelled";
  leadId: number | null;
  leadName: string | null;
  leadColorCode: ColorCode | null;
}

// Sidebar widget on /dashboard. Lists the next 5 scheduled events in the
// week ahead with click-throughs to the calendar page or the linked lead.
export function UpcomingEventsCard() {
  const [createOpen, setCreateOpen] = useState(false);
  const q = useQuery<{ events: UpcomingEvent[] }>({
    queryKey: ["calendar", "upcoming"],
    queryFn: () => api("/api/calendar/events/upcoming"),
  });

  const events = q.data?.events ?? [];
  const next5 = events.slice(0, 5);

  return (
    <>
      <div className="bfa-card p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--gold)]" />
            <h2 className="font-display text-lg font-bold">Up next</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>

        {q.isPending ? (
          <p className="text-sm text-muted-foreground italic">Loading…</p>
        ) : next5.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
            <p className="text-sm text-muted-foreground">No upcoming events in the next 7 days.</p>
            <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Schedule something
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {next5.map((ev) => (
              <UpcomingEventRow key={ev.id} ev={ev} />
            ))}
          </ul>
        )}

        <Link
          href="/calendar"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] hover:underline"
        >
          Open full calendar <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ScheduleEventModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => void q.refetch()}
      />
    </>
  );
}

function UpcomingEventRow({ ev }: { ev: UpcomingEvent }) {
  const start = new Date(ev.startsAt);
  const meta = ev.leadColorCode ? COLOR_META[ev.leadColorCode] : null;
  return (
    <li className="rounded-xl bg-secondary/40 ring-1 ring-border/40 p-3 flex items-start gap-3">
      <div className="text-center shrink-0 w-12">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {start.toLocaleString("en-US", { weekday: "short" })}
        </p>
        <p className="font-display text-lg font-bold leading-none mt-0.5">
          {start.toLocaleString("en-US", { day: "numeric" })}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-semibold text-sm truncate">{ev.title}</p>
          {meta && (
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.hex, boxShadow: `0 0 0 3px ${meta.hex}22` }}
              title={meta.label}
            />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {ev.location && (
            <span className="inline-flex items-center gap-1 truncate max-w-[16ch]">
              <MapPin className="h-2.5 w-2.5" /> {ev.location}
            </span>
          )}
          {ev.leadId && ev.leadName && (
            <Link href={`/dashboard/leads/${ev.leadId}`} className="inline-flex items-center gap-1 hover:text-foreground">
              {ev.leadName}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
