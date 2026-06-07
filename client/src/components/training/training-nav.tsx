import { useEffect, useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrainingModule } from "@/data/trainingContent";

interface Props {
  modules: TrainingModule[];
  activeId: string;
}

export function TrainingNav({ modules, activeId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close mobile drawer on resize to desktop or on hash change
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setDrawerOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function jumpTo(id: string) {
    setDrawerOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open training menu"
        className="lg:hidden inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/35 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)] sticky top-20 z-20 ml-5 sm:ml-8"
      >
        <Menu className="h-3.5 w-3.5" /> Modules
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block sticky top-24 self-start w-[260px] shrink-0">
        <NavInner modules={modules} activeId={activeId} jumpTo={jumpTo} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#040d18]/80 backdrop-blur-md"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="relative ml-auto h-full w-[78vw] max-w-[300px] bg-background border-l border-border/60 p-5 overflow-y-auto bfa-animate-in">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)] mb-5">
              Build From Anywhere System
            </p>
            <NavInner modules={modules} activeId={activeId} jumpTo={jumpTo} />
          </div>
        </div>
      )}
    </>
  );
}

function NavInner({
  modules,
  activeId,
  jumpTo,
}: {
  modules: TrainingModule[];
  activeId: string;
  jumpTo: (id: string) => void;
}) {
  return (
    <nav aria-label="Training modules" className="space-y-1">
      {modules.map((module) => {
        const active = activeId === module.id;
        return (
          <button
            key={module.id}
            type="button"
            onClick={() => jumpTo(module.id)}
            className={cn(
              "group w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition text-sm",
              active
                ? "bg-[var(--gold)]/12 text-foreground ring-1 ring-[var(--gold)]/35"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
            )}
            aria-current={active ? "true" : undefined}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0 transition",
                active ? "bg-[var(--gold)]" : "bg-muted-foreground/40 group-hover:bg-[var(--gold)]/70",
              )}
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] uppercase tracking-[0.22em] text-[var(--gold)]/80 leading-tight">
                {module.badge}
              </span>
              <span className="block font-semibold leading-snug truncate">{module.title}</span>
            </span>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition",
                active ? "text-[var(--gold)] translate-x-0.5" : "text-muted-foreground/40",
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const value = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
      setProgress(value);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className="fixed top-0 inset-x-0 z-40 h-[2px] bg-transparent pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full transition-[width] duration-100"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--gold-soft), var(--gold-deep))",
        }}
      />
    </div>
  );
}
