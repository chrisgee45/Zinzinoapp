import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BlockRenderer } from "@/components/training/training-blocks";
import { ReadingProgressBar } from "@/components/training/training-nav";
import {
  trainingContent,
  type TrainingLevelId,
  type TrainingModule,
  type TrainingStep,
} from "@/data/trainingContent";

const KNOWN_IDS: TrainingLevelId[] = [
  "foundation",
  "level-1",
  "level-2",
  "level-3",
  "level-4",
  "toolkit",
  "closing",
];

function isLevelId(s: string): s is TrainingLevelId {
  return (KNOWN_IDS as string[]).includes(s);
}

export default function TrainingLevelPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const [activeStepId, setActiveStepId] = useState<string>("");
  const stepRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  // Scroll to top on level change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [levelId]);

  const module = useMemo<TrainingModule | null>(() => {
    if (!levelId || !isLevelId(levelId)) return null;
    return trainingContent.find((m) => m.id === levelId) ?? null;
  }, [levelId]);

  const { prevModule, nextModule } = useMemo(() => {
    if (!module) return { prevModule: null, nextModule: null };
    const idx = trainingContent.findIndex((m) => m.id === module.id);
    return {
      prevModule: idx > 0 ? trainingContent[idx - 1] : null,
      nextModule: idx < trainingContent.length - 1 ? trainingContent[idx + 1] : null,
    };
  }, [module]);

  useEffect(() => {
    if (!module || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveStepId(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.1, 0.25] },
    );
    stepRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [module]);

  const registerStep = (id: string) => (el: HTMLElement | null) => {
    if (el) stepRefs.current.set(id, el);
    else stepRefs.current.delete(id);
  };

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <div className="h-5 w-5 rounded-full border-2 border-[var(--gold)]/40 border-t-[var(--gold)] animate-spin" />
      </main>
    );
  }

  if (!module) {
    return (
      <AuthShell>
        <div className="bfa-card p-8 text-center max-w-md mx-auto">
          <p className="font-display text-2xl mb-2">Module not found</p>
          <p className="text-sm text-muted-foreground mb-5">
            Maybe the link is wrong — head back to the training hub and pick from there.
          </p>
          <Button asChild>
            <Link href="/training">
              <ArrowLeft className="h-4 w-4" /> Back to training
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const moduleIndex = trainingContent.findIndex((m) => m.id === module.id);

  return (
    <AuthShell>
      <ReadingProgressBar />

      {/* Crumb */}
      <Link
        href="/training"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition mb-5"
      >
        <ArrowLeft className="h-3 w-3" /> Back to training
      </Link>

      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
        {/* Step nav */}
        {module.steps.length > 1 && (
          <aside className="hidden lg:block self-start sticky top-24">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)] mb-3 font-semibold">
              {module.badge} · Steps
            </p>
            <nav className="space-y-1 mb-6">
              {module.steps.map((step, i) => {
                const active = activeStepId === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => stepRefs.current.get(step.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className={cn(
                      "w-full text-left text-sm rounded-lg px-3 py-2 transition flex items-baseline gap-3",
                      active
                        ? "bg-[var(--gold)]/12 text-foreground ring-1 ring-[var(--gold)]/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "font-display text-xs font-bold shrink-0 transition",
                        active ? "text-[var(--gold)]" : "text-muted-foreground/60",
                      )}
                    >
                      {String(step.number ?? i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 leading-snug">{step.title}</span>
                  </button>
                );
              })}
            </nav>
            {module.graduation && (
              <button
                type="button"
                onClick={() => document.getElementById("graduation")?.scrollIntoView({ behavior: "smooth" })}
                className="w-full text-left text-sm rounded-lg px-3 py-2.5 bg-[var(--teal)]/10 ring-1 ring-[var(--teal)]/25 text-[var(--teal-soft)] hover:bg-[var(--teal)]/15 transition flex items-center gap-2 font-semibold"
              >
                <GraduationCap className="h-4 w-4" /> Graduation checklist
              </button>
            )}
          </aside>
        )}

        <div className="min-w-0">
          {/* Hero */}
          <section className="pb-10 bfa-animate-in">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-5xl sm:text-6xl font-bold text-[var(--gold)]/80 leading-none">
                {String(moduleIndex).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] font-semibold">
                  {module.badge}
                </p>
                <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight mt-1">
                  {module.title}
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm uppercase tracking-[0.22em] text-[var(--gold)]/85">
              {module.subtitle}
            </p>
            {module.promise && (
              <p className="mt-6 text-base sm:text-lg text-foreground/90 leading-relaxed max-w-2xl">
                {module.promise}
              </p>
            )}
            {module.intro && (
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
                {module.intro}
              </p>
            )}
          </section>

          <div className="bfa-divider mb-10" />

          {/* Steps */}
          <div className="space-y-14">
            {module.steps.map((step, i) => (
              <StepBlock key={step.id} step={step} index={i + 1} register={registerStep(step.id)} />
            ))}
          </div>

          {/* Graduation */}
          {module.graduation && (
            <section id="graduation" className="mt-16 scroll-mt-24 max-w-2xl">
              <p className="bfa-pill inline-flex">
                <GraduationCap className="h-3 w-3" /> Graduation
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mt-3 leading-tight">
                {module.graduation.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-prose">
                You're cleared for the next level when each of these is true — not when you think they look true on paper.
              </p>
              <div className="mt-5">
                <BlockRenderer block={{ kind: "checklist", items: module.graduation.items }} />
              </div>
            </section>
          )}

          {/* Continue / Done */}
          <section className="mt-14 pt-10 border-t border-border/40">
            <div className="bfa-card-strong p-6 sm:p-8 bfa-glow">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)] font-semibold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" /> When you&apos;re done with this module
                  </p>
                  <h3 className="font-display text-xl sm:text-2xl font-bold mt-2 leading-tight">
                    {nextModule
                      ? `Continue to ${nextModule.badge} — ${nextModule.title}.`
                      : `You've reached the end of the system.`}
                  </h3>
                  {nextModule?.subtitle && (
                    <p className="text-sm text-muted-foreground mt-1">{nextModule.subtitle}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {nextModule ? (
                    <Button asChild size="lg">
                      <Link href={`/training/${nextModule.id}`}>
                        Continue <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="lg">
                      <Link href="/training">
                        Back to the hub <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
              {prevModule ? (
                <Link
                  href={`/training/${prevModule.id}`}
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> {prevModule.badge}: {prevModule.title}
                </Link>
              ) : (
                <Link href="/training" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to training hub
                </Link>
              )}
              {nextModule && (
                <Link
                  href={`/training/${nextModule.id}`}
                  className="inline-flex items-center gap-1.5 text-[var(--gold)] hover:text-[var(--gold-soft)] transition font-semibold"
                >
                  {nextModule.badge}: {nextModule.title} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </AuthShell>
  );
}

function StepBlock({
  step,
  index,
  register,
}: {
  step: TrainingStep;
  index: number;
  register: (el: HTMLElement | null) => void;
}) {
  return (
    <article
      id={step.id}
      ref={register}
      className="scroll-mt-24 grid gap-5 sm:grid-cols-[80px_1fr]"
    >
      <div className="hidden sm:block">
        <div className="sticky top-28">
          <span className="font-display text-5xl font-bold text-[var(--gold)]/80 leading-none">
            {String(step.number ?? index).padStart(2, "0")}
          </span>
        </div>
      </div>
      <div className="space-y-5">
        {step.eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)] font-semibold">
            {step.eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
          {step.title}
        </h2>
        <div className="space-y-5">
          {step.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </article>
  );
}
