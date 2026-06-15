import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar, Loader2, MapPin, Plus, Trash2, User, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Lead } from "@shared/schema";

export interface ReminderInput {
  minutesBefore: number;
  channel: "email" | "push";
}

const DEFAULT_REMINDERS: ReminderInput[] = [
  { minutesBefore: 24 * 60, channel: "email" },
  { minutesBefore: 24 * 60, channel: "push" },
  { minutesBefore: 60, channel: "email" },
  { minutesBefore: 60, channel: "push" },
  { minutesBefore: 15, channel: "push" },
];

// Common presets the user can pick from when adding a reminder. Order matters
// (descending — furthest from event first).
const REMINDER_PRESETS: Array<{ label: string; minutesBefore: number }> = [
  { label: "1 week", minutesBefore: 7 * 24 * 60 },
  { label: "3 days", minutesBefore: 3 * 24 * 60 },
  { label: "1 day", minutesBefore: 24 * 60 },
  { label: "4 hours", minutesBefore: 4 * 60 },
  { label: "1 hour", minutesBefore: 60 },
  { label: "30 minutes", minutesBefore: 30 },
  { label: "15 minutes", minutesBefore: 15 },
  { label: "5 minutes", minutesBefore: 5 },
  { label: "At start", minutesBefore: 0 },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  // Pre-fill when scheduling from a specific lead
  leadId?: number;
  leadName?: string;
  leadBestTime?: string | null;
  // Existing event for the edit case
  eventId?: number;
  initial?: {
    title?: string;
    startsAt?: string;
    durationMinutes?: number;
    location?: string;
    notes?: string;
    leadId?: number | null;
    reminders?: ReminderInput[];
  };
}

function toLocalInputValue(input?: string | Date | null): string {
  const d = input instanceof Date ? input : input ? new Date(input) : roundUpNext30();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function roundUpNext30(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  const min = d.getMinutes();
  const next = min < 30 ? 30 : 60;
  d.setMinutes(next, 0, 0);
  return d;
}

function reminderKey(r: ReminderInput): string {
  return `${r.minutesBefore}-${r.channel}`;
}

function formatReminder(minutesBefore: number, channel: "email" | "push"): string {
  const preset = REMINDER_PRESETS.find((p) => p.minutesBefore === minutesBefore);
  const time = preset?.label ?? `${minutesBefore} min`;
  const ch = channel === "email" ? "Email" : "Push";
  if (minutesBefore === 0) return `${ch} at start`;
  return `${ch} ${time} before`;
}

export function ScheduleEventModal({
  open,
  onOpenChange,
  onSaved,
  leadId: lockedLeadId,
  leadName,
  leadBestTime,
  eventId,
  initial,
}: Props) {
  const isEdit = Boolean(eventId);
  const isLeadLocked = Boolean(lockedLeadId);

  const [title, setTitle] = useState(initial?.title ?? (leadName ? `Call with ${leadName.split(" ")[0]}` : ""));
  const [startsAtLocal, setStartsAtLocal] = useState(toLocalInputValue(initial?.startsAt));
  const [duration, setDuration] = useState<number>(initial?.durationMinutes ?? 30);
  const [location, setLocation] = useState(initial?.location ?? "Phone");
  const [notes, setNotes] = useState(initial?.notes ?? (leadBestTime ? `Best time they mentioned: ${leadBestTime}` : ""));
  const [reminders, setReminders] = useState<ReminderInput[]>(initial?.reminders ?? DEFAULT_REMINDERS);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(
    lockedLeadId ?? initial?.leadId ?? null,
  );
  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadList, setShowLeadList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the partner's lead list for the picker. Only when needed (the
  // picker is closed by default and only opens if the partner taps the
  // "Tie to a lead" row).
  const leadsQuery = useQuery<{ leads: Lead[] }>({
    queryKey: ["leads"],
    queryFn: () => api("/api/leads"),
    enabled: open && !isLeadLocked,
    staleTime: 30_000,
  });

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    if (lockedLeadId === selectedLeadId && leadName) {
      return { id: selectedLeadId, name: leadName } as Pick<Lead, "id" | "name">;
    }
    return leadsQuery.data?.leads.find((l) => l.id === selectedLeadId) ?? null;
  }, [selectedLeadId, lockedLeadId, leadName, leadsQuery.data]);

  const filteredLeads = useMemo(() => {
    const all = leadsQuery.data?.leads ?? [];
    if (!leadSearch.trim()) return all.slice(0, 20);
    const needle = leadSearch.trim().toLowerCase();
    return all
      .filter((l) => l.name.toLowerCase().includes(needle) || l.email.toLowerCase().includes(needle))
      .slice(0, 20);
  }, [leadsQuery.data, leadSearch]);

  // Reset when the modal opens for a different target
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? (leadName ? `Call with ${leadName.split(" ")[0]}` : ""));
    setStartsAtLocal(toLocalInputValue(initial?.startsAt));
    setDuration(initial?.durationMinutes ?? 30);
    setLocation(initial?.location ?? "Phone");
    setNotes(initial?.notes ?? (leadBestTime ? `Best time they mentioned: ${leadBestTime}` : ""));
    setReminders(initial?.reminders ?? DEFAULT_REMINDERS);
    setSelectedLeadId(lockedLeadId ?? initial?.leadId ?? null);
    setLeadSearch("");
    setShowLeadList(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockedLeadId, eventId]);

  function addReminder(minutesBefore: number, channel: "email" | "push"): void {
    if (reminders.some((r) => r.minutesBefore === minutesBefore && r.channel === channel)) return;
    setReminders((prev) => [...prev, { minutesBefore, channel }].sort((a, b) => b.minutesBefore - a.minutesBefore));
  }
  function removeReminder(idx: number): void {
    setReminders((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!title.trim() || !startsAtLocal) {
      setError("Title and date are required.");
      return;
    }
    setSubmitting(true);
    try {
      const startsAt = new Date(startsAtLocal).toISOString();
      const body = {
        title: title.trim(),
        startsAt,
        durationMinutes: duration,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        leadId: selectedLeadId ?? null,
        reminders: reminders.map((r) => ({ minutesBefore: r.minutesBefore, channel: r.channel })),
      };
      if (isEdit && eventId) {
        await api(`/api/calendar/events/${eventId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/api/calendar/events", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Couldn't save event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="inline-flex items-center gap-2 mb-1">
            <Calendar className="h-3.5 w-3.5 text-[var(--gold)]" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              {isEdit ? "Reschedule" : "New event"}
            </p>
          </div>
          <DialogTitle>
            {isEdit
              ? "Edit this commitment"
              : leadName
                ? `Schedule with ${leadName.split(" ")[0]}`
                : "Add to your calendar"}
          </DialogTitle>
          <DialogDescription>
            Pick your reminder times. Each one fires email, push, or both. Tie this to a lead and the reminder includes their contact info so you can call without flipping back to the CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="evt-title">What is it?</Label>
            <Input
              id="evt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call with Pat / Team training / Block off morning"
              required
              maxLength={200}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evt-start">When</Label>
              <Input
                id="evt-start"
                type="datetime-local"
                value={startsAtLocal}
                onChange={(e) => setStartsAtLocal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-duration">How long</Label>
              <select
                id="evt-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-12 w-full rounded-xl border bg-input/60 px-4 text-base text-foreground outline-none"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evt-location">Where</Label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--gold)]/70" />
              <Input
                id="evt-location"
                className="pl-11"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Phone / Zoom URL / Coffee shop"
                maxLength={500}
              />
            </div>
          </div>

          {/* Lead tie-in */}
          <div className="space-y-1.5">
            <Label>Tie to a lead</Label>
            {isLeadLocked ? (
              <div className="bfa-card flex items-center gap-2 px-3 py-2.5">
                <User className="h-4 w-4 text-[var(--gold)]/70" />
                <span className="text-sm">{leadName ?? "Linked"}</span>
              </div>
            ) : selectedLead ? (
              <div className="bfa-card flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-[var(--gold)]/70" />
                  {selectedLead.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLeadId(null);
                    setShowLeadList(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>
            ) : !showLeadList ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowLeadList(true)}>
                <User className="h-3.5 w-3.5" /> Pick a lead
              </Button>
            ) : (
              <div className="bfa-card p-2 space-y-2">
                <Input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  autoFocus
                />
                <ul className="max-h-48 overflow-y-auto divide-y divide-border/30">
                  {leadsQuery.isPending ? (
                    <li className="text-sm text-muted-foreground italic px-2 py-3 text-center">Loading leads…</li>
                  ) : filteredLeads.length === 0 ? (
                    <li className="text-sm text-muted-foreground italic px-2 py-3 text-center">
                      {leadSearch ? "Nothing matches that search." : "No leads in your pipeline yet."}
                    </li>
                  ) : (
                    filteredLeads.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeadId(l.id);
                            setShowLeadList(false);
                            setLeadSearch("");
                            // Pre-fill the title if blank
                            if (!title.trim()) setTitle(`Call with ${l.name.split(" ")[0]}`);
                            if (!notes.trim() && l.bestTime) setNotes(`Best time they mentioned: ${l.bestTime}`);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-secondary/40 rounded-md"
                        >
                          <p className="text-sm font-semibold truncate">{l.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{l.email}</p>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowLeadList(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Reminders */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-[var(--gold)]" />
              <Label>Reminders</Label>
            </div>
            {reminders.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No reminders set. Add one below.</p>
            ) : (
              <ul className="space-y-1.5">
                {reminders.map((r, idx) => (
                  <li
                    key={`${reminderKey(r)}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 ring-1 ring-border/40 px-3 py-2"
                  >
                    <span className="text-sm">{formatReminder(r.minutesBefore, r.channel)}</span>
                    <button
                      type="button"
                      onClick={() => removeReminder(idx)}
                      className="text-xs text-muted-foreground hover:text-destructive-foreground inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <AddReminderRow onAdd={addReminder} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evt-notes">Notes</Label>
            <Textarea
              id="evt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What do you want to remember going in?"
              rows={3}
              maxLength={5000}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEdit ? "Save changes" : "Schedule it"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddReminderRow({ onAdd }: { onAdd: (minutesBefore: number, channel: "email" | "push") => void }) {
  const [picking, setPicking] = useState(false);
  const [pickedMinutes, setPickedMinutes] = useState<number>(60);
  const [pickedChannel, setPickedChannel] = useState<"email" | "push">("push");

  if (!picking) {
    return (
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="text-xs text-[var(--gold)] hover:underline inline-flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> Add reminder
      </button>
    );
  }

  return (
    <div className="rounded-lg ring-1 ring-border/40 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={pickedMinutes}
          onChange={(e) => setPickedMinutes(Number(e.target.value))}
          className="h-10 w-full rounded-lg border bg-input/60 px-3 text-sm text-foreground outline-none"
        >
          {REMINDER_PRESETS.map((p) => (
            <option key={p.minutesBefore} value={p.minutesBefore}>
              {p.label === "At start" ? "At start" : `${p.label} before`}
            </option>
          ))}
        </select>
        <select
          value={pickedChannel}
          onChange={(e) => setPickedChannel(e.target.value as "email" | "push")}
          className="h-10 w-full rounded-lg border bg-input/60 px-3 text-sm text-foreground outline-none"
        >
          <option value="push">Push notification</option>
          <option value="email">Email</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPicking(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            onAdd(pickedMinutes, pickedChannel);
            setPicking(false);
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
