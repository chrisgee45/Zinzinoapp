import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { api, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (newPassword.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
        auth: false,
      });
      setDone(true);
      window.setTimeout(() => setLocation("/login"), 1800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset password.");
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
          {!token ? (
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold">This link is missing its token.</h1>
              <p className="text-sm text-muted-foreground mt-2">
                The reset email contains a full link with a token in the URL. Open it directly, or request a fresh one.
              </p>
              <Link
                href="/forgot-password"
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:underline"
              >
                Request a new reset link
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/40 grid place-items-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-[var(--gold)]" />
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight">Password updated.</h1>
              <p className="text-sm text-foreground/80 mt-3 leading-relaxed">
                Taking you back to sign in&hellip;
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold tracking-tight">Pick a new password.</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Make it 8 characters or more. The link expires in 60 minutes from when you requested it.
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Save new password</>}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Changed your mind?{" "}
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
