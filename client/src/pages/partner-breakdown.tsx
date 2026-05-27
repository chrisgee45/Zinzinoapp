import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  Lock,
  Phone,
  Smartphone,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFunnel } from "@/lib/funnelContext";
import { isStandalone, onInstallAvailable, promptInstall } from "@/lib/pwa";
import { cn } from "@/lib/utils";
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
  const [submittedLeadId, setSubmittedLeadId] = useState<number | null>(null);
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
      const submittedId = funnel.leadId;
      await api(`/api/leads/${submittedId}/details`, {
        method: "PATCH",
        body: JSON.stringify({
          phone: phone.trim(),
          currentWork: currentWork.trim(),
          futureVision: futureVision.trim(),
          bestTime: bestTime.trim(),
        }),
      });
      setSubmittedLeadId(submittedId);
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
      <SubmittedView
        partner={partner}
        firstName={firstName}
        bestTimeAnswer={bestTime}
        funnelEmail={funnel.email}
        leadId={submittedLeadId}
      />
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
            How it actually works — the test-don&apos;t-guess approach to the products, and the three real ways the business pays. Then it&apos;s a conversation, not a pitch.
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

interface SubmittedViewProps {
  partner: PublicPartner;
  firstName: string;
  bestTimeAnswer: string;
  funnelEmail: string | null;
  leadId: number | null;
}

function SubmittedView({ partner, firstName, bestTimeAnswer, funnelEmail, leadId }: SubmittedViewProps) {
  const [, setLocation] = useLocation();
  const [installAvailable, setInstallAvailable] = useState(false);
  const [interest, setInterest] = useState<"products" | "income" | null>(null);
  const enrollUrl = partner.enrollmentLink?.trim() || null;

  function pickInterest(next: "products" | "income") {
    const value = interest === next ? null : next;
    setInterest(value);
    if (leadId) {
      // Best-effort — silently fire and forget; partner pre-call intel only.
      void api(`/api/leads/${leadId}/interest`, {
        method: "PATCH",
        body: JSON.stringify({ interest: value }),
      }).catch(() => undefined);
    }
  }

  useEffect(() => onInstallAvailable(setInstallAvailable), []);
  useEffect(() => {
    void api("/api/page-visits", {
      method: "POST",
      body: JSON.stringify({ partnerId: partner.id, page: "breakdown" }),
    }).catch(() => undefined);
  }, [partner.id]);

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === "accepted") setInstallAvailable(false);
  }

  function downloadCalendar() {
    const start = new Date();
    start.setHours(start.getHours() + 24);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}00Z`;
    const desc = `Call with ${partner.name} from Build From Anywhere.\\n\\nThey'll reach out around: ${bestTimeAnswer}`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Build From Anywhere//EN",
      "BEGIN:VEVENT",
      `UID:bfa-${partner.id}-${Date.now()}@buildfromanywhere`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Call with ${partner.name} — Build From Anywhere`,
      `DESCRIPTION:${desc}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${partner.slug}-call.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="px-5 sm:px-8 pt-5 pb-4 flex items-center justify-between border-b border-border/30 bfa-animate-in">
        <BrandMark />
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {funnelEmail ?? "Private session"}
        </div>
      </header>

      <section className="flex-1 px-5 sm:px-8 py-8 max-w-3xl mx-auto w-full">
        <div className="bfa-card-strong p-6 sm:p-10 bfa-animate-in bfa-glow">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {partner.photoUrl ? (
              <img
                src={partner.photoUrl}
                alt={partner.name}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover ring-1 ring-[var(--gold)]/40 shrink-0"
              />
            ) : (
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/40 grid place-items-center shrink-0">
                <CheckCircle2 className="h-9 w-9 text-[var(--gold)]" />
              </div>
            )}
            <div className="text-center sm:text-left flex-1">
              <p className="bfa-pill inline-flex">{firstName} got it</p>
              <h1 className="font-display text-3xl sm:text-4xl mt-3 leading-tight">
                You&apos;re in. The next move is mine.
              </h1>
              <p className="text-muted-foreground mt-3 text-sm sm:text-base">
                I&apos;ll reach out personally at the time you mentioned
                {bestTimeAnswer ? (
                  <>: <span className="text-foreground font-medium">{bestTimeAnswer}</span></>
                ) : (
                  ""
                )}
                . Real conversation, no script — just figuring out if this is right for you.
              </p>
              <p className="mt-3 text-sm font-medium text-[var(--gold)]">— {partner.name}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            onClick={downloadCalendar}
            className="bfa-card p-5 text-left flex items-start gap-3 transition hover:border-[var(--gold)]/60"
          >
            <CalendarPlus className="h-5 w-5 text-[var(--gold)] mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Add a reminder</p>
              <p className="text-xs text-muted-foreground mt-1">
                Drop a placeholder on your calendar so you&apos;re ready when {firstName} reaches out.
              </p>
            </div>
          </button>
          {!isStandalone() && installAvailable && (
            <button
              onClick={handleInstall}
              className="bfa-card p-5 text-left flex items-start gap-3 transition hover:border-[var(--gold)]/60"
            >
              <Smartphone className="h-5 w-5 text-[var(--gold)] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Save {firstName}&apos;s page</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add it to your home screen so it&apos;s right there when we talk.
                </p>
              </div>
            </button>
          )}
        </div>

        <div className="mt-8 bfa-card p-6 sm:p-8 bfa-animate-in">
          <div className="text-center mb-5">
            <p className="bfa-pill mx-auto">While you wait</p>
            <h2 className="font-display text-2xl sm:text-3xl mt-3">What pulled you in?</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Pick whichever feels closer. It helps me know where to start when we talk — and you can dig deeper while you wait.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PathCard
              icon={Heart}
              label="The science & products"
              hook="The blood test, the omega ratio, the 120-day reset. Real before-and-after data."
              active={interest === "products"}
              onClick={() => pickInterest("products")}
            />
            <PathCard
              icon={TrendingUp}
              label="The income & freedom"
              hook="No inventory. Three ways it pays. Built around customers who actually reorder."
              active={interest === "income"}
              onClick={() => pickInterest("income")}
            />
          </div>

          {interest && (
            <div className="mt-5 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-5 bfa-animate-in">
              {interest === "products" ? (
                <>
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--gold)]" /> Test, don&apos;t guess.
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    The average US adult sits at a <span className="text-foreground font-medium">25:1 omega-6 to omega-3 ratio</span>. The
                    goal is <span className="text-foreground font-medium">under 3:1</span>. The way it works: a dried-blood-spot test you do
                    at home (literally 15 seconds), mail in, and get your actual numbers back. Then 120 days of
                    BalanceOil+, and you retest. Real before-and-after, not a feel-good guess.
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {firstName} will walk you through the test, the daily routine, and what most people notice along
                    the way — clearer energy, deeper sleep, easier recovery — when you talk.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--gold)]" /> The model, straight.
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    No buy-in, no inventory, no parties. Three real ways the business pays:
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-[var(--gold)] font-semibold">1.</span>
                      <span><span className="text-foreground font-medium">Customer commissions</span> — people order the test + oil, you earn on every reorder.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[var(--gold)] font-semibold">2.</span>
                      <span><span className="text-foreground font-medium">Team building</span> — when others join, you grow alongside them, not against them.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[var(--gold)] font-semibold">3.</span>
                      <span><span className="text-foreground font-medium">Rank bonuses &amp; trips</span> — milestone rewards as your team hits new tiers.</span>
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {firstName} will run the math with you on the call — based on the hours you actually have — so you
                    can see what realistic looks like for your situation. No claims, just the structure.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {enrollUrl && (
          <div className="mt-6 text-center bfa-animate-in">
            <p className="text-sm text-muted-foreground">
              Already know this is yours?{" "}
              <a
                href={enrollUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--gold)] font-semibold hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                Start with {firstName} now <ArrowRight className="h-3 w-3" />
              </a>
            </p>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => setLocation(`/${partner.slug}`)}>
            Revisit {firstName}&apos;s page
          </Button>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 flex items-center gap-2">
            <Clock className="h-3 w-3" /> Talk soon
          </p>
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/70">
        You&apos;ll hear from {firstName} at the time you mentioned.
      </footer>
    </main>
  );
}

interface PathCardProps {
  icon: typeof Heart;
  label: string;
  hook: string;
  active: boolean;
  onClick: () => void;
}

function PathCard({ icon: Icon, label, hook, active, onClick }: PathCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bfa-card p-5 text-left transition active:scale-[0.99]",
        active && "border-[var(--gold)] bfa-glow",
      )}
      aria-pressed={active}
    >
      <Icon className={cn("h-6 w-6 mb-3", active ? "text-[var(--gold)]" : "text-muted-foreground")} />
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{hook}</p>
    </button>
  );
}
