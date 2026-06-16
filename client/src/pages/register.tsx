import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedSlug = useMemo(() => (slugTouched ? slug : slugify(name)), [slug, slugTouched, name]);
  const publicUrl = useMemo(
    () => `buildfromanywhere.com/${derivedSlug || "your-slug"}`,
    [derivedSlug],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        slug: derivedSlug,
      });
      // Immediately kick to Stripe checkout for the $14.95/mo subscription.
      // Stripe will return to /dashboard?subscribed=1 on success or
      // /settings?billing=cancelled if they back out.
      try {
        const data = await api<{ url?: string }>("/api/billing/checkout", { method: "POST" });
        if (data.url) {
          window.location.href = data.url;
          return; // don't unset submitting — let the redirect happen
        }
        // No URL returned (shouldn't happen) — fall through to dashboard.
        setLocation("/dashboard");
      } catch (checkoutErr) {
        // If billing isn't configured (503), still let them in. The
        // dashboard banner will surface 'subscribe now' on its own.
        if (checkoutErr instanceof ApiError && checkoutErr.status === 503) {
          setLocation("/dashboard");
        } else {
          setError(
            checkoutErr instanceof ApiError
              ? `Account created but couldn't open checkout: ${checkoutErr.message}. You can subscribe from Settings.`
              : "Account created. Open Settings to subscribe.",
          );
          // Account exists, give them a beat to read the message then route.
          window.setTimeout(() => setLocation("/dashboard"), 2400);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center px-5 py-12">
      <div className="w-full max-w-md bfa-animate-in">
        <Link href="/" className="flex justify-center mb-8">
          <BrandMark />
        </Link>
        <div className="bfa-card-strong p-7 sm:p-9">
          <h1 className="font-display text-3xl font-bold tracking-tight">Claim your partner page.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a slug. Next stop is checkout — <span className="text-foreground font-semibold">$14.95/month</span>, cancel anytime from Settings.
          </p>

          <div className="mt-5 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-3.5 text-xs text-foreground/85 leading-relaxed">
            <p className="inline-flex items-center gap-1.5 font-semibold text-[var(--gold)] mb-1">
              <ShieldCheck className="h-3.5 w-3.5" /> What you get
            </p>
            Your branded funnel at <span className="text-foreground font-semibold">buildfromanywhere.com/{derivedSlug || "your-slug"}</span>,
            CRM with the AI follow-up bot, color-coded lead routing, calendar with email + push reminders, training library, and the Shadow Partner coaching engine. Card stays in Stripe — we never see it.
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Avery"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Your public slug</Label>
              <Input
                id="slug"
                required
                value={derivedSlug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugTouched(true);
                }}
                placeholder="jordan"
              />
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 pt-1">
                {publicUrl}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="h-4 w-4" /> Create account &amp; continue to checkout
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
              Secure checkout by Stripe · Cancel anytime
            </p>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already onboard?{" "}
            <Link href="/login" className="text-[var(--gold)] hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
