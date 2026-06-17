import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2, Mail, MailCheck, MailX, UserPlus } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Tile } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string;
  aiPaused: boolean;
  emailConsent: boolean;
  welcomeSentAt: string | null;
  lastDripAt: string | null;
  introducedProducts: string[];
  createdAt: string;
}

export default function CustomersPage() {
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const q = useQuery<{ customers: Customer[] }>({
    queryKey: ["customers"],
    queryFn: () => api<{ customers: Customer[] }>("/api/customers"),
    enabled: !!partner,
  });
  const customers = q.data?.customers ?? [];

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  const welcomed = customers.filter((c) => c.welcomeSentAt).length;
  const pending = customers.filter((c) => !c.welcomeSentAt && !c.aiPaused).length;
  const paused = customers.filter((c) => c.aiPaused).length;

  return (
    <AuthShell title="Customers" subtitle="Post-sale care. The AI sends a warm welcome on add and a friendly check-in roughly every 30 days, rotating through products they haven't tried yet.">
      {customers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 sm:mb-5">
          <Tile label="Total" value={customers.length} />
          <Tile label="Welcomed" value={welcomed} tone={welcomed > 0 ? "success" : "default"} />
          <Tile label="Pending welcome" value={pending} tone={pending > 0 ? "accent" : "default"} />
          <Tile label="AI paused" value={paused} tone={paused > 0 ? "warning" : "default"} />
        </div>
      )}

      <article className="bfa-card mb-4 overflow-hidden">
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between gap-3"
          style={{ borderColor: "var(--border-muted)" }}
        >
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-[var(--gold)]" />
            <h2 className="font-display text-base sm:text-lg font-bold">Your customers</h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">({customers.length})</span>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add customer
          </Button>
        </div>

        {q.isPending ? (
          <div className="p-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)] inline" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-5 w-5" />}
            title="No customers yet."
            description="Add your first one. The Customer-Care AI sends a warm welcome on add and a friendly check-in roughly every 30 days."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" /> Add your first customer
              </Button>
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-[rgb(var(--overlay-rgb)/0.03)] transition group"
                >
                  <div
                    className="h-10 w-10 rounded-full grid place-items-center font-semibold text-sm shrink-0"
                    style={{
                      background: "color-mix(in oklab, var(--gold) 14%, transparent)",
                      color: "var(--gold)",
                      border: "1px solid var(--border-gold)",
                    }}
                  >
                    {c.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold truncate text-[14px]">{c.name}</p>
                      {c.aiPaused ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            background: "rgba(245,158,11,0.12)",
                            border: "1px solid rgba(245,158,11,0.40)",
                            color: "var(--warning)",
                          }}
                        >
                          <MailX className="h-3 w-3" /> AI paused
                        </span>
                      ) : c.welcomeSentAt ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            background: "rgba(34,197,94,0.12)",
                            border: "1px solid rgba(34,197,94,0.40)",
                            color: "var(--success)",
                          }}
                        >
                          <MailCheck className="h-3 w-3" /> Welcomed
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            background: "rgb(var(--overlay-rgb) / 0.05)",
                            border: "1px solid var(--border-muted)",
                            color: "rgb(148 163 184)",
                          }}
                        >
                          <Mail className="h-3 w-3" /> Pending welcome
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate mt-0.5">{c.email}</p>
                    {c.introducedProducts.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                        Introduced: {c.introducedProducts.slice(-3).join(" · ")}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <AddCustomerModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
      />
    </AuthShell>
  );
}

function AddCustomerModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [sendWelcome, setSendWelcome] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setSendWelcome(true);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          notes: notes.trim(),
          sendWelcome,
        }),
      });
      onCreated();
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a customer</DialogTitle>
          <DialogDescription>
            Someone who's already bought. The AI will send a warm welcome (if enabled) and then a no-pressure monthly check-in introducing a new product each time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Name</Label>
              <Input id="cust-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">Email</Label>
              <Input id="cust-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-phone">Phone (optional)</Label>
            <Input id="cust-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-notes">Notes (private)</Label>
            <Textarea id="cust-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border bg-secondary/30 p-3 hover:bg-secondary/50 transition">
            <input
              type="checkbox"
              checked={sendWelcome}
              onChange={(e) => setSendWelcome(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--gold)]"
            />
            <div>
              <p className="font-semibold text-sm">Send the welcome email now</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                A short, warm thank-you. No upsell. You can disable this and send it manually later.
              </p>
            </div>
          </label>
          {error && (
            <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Add customer</>}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
