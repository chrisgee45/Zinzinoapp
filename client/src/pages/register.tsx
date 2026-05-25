import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

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
      setLocation("/dashboard");
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
            Pick a slug. We&apos;ll spin up your funnel and dashboard.
          </p>

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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Create account</>}
            </Button>
            <p className="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
              Subscription & billing activate in Milestone 2
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
