import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { trackLead } from "@/lib/tracking";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: number;
  partnerFirstName: string;
}

export function ExitIntentModal({ open, onOpenChange, partnerId, partnerFirstName }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const derivedName = cleanEmail.split("@")[0]?.slice(0, 30) || "Guest";
      await api("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          partnerId,
          name: derivedName,
          email: cleanEmail,
        }),
      });
      trackLead();
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {submitted ? (
          <div className="text-center py-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/15 grid place-items-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            </div>
            <h2 className="font-display text-2xl font-bold">Saved.</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              {partnerFirstName} will follow up with the link so you can come back when it&apos;s a better time.
            </p>
            <Button variant="secondary" size="sm" className="mt-5" onClick={() => onOpenChange(false)}>
              Got it
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Wait — save it for later?</DialogTitle>
              <DialogDescription>
                Drop your email and {partnerFirstName} will text you the link so you can watch the 5-minute breakdown when it&apos;s a better time. No pitch, no spam.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="exit-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                  <Input
                    id="exit-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    required
                    className="pl-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send me the link"}
              </Button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="block w-full text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground transition"
              >
                No thanks, I&apos;ll skip it
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
