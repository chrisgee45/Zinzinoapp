import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  BellOff,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/lib/auth";
import {
  isStandalone,
  onInstallAvailable,
  promptInstall,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pwa";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { partner, loading, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "loading" | "on" | "off">("idle");
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  useEffect(() => onInstallAvailable(setInstallAvailable), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushState(sub ? "on" : "off"))
      .catch(() => setPushState("off"));
  }, []);

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </main>
    );
  }

  const funnelUrl = `${window.location.origin}/${partner.slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(funnelUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  }

  async function togglePush() {
    setPushError(null);
    if (pushState === "on") {
      setPushState("loading");
      await unsubscribeFromPush();
      setPushState("off");
      return;
    }
    setPushState("loading");
    const result = await subscribeToPush();
    if (result.ok) {
      setPushState("on");
    } else {
      setPushState("off");
      setPushError(result.reason ?? "Couldn't enable notifications.");
    }
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === "accepted") setInstallAvailable(false);
  }

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="px-5 sm:px-8 py-4 border-b border-border/40 flex items-center justify-between sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <BrandMark />
        <Button variant="ghost" size="sm" onClick={() => { logout(); setLocation("/login"); }}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <section className="px-5 sm:px-8 pt-8 pb-6 max-w-5xl mx-auto w-full bfa-animate-in">
        <p className="bfa-pill">Dashboard</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-3">
          Welcome back, <span className="text-[var(--gold)]">{partner.name.split(" ")[0]}</span>.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Your funnel is live. Pipeline, coaching, and the auto-follow-up engine arrive in the next milestone.
        </p>
      </section>

      <section className="px-5 sm:px-8 pb-8 max-w-5xl mx-auto w-full grid gap-4 sm:grid-cols-2">
        <article className="bfa-card-strong p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your funnel</p>
            <Link href={`/${partner.slug}`} className="text-[var(--gold)] text-xs inline-flex items-center gap-1 hover:underline">
              Open <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="font-display text-xl truncate">{funnelUrl}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" size="sm" onClick={copyLink} className="flex-1 sm:flex-none">
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a href={funnelUrl} target="_blank" rel="noopener noreferrer">Preview</a>
            </Button>
          </div>
        </article>

        <article className="bfa-card p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Install &amp; alerts</p>
          <div className="space-y-3">
            {!isStandalone() && installAvailable && (
              <Button variant="secondary" size="sm" onClick={handleInstall} className="w-full justify-start">
                <Smartphone className="h-4 w-4" /> Install BFA on this device
              </Button>
            )}
            <Button
              variant={pushState === "on" ? "primary" : "secondary"}
              size="sm"
              onClick={togglePush}
              disabled={pushState === "loading"}
              className="w-full justify-start"
            >
              {pushState === "on" ? (
                <>
                  <Bell className="h-4 w-4" /> Push notifications on
                </>
              ) : (
                <>
                  <BellOff className="h-4 w-4" /> Enable push notifications
                </>
              )}
            </Button>
            {pushError && (
              <p className="text-xs text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {pushError}
              </p>
            )}
            {isStandalone() && (
              <p className="text-xs text-muted-foreground/80">Running as an installed app · offline shell ready.</p>
            )}
          </div>
        </article>
      </section>

      <section className="px-5 sm:px-8 pb-12 max-w-5xl mx-auto w-full">
        <div className="bfa-card p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[var(--gold)] mt-1" />
            <div>
              <h2 className="font-display text-xl sm:text-2xl">What&apos;s coming next</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Milestone 2 wires up the bot follow-up engine, Shadow Partner coaching, Stripe billing, and the admin panel.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-xl bg-secondary/40 p-4">
              <Users className="h-4 w-4 text-[var(--gold)] mb-2" />
              <p className="font-semibold">Lead pipeline</p>
              <p className="text-xs text-muted-foreground mt-1">Triage, notes, status, manual contacts.</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-4">
              <TrendingUp className="h-4 w-4 text-[var(--gold)] mb-2" />
              <p className="font-semibold">Auto follow-up</p>
              <p className="text-xs text-muted-foreground mt-1">Warm + cold sequences written in your voice.</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-4">
              <Sparkles className="h-4 w-4 text-[var(--gold)] mb-2" />
              <p className="font-semibold">Shadow Partner</p>
              <p className="text-xs text-muted-foreground mt-1">One smart move every day. No noise.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border/40 py-5 text-center text-xs text-muted-foreground/70">
        BFA partner dashboard · Milestone 1 shell
      </footer>
    </main>
  );
}
