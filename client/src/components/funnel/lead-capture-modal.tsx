import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useFunnel } from "@/lib/funnelContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: number;
  partnerSlug: string;
  partnerName: string;
}

export function LeadCaptureModal({ open, onOpenChange, partnerId, partnerSlug, partnerName }: Props) {
  const [, setLocation] = useLocation();
  const { setStepOne } = useFunnel();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (name.trim().length < 1 || email.trim().length < 3) {
      setError("Add your first name and email to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await api<{ id: number }>("/api/leads", {
        method: "POST",
        body: JSON.stringify({ partnerId, name: name.trim(), email: email.trim().toLowerCase() }),
      });
      setStepOne({ leadId: data.id, email: email.trim().toLowerCase(), partnerSlug });
      onOpenChange(false);
      setLocation(`/${partnerSlug}/presentation`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="bfa-pill mb-4 mx-auto sm:mx-0">
          <Sparkles className="h-3 w-3" /> Free 5-minute breakdown
        </div>
        <DialogHeader>
          <DialogTitle>See the system before you decide.</DialogTitle>
          <DialogDescription>
            Drop your name and email — {partnerName.split(" ")[0]}&apos;s breakdown unlocks on the next screen. No spam, no pressure.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">First name</Label>
            <Input
              id="lead-name"
              autoComplete="given-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock the breakdown"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground/80 uppercase tracking-wider">
            One step. No phone required.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
