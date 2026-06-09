import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock,
  Loader2,
  Lock,
  Phone,
  Quote,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useFunnel } from "@/lib/funnelContext";
import { cn } from "@/lib/utils";
import { loadTracking, trackCompleteRegistration, trackViewContent } from "@/lib/tracking";
import { DEFAULT_TESTIMONIALS, parseTestimonials, type Testimonial } from "@/lib/testimonials";
import type { ColorCode, PublicPartner } from "@shared/schema";

// Form pop styling. The shared Input/Textarea/Select components default to
// a translucent bg-input/60 that blends into bfa-card-strong on this page,
// so the whole form reads as one washed-out navy slab. These overrides give
// the fields a solid input fill, a gold-tinted border, and a brighter
// placeholder so the form actually reads as a form instead of a backdrop.
// Labels get the same treatment to lift them off the muted default.
const FORM_FIELD =
  "bg-[color-mix(in_oklab,hsl(var(--input))_100%,transparent)] border-[color-mix(in_oklab,var(--gold)_22%,hsl(var(--border)))] placeholder:text-foreground/45";
const FORM_LABEL = "text-[13px] text-foreground/90 tracking-[0.16em]";

// One question, four answers. The color tag is invisible to the prospect on
// purpose — they're answering a question, not picking a personality. The
// mapping lives only in code so the bot and CRM still get the routing
// signal without the prospect ever thinking "I'm a green / red / etc."
const QUESTION_OPTIONS: Array<{ code: ColorCode; label: string }> = [
  { code: "green", label: "Show me the data and the proof" },
  { code: "red", label: "Just tell me what to do and how to win" },
  { code: "yellow", label: "Help me help people, build real relationships" },
  { code: "blue", label: "Build it the right way and have fun doing it" },
];

type PartnerWithContent = PublicPartner & { content?: Record<string, string> };

// Platform-default breakdown video. Used as the fallback when a lead lands
// on /breakdown without a colorCode in their funnel context (stale deep-link,
// back-button into a cleared session). Each color now has its own recorded
// video — swap an ID here to replace a color's video; no other code changes
// needed, the funnel + bot pick it up automatically.
const DEFAULT_FULL_VIDEO_ID = "YvEULrrTdCw";
const COLOR_VIDEO_IDS: Record<ColorCode, string> = {
  green: "XdVP2bGOYbU",
  red: "W-jZa82X5ZU",
  yellow: "S4APUx9itm8",
  blue: "n25Q8zy1gGc",
};

export default function PartnerBreakdown() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const funnel = useFunnel();

  const partnerQuery = useQuery<PartnerWithContent>({
    queryKey: ["partner", slug],
    queryFn: () => api<PartnerWithContent>(`/api/partner/${slug}`),
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
    loadTracking({
      metaPixelId: partnerQuery.data.content?.meta_pixel_id,
      tiktokPixelId: partnerQuery.data.content?.tiktok_pixel_id,
      gaMeasurementId: partnerQuery.data.content?.ga_measurement_id,
    });
    trackViewContent();
  }, [partnerQuery.data]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formRevealed, setFormRevealed] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [phone, setPhone] = useState("");
  const [currentWork, setCurrentWork] = useState("");
  const [futureVision, setFutureVision] = useState("");
  const [bestTime, setBestTime] = useState("");
  const [timeline, setTimeline] = useState<"" | "now" | "soon" | "researching">("");
  const [whatPulledIn, setWhatPulledIn] = useState("");

  function revealForm() {
    setFormRevealed(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

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
          timeline: timeline || undefined,
          whatPulledIn: whatPulledIn.trim() || undefined,
        }),
      });
      trackCompleteRegistration();
      // Drop them on the partner's "Meet your guide" section on the landing
      // page. funnel state is preserved on purpose so the landing page
      // recognizes them as already-submitted (video stays unlocked, no
      // re-prompting for email). The leadId stays in localStorage until they
      // start a new session somewhere else.
      setLocation(`/${slug}#meet-your-guide`);
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
  // Color set on step 2. If somehow missing (deep-link / cache), fall back
  // to the platform default so the page still renders rather than hanging.
  const videoId = funnel.colorCode ? COLOR_VIDEO_IDS[funnel.colorCode] : DEFAULT_FULL_VIDEO_ID;

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
            {/* Iframe only mounts after the question modal closes (i.e. after
                funnel.colorCode is set). That keeps YouTube from preloading
                audio while the modal is up and lets us pick the color-matched
                video on the fly. */}
            {funnel.colorCode && (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                title="Build From Anywhere — full breakdown"
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            )}
          </div>
        </div>

        {!formRevealed ? (
          <NextStepGate
            firstName={firstName}
            onReveal={revealForm}
            featured={
              (parseTestimonials(partner.content?.testimonials) ?? DEFAULT_TESTIMONIALS).find((t) =>
                t.name.toLowerCase().includes("chris"),
              ) ?? (parseTestimonials(partner.content?.testimonials) ?? DEFAULT_TESTIMONIALS)[0]
            }
          />
        ) : (
          <form ref={formRef} onSubmit={onSubmit} className="mt-8 bfa-card-strong bfa-glow p-6 sm:p-8 space-y-5 bfa-animate-in scroll-mt-6">
            <div className="text-center">
              <p className="bfa-pill mx-auto">Last step</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mt-4 leading-[1.05] text-foreground drop-shadow-[0_2px_12px_rgba(201,168,76,0.25)]">
                Schedule a call with <span className="text-[var(--gold)]">{firstName}</span>.
              </h2>
              <p className="text-sm sm:text-base text-foreground/80 mt-3 max-w-md mx-auto leading-relaxed">
                A few quick fields, under a minute, so the conversation goes where it needs to.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className={FORM_LABEL}>Phone</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--gold)]/70" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className={cn(FORM_FIELD, "pl-11")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="current-work" className={FORM_LABEL}>Current occupation</Label>
              <Input
                id="current-work"
                required
                className={FORM_FIELD}
                value={currentWork}
                onChange={(e) => setCurrentWork(e.target.value)}
                placeholder="Nurse / Realtor / SaaS PM…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="future-vision" className={FORM_LABEL}>Where do you want to be in 2 – 5 years?</Label>
              <Textarea
                id="future-vision"
                required
                className={FORM_FIELD}
                value={futureVision}
                onChange={(e) => setFutureVision(e.target.value)}
                placeholder="Out of my W2, traveling 3 months a year, retire my partner from their job…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="best-time" className={FORM_LABEL}>Best time to connect</Label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--gold)]/70" />
                <Input
                  id="best-time"
                  required
                  className={cn(FORM_FIELD, "pl-11")}
                  value={bestTime}
                  onChange={(e) => setBestTime(e.target.value)}
                  placeholder="Weeknights after 7pm CT, weekends anytime…"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeline" className={FORM_LABEL}>When are you looking to start something new?</Label>
              <Select
                id="timeline"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value as typeof timeline)}
                required
                className={FORM_FIELD}
              >
                <option value="" disabled>Pick one…</option>
                <option value="now">Now, I&apos;m ready to move</option>
                <option value="soon">Next 1-3 months</option>
                <option value="researching">Just researching for now</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="what-pulled-in" className={FORM_LABEL}>What pulled you in from the video?</Label>
              <Textarea
                id="what-pulled-in"
                className={FORM_FIELD}
                value={whatPulledIn}
                onChange={(e) => setWhatPulledIn(e.target.value)}
                placeholder="The omega-3 ratio thing, the no-inventory part, the fact that it's phone-first…"
              />
              <p className="text-xs text-foreground/55">Optional, but helps {firstName} pick up the thread right where you left off.</p>
            </div>

            {error && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" size="xl" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : `Connect with ${firstName}`}
            </Button>

            <p className="text-center text-[11px] uppercase tracking-[0.18em] text-foreground/65">
              {firstName} reaches out personally at the time you suggested · No spam
            </p>
          </form>
        )}
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/70">
        Private session for {funnel.email ?? "guest"} · Step 3 of 3
      </footer>

      <ColorQuestionModal
        open={!funnel.colorCode}
        onPick={(color) => {
          funnel.setColor(color);
          if (funnel.leadId) {
            void api(`/api/leads/${funnel.leadId}/color`, {
              method: "PATCH",
              body: JSON.stringify({ colorCode: color }),
            }).catch(() => undefined);
          }
        }}
      />
    </main>
  );
}


// Sits as a regular page-level Dialog on the breakdown route. The Radix
// overlay already does the page blur (backdrop-blur-md set on DialogOverlay).
// No close button, no escape, no click-outside dismiss — they have to pick.
function ColorQuestionModal({
  open,
  onPick,
}: {
  open: boolean;
  onPick: (color: ColorCode) => void;
}) {
  const [picked, setPicked] = useState<ColorCode | null>(null);
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        hideClose
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-xl"
      >
        <div className="text-center">
          <p className="bfa-pill mx-auto">One quick question</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-4 leading-[1.05] text-foreground drop-shadow-[0_2px_12px_rgba(201,168,76,0.25)]">
            What sounds <span className="text-[var(--gold)]">most like you</span>?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-foreground/80 max-w-md mx-auto leading-relaxed">
            Tap whichever fits. The next video is the one that actually speaks your language.
          </p>
        </div>

        <div className="mt-6 sm:mt-7 flex flex-col gap-3 sm:gap-3.5">
          {QUESTION_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                if (picked) return;
                setPicked(opt.code);
                // Brief delay so the press state lands before the modal closes.
                window.setTimeout(() => onPick(opt.code), 180);
              }}
              className={cn(
                // Mirrors the primary Button variant from button.tsx — same
                // gold gradient, same shadow, same dark-on-gold text — just
                // sized as a fat oval pill and laid out full-width.
                "w-full rounded-full text-center font-bold leading-snug tracking-wide",
                "px-6 py-5 sm:px-8 sm:py-6 text-base sm:text-lg",
                "text-[hsl(var(--primary-foreground))]",
                "[background:linear-gradient(180deg,var(--gold-soft)_0%,var(--gold-deep)_100%)]",
                "shadow-[0_12px_36px_-12px_rgba(201,168,76,0.55),inset_0_1px_0_rgba(255,255,255,0.4)]",
                "transition-all duration-200",
                "hover:brightness-105 hover:shadow-[0_18px_44px_-14px_rgba(201,168,76,0.7),inset_0_1px_0_rgba(255,255,255,0.4)]",
                "active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                picked === opt.code && "brightness-110 scale-[0.99]",
                picked && picked !== opt.code && "opacity-40",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NextStepGate({ firstName, onReveal, featured }: { firstName: string; onReveal: () => void; featured: Testimonial }) {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-[1fr_280px] bfa-animate-in">
      <div className="bfa-card-strong p-6 sm:p-8 bfa-glow flex flex-col justify-center text-center md:text-left">
        <p className="bfa-pill inline-flex md:self-start mx-auto md:mx-0">Decide on your own time</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold mt-3 leading-tight">
          Ready for a real conversation with {firstName}?
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
          Five quick details. Under a minute. Then {firstName} reaches out personally — at the time you pick, on the phone you give. No script, no pitch. Just a conversation.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 md:items-center md:justify-start">
          <Button size="xl" onClick={onReveal}>
            Yes — let&apos;s talk
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
            No commitment · No surprises
          </p>
        </div>
      </div>

      <aside className="bfa-card p-5 sm:p-6 flex flex-col gap-3 md:max-w-[280px]">
        <Quote className="h-5 w-5 text-[var(--gold)]" />
        <p className="text-sm leading-relaxed text-foreground/90 italic">
          &ldquo;{featured.quote}&rdquo;
        </p>
        <div className="mt-auto pt-3 border-t border-border/40">
          <p className="font-semibold text-sm">{featured.name}</p>
          {featured.context && <p className="text-xs text-muted-foreground mt-0.5">{featured.context}</p>}
        </div>
      </aside>
    </div>
  );
}

