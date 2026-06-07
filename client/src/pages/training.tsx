import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Flame,
  GraduationCap,
  Lock,
  Map as MapIcon,
  Sparkles,
  Wrench,
} from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { trainingContent, type TrainingLevelId, type TrainingModule } from "@/data/trainingContent";

const LEVEL_BY_ID = new Map<TrainingLevelId, TrainingModule>(
  trainingContent.map((m) => [m.id, m] as const),
);

interface JourneyTile {
  id: TrainingLevelId;
  label: string;
  number: string;
  shortTitle: string;
  tagline: string;
  body: string;
}

const JOURNEY: JourneyTile[] = [
  {
    id: "foundation",
    label: "Foundation",
    number: "00",
    shortTitle: "Identity & Belief",
    tagline: "Decide who you are",
    body: "Before tactics. Identity work that everything else builds on.",
  },
  {
    id: "level-1",
    label: "Level 1",
    number: "01",
    shortTitle: "Brand-New Partner",
    tagline: "First 120 days",
    body: "Get launched. Acquire customers. Recruit partners. Duplicate.",
  },
  {
    id: "level-2",
    label: "Level 2",
    number: "02",
    shortTitle: "Fast Started",
    tagline: "Duplication is the key",
    body: "Install your rhythm. Build the people who'll do this without you.",
  },
  {
    id: "level-3",
    label: "Level 3",
    number: "03",
    shortTitle: "Next Level",
    tagline: "Builder → Leader",
    body: "The shift from 'I can build this' to 'I lead the people who do.'",
  },
  {
    id: "level-4",
    label: "Level 4",
    number: "04",
    shortTitle: "Leadership & Legacy",
    tagline: "Be the example",
    body: "Culture is the only thing that scales. Produce leaders who produce leaders.",
  },
];

function recommendLevel(createdAt: Date): TrainingLevelId {
  const ageDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays < 7) return "foundation";
  if (ageDays < 60) return "level-1";
  if (ageDays < 120) return "level-2";
  if (ageDays < 365) return "level-3";
  return "level-4";
}

export default function TrainingHub() {
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const recommendedId = useMemo<TrainingLevelId>(() => {
    if (!partner?.createdAt) return "level-1";
    return recommendLevel(new Date(partner.createdAt));
  }, [partner?.createdAt]);

  // Recommendation override is in-memory only (spec rule: no storage).
  const [focusOverride, setFocusOverride] = useState<TrainingLevelId | null>(null);
  const focusedId = focusOverride ?? recommendedId;

  const recommendedIndex = JOURNEY.findIndex((t) => t.id === focusedId);

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <div className="h-5 w-5 rounded-full border-2 border-[var(--gold)]/40 border-t-[var(--gold)] animate-spin" />
      </main>
    );
  }

  const featured = LEVEL_BY_ID.get(focusedId);
  const firstName = partner.name.split(" ")[0];

  return (
    <AuthShell>
      {/* HERO */}
      <section className="relative pt-2 pb-10 bfa-animate-in">
        <p className="bfa-pill inline-flex">The Build From Anywhere System</p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold mt-4 leading-[1.02] tracking-tight">
          Your <span className="text-[var(--gold)]">training</span>. Built for exactly where you are.
        </h1>
        <p className="mt-5 text-base sm:text-lg text-foreground/85 max-w-2xl leading-relaxed">
          Welcome back, {firstName}. The path runs from brand-new partner to team leader. Pick up where the work is for you today. You can always jump anywhere.
        </p>
      </section>

      {/* FEATURED: "Start here today" */}
      {featured && (
        <FeaturedCard module={featured} index={recommendedIndex} isAutoRecommend={focusOverride === null} />
      )}

      {/* JOURNEY MAP */}
      <section className="mt-12">
        <div className="flex items-center gap-3 mb-5">
          <MapIcon className="h-4 w-4 text-[var(--gold)]" />
          <h2 className="font-display text-xl font-bold">The whole path</h2>
          <span className="text-xs text-muted-foreground">5 modules · sequential</span>
        </div>

        <div className="relative">
          {/* Horizontal connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-[42px] left-[5%] right-[5%] h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.35) 12%, rgba(201,168,76,0.35) 88%, transparent 100%)",
            }}
            aria-hidden
          />

          <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {JOURNEY.map((tile, i) => {
              const isFeatured = tile.id === focusedId;
              const isPast = i < recommendedIndex;
              const isUpcoming = i > recommendedIndex;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => {
                    setFocusOverride(tile.id);
                    document.getElementById("featured")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  onDoubleClick={() => setLocation(`/training/${tile.id}`)}
                  className={cn(
                    "relative bfa-card p-5 text-left transition group flex flex-col gap-2",
                    "hover:border-[var(--gold)]/60 hover:bfa-glow",
                    isFeatured && "border-[var(--gold)] bfa-glow ring-1 ring-[var(--gold)]/40",
                    isPast && !isFeatured && "opacity-80",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Connector node */}
                  <span
                    className={cn(
                      "hidden lg:block absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 transition",
                      isFeatured
                        ? "bg-[var(--gold)] border-[var(--gold)]"
                        : isPast
                        ? "bg-[var(--gold)]/70 border-[var(--gold)]/70"
                        : "bg-background border-border",
                    )}
                    aria-hidden
                  />
                  <div className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "font-display text-3xl font-bold leading-none transition",
                        isFeatured ? "text-[var(--gold)]" : "text-foreground/40 group-hover:text-[var(--gold)]/80",
                      )}
                    >
                      {tile.number}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)]/80 font-semibold">
                      {tile.label}
                    </span>
                  </div>
                  <p className="font-display text-base font-bold leading-tight">{tile.shortTitle}</p>
                  <p className="text-xs text-[var(--gold)]/80 uppercase tracking-[0.18em]">{tile.tagline}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tile.body}</p>
                  <span
                    className={cn(
                      "mt-auto pt-2 text-[10px] uppercase tracking-[0.22em] font-semibold inline-flex items-center gap-1.5",
                      isFeatured
                        ? "text-[var(--gold)]"
                        : isUpcoming
                        ? "text-muted-foreground/70"
                        : "text-foreground/70",
                    )}
                  >
                    {isFeatured ? (
                      <>
                        <Sparkles className="h-3 w-3" /> Start here
                      </>
                    ) : isUpcoming ? (
                      <>
                        <Lock className="h-3 w-3" /> Up next
                      </>
                    ) : (
                      <>Walked it</>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Tap a card to focus it · Double-tap to dive in
        </p>
      </section>

      {/* UTILITIES */}
      <section className="mt-12">
        <div className="flex items-center gap-3 mb-5">
          <BookOpen className="h-4 w-4 text-[var(--teal-soft)]" />
          <h2 className="font-display text-xl font-bold">Reference &amp; extras</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <UtilityCard
            href="/training/toolkit"
            icon={Wrench}
            badge="Toolkit"
            title="Scripts, Color Code, Comp Plan"
            body="The reference appendix. Every script verbatim, the 4-color wallet card, and the comp plan in plain English."
          />
          <UtilityCard
            href="/training/foundation"
            icon={Compass}
            badge="Foundation"
            title="Identity &amp; Belief"
            body="Re-walk the inner work whenever momentum stalls. Most leaders revisit Foundation every quarter."
          />
          <UtilityCard
            href="/training/closing"
            icon={Flame}
            badge="Closing"
            title="The Inner Fire"
            body="The Final Mindset Checklist. Read it before any big push. Don't hold what we have from the world."
          />
        </div>
      </section>

      {/* FOOTER NOTE */}
      <footer className="border-t border-border/40 mt-14 pt-8 pb-4 max-w-3xl">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Built from conference notes (Schrandt, Goldberg, Saelle, Baskin, Ocean) and grounded in the Zinzino USA Compensation Plan. All Pay Point and rank figures reflect the structure of the Compensation Plan only and are not a guarantee of earnings. Success comes from real product sales and consistent effort. Defer to the official Zinzino Back Office for current figures.
        </p>
      </footer>
    </AuthShell>
  );
}

function FeaturedCard({
  module,
  index,
  isAutoRecommend,
}: {
  module: TrainingModule;
  index: number;
  isAutoRecommend: boolean;
}) {
  const stepCount = module.steps.length;
  return (
    <section
      id="featured"
      className="relative bfa-card-strong p-6 sm:p-8 md:p-10 bfa-glow bfa-animate-in scroll-mt-20"
    >
      {/* corner ribbon */}
      <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">
        <Sparkles className="h-3 w-3" />
        {isAutoRecommend ? "Recommended for you" : "Focused"}
      </span>

      <div className="grid lg:grid-cols-[140px_1fr] gap-6 lg:gap-10 items-start">
        <div className="hidden lg:block">
          <span className="font-display text-[120px] font-bold text-[var(--gold)] leading-none block">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)] font-semibold inline-flex items-center gap-1.5">
            <span className="lg:hidden font-display text-3xl text-[var(--gold)] mr-1.5">
              {String(index + 1).padStart(2, "0")}
            </span>
            {module.badge}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-[42px] font-bold mt-3 leading-[1.04] tracking-tight">
            {module.title}.
          </h2>
          <p className="mt-2 text-sm uppercase tracking-[0.22em] text-[var(--gold)]/90">
            {module.subtitle}
          </p>
          {module.promise && (
            <p className="mt-5 text-base sm:text-lg text-foreground/90 leading-relaxed max-w-2xl">
              {module.promise}
            </p>
          )}
          {module.intro && (
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              {module.intro}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="xl">
              <Link href={`/training/${module.id}`}>
                Begin {module.badge}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
              {stepCount} {stepCount === 1 ? "step" : "steps"}
              {module.graduation ? " · graduation checklist at the end" : ""}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function UtilityCard({
  href,
  icon: Icon,
  badge,
  title,
  body,
}: {
  href: string;
  icon: typeof BookOpen;
  badge: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="bfa-card p-5 sm:p-6 transition hover:border-[var(--gold)]/60 hover:bfa-glow flex flex-col gap-3 group"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--gold)]" />
        <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)] font-semibold">{badge}</span>
      </div>
      <h3 className="font-display text-lg font-bold leading-tight" dangerouslySetInnerHTML={{ __html: title }} />
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{body}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--gold)] font-semibold group-hover:gap-2 transition-all">
        Open <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
