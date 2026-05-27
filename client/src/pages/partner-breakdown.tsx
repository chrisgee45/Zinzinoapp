import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Lock, Phone } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFunnel } from "@/lib/funnelContext";
import type { PublicPartner } from "@shared/schema";

// TODO: source from siteContent table per-partner so each partner can swap in
// their own deeper-breakdown video.
const FULL_VIDEO_ID = "YvEULrrTdCw";

export default function PartnerBreakdown() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const funnel = useFunnel();

  const partnerQuery = useQuery<PublicPartner>({
    queryKey: ["partner", slug],
    queryFn: () => api<PublicPartner>(`/api/partner/${slug}`),
    enabled: !!slug,
  });

  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!funnel.leadId || funnel.partnerSlug !== slug) {
        setRedirecting(true);
        setLocation(`/${slug}`);
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [funnel.leadId, funnel.partnerSlug, slug, setLocation]);

  useEffect(() => {
    if (!partnerQuery.data) return;
    document.title = `The full breakdown · ${partnerQuery.data.name}`;
    void api("/api/page-visits", {
      method: "POST",
      body: JSON.stringify({ partnerId: partnerQuery.data.id, page: "breakdown" }),
    }).catch(() => undefined);
  }, [partnerQuery.data]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [currentWork, setCurrentWork] = useState("");
  const [futureVision, setFutureVision] = useState("");
  const [bestTime, setBestTime] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !funnel.leadId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api(`/api/leads/${funnel.leadId}/details`, {
        method: "PATCH",
        body: JSON.stringify({
          phone: phone.trim(),
          currentWork: currentWork.trim(),
          futureVision: futureVision.trim(),
          bestTime: bestTime.trim(),
        }),
      });
      setSubmitted(true);
      funnel.clear();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (redirecting || partnerQuery.isPending) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <main className="min-h-[100dvh] grid place-items-center px-6">
        <p className="text-muted-foreground">Couldn&apos;t load the breakdown.</p>
      </main>
    );
  }

  const partner = partnerQuery.data;
  const firstName = partner.name.split(" ")[0];

  if (submitted) {
    return (
      <main className="min-h-[100dvh] grid place-items-center px-5 py-12">
        <div className="bfa-card-strong p-8 max-w-md w-full text-center bfa-animate-in">
          <div className="mx-auto h-14 w-14 rounded-full bg-[var(--gold)]/15 grid place-items-center mb-5">
            <CheckCircle2 className="h-7 w-7 text-[var(--gold)]" />
          </div>
          <h1 className="font-display text-3xl mb-2">You&apos;re in.</h1>
          <p className="text-muted-foreground">
            {firstName} will reach out at the time you suggested. In the meantime, both breakdowns stay here whenever you want to revisit them.
          </p>
          <Button asChild variant="secondary" size="lg" className="mt-6">
            <Link href={`/${slug}`}>Back to {firstName}&apos;s page</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="px-5 sm:px-8 pt-5 pb-4 flex items-center justify-between border-b border-border/30 bfa-animate-in">
        <BrandMark />
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {funnel.email ?? "Private session"}
        </div>
      </header>

      <section className="flex-1 px-5 sm:px-8 py-8 max-w-3xl mx-auto w-full">
        <div className="text-center bfa-animate-in">
          <p className="bfa-pill mx-auto">Step 3 of 3</p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold mt-4 leading-[1.05]">
            The <span className="text-[var(--gold)]">full</span> breakdown.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            How the system actually runs — what the day-to-day looks like, what the products do, and what the pace of building looks like.
          </p>
        </div>

        <div className="mt-8 bfa-card p-2 sm:p-3 bfa-animate-in">
          <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${FULL_VIDEO_ID}?rel=0&modestbranding=1`}
              title="Build From Anywhere — full breakdown"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 bfa-card-strong p-6 sm:p-8 space-y-5 bfa-animate-in">
          <div className="text-center">
            <h2 className="font-display text-2xl sm:text-3xl">Want to take the next step with {firstName}?</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Four quick details — under a minute — so the conversation goes where it needs to.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                className="pl-11"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current-work">Current occupation</Label>
            <Input
              id="current-work"
              required
              value={currentWork}
              onChange={(e) => setCurrentWork(e.target.value)}
              placeholder="Nurse / Realtor / SaaS PM…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="future-vision">Where do you want to be in 2 – 5 years?</Label>
            <Textarea
              id="future-vision"
              required
              value={futureVision}
              onChange={(e) => setFutureVision(e.target.value)}
              placeholder="Out of my W2, traveling 3 months a year, retire my partner from their job…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="best-time">Best time to connect</Label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="best-time"
                required
                className="pl-11"
                value={bestTime}
                onChange={(e) => setBestTime(e.target.value)}
                placeholder="Weeknights after 7pm CT, weekends anytime…"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" size="xl" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : `Connect with ${firstName}`}
          </Button>

          <p className="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
            {firstName} reaches out personally at the time you suggested · No spam
          </p>
        </form>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/70">
        Private session for {funnel.email ?? "guest"} · Step 3 of 3
      </footer>
    </main>
  );
}
