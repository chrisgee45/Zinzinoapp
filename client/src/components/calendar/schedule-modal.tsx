import { useEffect, useState, type FormEvent } from "react";
import { Calendar, Loader2, MapPin } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  // Optional pre-fill when scheduling from a specific lead.
  leadId?: number;
  leadName?: string;
  leadBestTime?: string | null;
  // Existing event for the edit case. When set, modal becomes "Reschedule".
  eventId?: number;
  initial?: {
    title?: string;
    startsAt?: string; // ISO
    durationMinutes?: number;
    location?: string;
    notes?: string;
  };
}

// Converts an ISO string into the value format <input type="datetime-local">
// expects: YYYY-MM-DDTHH:mm in the user's local time. Falls back to
// rounding "now" up to the next 30-minute mark when no initial value is
// provided so the partner doesn't have to type anything.
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

export function ScheduleEventModal({
  open,
  onOpenChange,
  onSaved,
  leadId,
  leadName,
  leadBestTime,
  eventId,
  initial,
}: Props) {
  const isEdit = Boolean(eventId);

  const [title, setTitle] = useState(initial?.title ?? (leadName ? `Call with ${leadName.split(" ")[0]}` : ""));
  const [startsAtLocal, setStartsAtLocal] = useState(toLocalInputValue(initial?.startsAt));
  const [duration, setDuration] = useState<number>(initial?.durationMinutes ?? 30);
  const [location, setLocation] = useState(initial?.location ?? "Phone");
  const [notes, setNotes] = useState(initial?.notes ?? (leadBestTime ? `Best time they mentioned: ${leadBestTime}` : ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when reopening for a different lead / event.
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? (leadName ? `Call with ${leadName.split(" ")[0]}` : ""));
    setStartsAtLocal(toLocalInputValue(initial?.startsAt));
    setDuration(initial?.durationMinutes ?? 30);
    setLocation(initial?.location ?? "Phone");
    setNotes(initial?.notes ?? (leadBestTime ? `Best time they mentioned: ${leadBestTime}` : ""));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId, eventId]);

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
        leadId: leadId,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="inline-flex items-center gap-2 mb-1">
            <Calendar className="h-3.5 w-3.5 text-[var(--gold)]" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              {isEdit ? "Reschedule" : "Schedule"}
            </p>
          </div>
          <DialogTitle>{isEdit ? "Reschedule this commitment" : leadName ? `Schedule with ${leadName.split(" ")[0]}` : "Add a calendar block"}</DialogTitle>
          <DialogDescription>
            Reminders fire automatically: an email 24h and 1h before, push notifications 24h, 1h, and 15 minutes before. The bot stays out of the way once this is on the calendar.
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

          <div className="space-y-1.5">
            <Label htmlFor="evt-notes">Notes</Label>
            <Textarea
              id="evt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What do you want to remember going in?"
              rows={4}
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
