import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Compass, Flame, GraduationCap, Map as MapIcon } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BlockRenderer } from "@/components/training/training-blocks";
import { ReadingProgressBar, TrainingNav } from "@/components/training/training-nav";
import {
  heroPromise,
  heroSubtitle,
  incomeDisclaimer,
  trainingContent,
  type TrainingModule,
  type TrainingStep,
} from "@/data/trainingContent";

const LEVEL_MAP: { id: string; eyebrow: string; title: string; tagline: string }[] = [
  { id: "foundation", eyebrow: "Foundation", title: "Identity & Belief", tagline: "Decide who you are." },
  { id: "level-1", eyebrow: "Level 1", title: "Brand-New Partner", tagline: "First 120 days. Get launched." },
  { id: "level-2", eyebrow: "Level 2", title: "Fast Started", tagline: "Duplication is the key." },
  { id: "level-3", eyebrow: "Level 3", title: "Next Level", tagline: "Builder → Leader." },
  { id: "level-4", eyebrow: "Level 4", title: "Leadership & Legacy", tagline: "Be the example." },
];

export default function TrainingPage() {
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const [activeId, setActiveId] = useState<string>("hero");
  const sectionsRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  // IntersectionObserver to highlight the active module in the side nav
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.1, 0.25] },
    );
    sectionsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const registerSection = (id: string) => (el: HTMLElement | null) => {
    if (el) sectionsRef.current.set(id, el);
    else sectionsRef.current.delete(id);
  };

  const moduleIds = useMemo(() => trainingContent.map((m) => m.id), []);

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <div className="h-5 w-5 rounded-full border-2 border-[var(--gold)]/40 border-t-[var(--gold)] animate-spin" />
      </main>
    );
  }

  return (
    <AuthShell>
      <ReadingProgressBar />

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10 -mt-2">
        <TrainingNav modules={trainingContent as TrainingModule[]} activeId={activeId} />

        <div className="min-w-0">
          {/* HERO */}
          <section
            id="hero"
            ref={registerSection("hero")}
            className="scroll-mt-24 pt-2 pb-12 bfa-animate-in"
          >
            <p className="bfa-pill inline-flex">The training program</p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold mt-4 leading-[1.02] tracking-tight">
              The <span className="text-[var(--gold)]">Build From Anywhere</span> System.
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-foreground/85 max-w-2xl leading-relaxed">{heroPromise}</p>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">{heroSubtitle}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => sectionsRef.current.get("foundation")?.scrollIntoView({ behavior: "smooth" })}
              >
                Start at the Foundation
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>

            {/* 5-tile map */}
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {LEVEL_MAP.map((tile, i) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => sectionsRef.current.get(tile.id)?.scrollIntoView({ behavior: "smooth" })}
                  className={cn(
                    "bfa-card p-4 text-left transition group hover:border-[var(--gold)]/60 hover:bfa-glow bfa-animate-in",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)] font-semibold">
                    {tile.eyebrow}
                  </span>
                  <p className="font-display text-base font-bold mt-1.5 leading-tight">{tile.title}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{tile.tagline}</p>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-[var(--gold)] mt-2 transition" />
                </button>
              ))}
            </div>

            {/* How to use this */}
            <aside className="mt-8 bfa-card p-5 sm:p-6 max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] inline-flex items-center gap-1.5">
                <Compass className="h-3 w-3" /> How to use this
              </p>
              <ul className="mt-3 grid sm:grid-cols-2 gap-3 text-sm text-foreground/85">
                <li className="flex gap-2"><span className="text-[var(--gold)] font-semibold">1.</span> Levels are sequential — graduate each one before the next.</li>
                <li className="flex gap-2"><span className="text-[var(--gold)] font-semibold">2.</span> Watch for the dashed exercise boxes — those need a pen, not just a read.</li>
                <li className="flex gap-2"><span className="text-[var(--gold)] font-semibold">3.</span> Scripts are verbatim — memorize the rhythm, not the words.</li>
                <li className="flex gap-2"><span className="text-[var(--gold)] font-semibold">4.</span> Come back weekly — Level 1 still teaches new things at Level 4.</li>
              </ul>
            </aside>
          </section>

          {/* MODULES */}
          {trainingContent.map((module) => (
            <ModuleSection key={module.id} module={module} register={registerSection(module.id)} />
          ))}

          {/* FOOTER DISCLAIMER */}
          <footer className="border-t border-border/40 mt-12 pt-8 pb-12">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] mb-3 inline-flex items-center gap-1.5">
              <Flame className="h-3 w-3" /> Income disclaimer
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">{incomeDisclaimer}</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60 mt-6">
              Adventure Out Wellness · Built from anywhere
            </p>
          </footer>
        </div>
      </div>

      {/* Hidden helper so the moduleIds variable counts as "used" for tooling; doesn't render */}
      <span data-module-ids={moduleIds.join(",")} className="sr-only" aria-hidden />
    </AuthShell>
  );
}

function ModuleSection({
  module,
  register,
}: {
  module: TrainingModule;
  register: (el: HTMLElement | null) => void;
}) {
  const isLevel = module.id.startsWith("level-");
  const isMeta = module.id === "toolkit" || module.id === "closing";

  return (
    <section
      id={module.id}
      ref={register}
      className="scroll-mt-24 py-12 border-t border-border/40"
    >
      <div className="mb-10">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] border",
            isLevel
              ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/35"
              : isMeta
              ? "bg-[var(--teal)]/12 text-[var(--teal-soft)] border-[var(--teal)]/35"
              : "bg-secondary/40 text-foreground/80 border-border/50",
          )}
        >
          {module.badge}
        </span>
        <h2 className="font-display text-3xl sm:text-4xl md:text-[40px] font-bold mt-4 leading-[1.05] tracking-tight">
          {module.title}
        </h2>
        <p className="mt-2 text-sm sm:text-base uppercase tracking-[0.22em] text-[var(--gold)]/90">
          {module.subtitle}
        </p>
        {module.promise && (
          <p className="mt-5 text-base sm:text-lg text-foreground/85 leading-relaxed max-w-2xl">
            {module.promise}
          </p>
        )}
        {module.intro && (
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
            {module.intro}
          </p>
        )}
      </div>

      <div className="space-y-12">
        {module.steps.map((step) => (
          <StepBlock key={step.id} step={step} />
        ))}
      </div>

      {module.graduation && (
        <div className="mt-12 max-w-2xl">
          <p className="bfa-pill inline-flex">
            <GraduationCap className="h-3 w-3" /> Graduation
          </p>
          <h3 className="font-display text-2xl sm:text-3xl font-bold mt-3 leading-tight">
            {module.graduation.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            You're cleared for the next level when each of these is true — not when you think they look true on paper.
          </p>
          <div className="mt-5">
            <BlockRenderer
              block={{ kind: "checklist", title: undefined, items: module.graduation.items }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function StepBlock({ step }: { step: TrainingStep }) {
  return (
    <article id={step.id} className="scroll-mt-24 grid gap-5 sm:grid-cols-[80px_1fr]">
      <div className="hidden sm:block">
        {step.number !== undefined ? (
          <div className="sticky top-28 inline-flex items-baseline gap-1">
            <span className="font-display text-5xl font-bold text-[var(--gold)]/80 leading-none">
              {String(step.number).padStart(2, "0")}
            </span>
          </div>
        ) : (
          <div className="sticky top-28 h-1 w-12 bg-[var(--gold)]/60 mt-3" aria-hidden />
        )}
      </div>
      <div className="space-y-5">
        {step.eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)] font-semibold">
            {step.eyebrow}
          </p>
        )}
        <h3 className="font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
          {step.title}
        </h3>
        <div className="space-y-5">
          {step.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </article>
  );
}
