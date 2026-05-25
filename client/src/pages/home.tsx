import { Link } from "wouter";
import { ArrowRight, LogIn, Sparkles, UserPlus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="px-5 sm:px-8 pt-6 flex items-center justify-between bfa-animate-in">
        <BrandMark />
        <Button asChild variant="ghost" size="sm">
          <Link href="/login"><LogIn className="h-4 w-4" /> Sign in</Link>
        </Button>
      </header>

      <section className="flex-1 grid place-items-center px-5 sm:px-8 py-12 bfa-animate-in">
        <div className="max-w-2xl text-center">
          <p className="bfa-pill mx-auto">Partner platform</p>
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight mt-5 leading-[1.05]">
            Your <span className="text-[var(--gold)]">global asset</span>, built from your phone.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            BFA gives every partner a branded squeeze funnel, a private dashboard, and an auto-follow-up engine
            that writes in your voice. Phone-first. Always on.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="xl">
              <Link href="/register">
                <UserPlus className="h-5 w-5" /> Claim your page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="xl">
              <Link href="/login">Partner sign in</Link>
            </Button>
          </div>

          <p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 flex items-center justify-center gap-2">
            <Sparkles className="h-3 w-3 text-[var(--gold)]" />
            Milestone 1 · Foundation + funnel + auth
          </p>
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/70">
        © {new Date().getFullYear()} Build From Anywhere
      </footer>
    </main>
  );
}
