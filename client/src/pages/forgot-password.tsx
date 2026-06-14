import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        auth: false,
      });
      // Server always returns 200 (no enumeration). Show success regardless.
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't request a reset right now.");
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
          {submitted ? (
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/40 grid place-items-center mx-auto mb-4">
                <Mail className="h-7 w-7 text-[var(--gold)]" />
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight">Check your email.</h1>
              <p className="text-sm text-foreground/80 mt-3 leading-relaxed">
                If <span className="font-semibold text-foreground">{email}</span> matches a partner account, a reset link is on its way. The link expires in 60 minutes.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Don&apos;t see it? Check spam, or wait a minute and try again. If the address you entered isn&apos;t the one on your account, this won&apos;t arrive.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold tracking-tight">Reset your password.</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Drop in the email on your account. We&apos;ll send a one-time link to set a new password.
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send reset link</>}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Remembered it?{" "}
                <Link href="/login" className="text-[var(--gold)] hover:underline underline-offset-4">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
