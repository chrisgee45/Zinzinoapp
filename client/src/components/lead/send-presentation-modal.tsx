import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadFirstName: string;
  onSent: () => void;
}

interface PreviewResponse {
  subject: string;
  body: string;
  alreadySentAt: string | null;
  bookingComplete: boolean;
}

// Partner-triggered closing tool from the lead detail page. Opens, fetches
// a color-aware default subject + body, lets the partner edit, then sends
// via POST /api/leads/:id/send-presentation. The send auto-pauses the warm
// bot for this lead so the human + bot don't talk over each other.
export function SendPresentationModal({ open, onOpenChange, leadId, leadFirstName, onSent }: Props) {
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api<PreviewResponse>(`/api/leads/${leadId}/send-presentation/preview`)
      .then((data) => {
        setSubject(data.subject);
        setBody(data.body);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Couldn't load draft");
      })
      .finally(() => setLoading(false));
  }, [open, leadId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      await api(`/api/leads/${leadId}/send-presentation`, {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      onSent();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send — try again");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="inline-flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[var(--gold)]" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              Closing send
            </p>
          </div>
          <DialogTitle>Send the full walkthrough to {leadFirstName}</DialogTitle>
          <DialogDescription>
            The 20-minute platform presentation. Edit anything below before sending. This pauses the auto-follow-up bot for {leadFirstName} so you can take the conversation from here.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="presentation-subject">Subject</Label>
              <Input
                id="presentation-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="presentation-body">Message</Label>
              <Textarea
                id="presentation-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={12}
                maxLength={5000}
              />
              <p className="text-[11px] text-muted-foreground/80">
                First-person, plain text. The video link is already in there. Tweak whatever doesn't sound like you.
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2 justify-end pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={sending || !subject.trim() || !body.trim()}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Send to {leadFirstName}</>}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
