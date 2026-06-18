import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The inputs are uncontrolled and read directly from the form on
  // submit. iOS Safari's keychain autofill populates the DOM without
  // firing React's `onChange` reliably — a controlled value={state}
  // setup ends up clamping the DOM back to "" before submit, which
  // is exactly the "saved password kicks the first attempt" bug.
  // Reading from the form via FormData captures whatever the browser
  // actually filled in, autofill or typed.
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      setLocation("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
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
          <h1 className="font-display text-3xl font-bold tracking-tight">Partner sign in.</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back. Pick up where you left off.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[var(--gold)] hover:underline underline-offset-4"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4" /> Sign in</>}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            New here?{" "}
            <Link href="/register" className="text-[var(--gold)] hover:underline underline-offset-4">
              Create your partner account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
