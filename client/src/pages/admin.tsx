import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  KeyRound,
  Loader2,
  Mail,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge, leadStatusTone, type LeadStatus } from "@/components/ui/badge";
import { AuthShell, Section } from "@/components/layout/auth-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

interface AdminPartner {
  id: number;
  email: string;
  name: string;
  slug: string;
  subscriptionStatus: string;
  isAdmin: boolean;
  createdAt: string;
  stripeCustomerId: string | null;
  leadCount: number;
}

interface AdminLead {
  id: number;
  partnerId: number;
  partnerName: string | null;
  partnerSlug: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  interest: string | null;
  createdAt: string;
}

interface AdminStats {
  partners: number;
  activePartners: number;
  leads: number;
  leadsLast7d: number;
}

const SUB_STATUSES = ["active", "inactive", "past_due", "canceled", "trialing", "unpaid", "incomplete"] as const;

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const [tab, setTab] = useState<"partners" | "leads">("partners");

  useEffect(() => {
    if (loading) return;
    if (!partner) {
      setLocation("/login");
      return;
    }
    if (!partner.isAdmin) {
      setLocation("/dashboard");
    }
  }, [loading, partner, setLocation]);

  const statsQuery = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => api<AdminStats>("/api/admin/stats"),
    enabled: !!partner?.isAdmin,
  });

  if (loading || !partner?.isAdmin) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  return (
    <AuthShell title="Admin" subtitle="Platform-wide insight. Partners, subscriptions, lead volume.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        <StatCard label="Partners" value={statsQuery.data?.partners} />
        <StatCard label="Active subs" value={statsQuery.data?.activePartners} accent />
        <StatCard label="Total leads" value={statsQuery.data?.leads} />
        <StatCard label="Leads · 7d" value={statsQuery.data?.leadsLast7d} accent />
      </div>

      <div className="flex items-center gap-1 mb-4">
        <TabBtn active={tab === "partners"} onClick={() => setTab("partners")} icon={Users}>
          Partners
        </TabBtn>
        <TabBtn active={tab === "leads"} onClick={() => setTab("leads")} icon={TrendingUp}>
          All leads
        </TabBtn>
      </div>

      {tab === "partners" ? <PartnersTab currentPartnerId={partner.id} /> : <LeadsTab />}
    </AuthShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value?: number; accent?: boolean }) {
  return (
    <div className="bfa-card-flat px-4 py-3.5">
      <p className="bfa-eyebrow truncate">{label}</p>
      <p className={`font-display text-2xl sm:text-[26px] leading-tight font-bold mt-1.5 tabular-nums ${accent ? "text-[var(--gold)]" : ""}`}>
        {value ?? <Loader2 className="h-5 w-5 inline animate-spin" />}
      </p>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Users; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className="bfa-nav-item"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function PartnersTab({ currentPartnerId }: { currentPartnerId: number }) {
  const queryClient = useQueryClient();
  const partnersQuery = useQuery<{ partners: AdminPartner[] }>({
    queryKey: ["admin", "partners"],
    queryFn: () => api<{ partners: AdminPartner[] }>("/api/admin/partners"),
  });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminPartner | null>(null);

  const rows = partnersQuery.data?.partners ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "partners"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
  }

  return (
    <div className="bfa-card">
      <div className="p-4 sm:p-5 border-b border-border/40 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-bold inline-flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--gold)]" /> Partners
        </h2>
        <Input
          placeholder="Search name, email, slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 text-sm sm:w-72"
        />
      </div>

      {partnersQuery.isPending ? (
        <div className="p-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--gold)] inline" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground text-sm">No partners match.</div>
      ) : (
        <ul className="divide-y divide-border/30">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setEditing(p)}
                className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-secondary/30 transition text-left"
              >
                <div className="h-10 w-10 rounded-full bg-secondary/60 grid place-items-center font-semibold text-sm text-[var(--gold)] shrink-0">
                  {p.name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{p.name}</p>
                    {p.isAdmin && <Badge tone="handoff">Admin</Badge>}
                    <SubBadge status={p.subscriptionStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {p.email} · /{p.slug}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
                  <p className="text-sm font-semibold">{p.leadCount} {p.leadCount === 1 ? "lead" : "leads"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PartnerManageDialog
          partner={editing}
          currentPartnerId={currentPartnerId}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function SubBadge({ status }: { status: string }) {
  const tone =
    status === "active" || status === "trialing"
      ? "customer"
      : status === "past_due" || status === "unpaid"
        ? "new"
        : status === "canceled" || status === "incomplete_expired"
          ? "lost"
          : "muted";
  return <Badge tone={tone}>{status}</Badge>;
}

function PartnerManageDialog({
  partner,
  currentPartnerId,
  onClose,
  onChanged,
}: {
  partner: AdminPartner;
  currentPartnerId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(partner.subscriptionStatus);
  const [email, setEmail] = useState(partner.email);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function go(op: string) {
    setBusy(op);
    setError(null);
    setOk(null);
  }
  function done(message: string) {
    setBusy(null);
    setOk(message);
    window.setTimeout(() => setOk(null), 2000);
    onChanged();
  }
  function fail(e: unknown) {
    setBusy(null);
    setError(e instanceof ApiError ? e.message : "Operation failed");
  }

  async function saveStatus() {
    if (status === partner.subscriptionStatus) {
      onClose();
      return;
    }
    go("status");
    try {
      await api(`/api/admin/partners/${partner.id}/subscription`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      done("Subscription updated");
    } catch (e) {
      fail(e);
    }
  }

  async function saveEmail() {
    if (email === partner.email) return;
    go("email");
    try {
      await api(`/api/admin/partners/${partner.id}/update-email`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      done("Email updated");
    } catch (e) {
      fail(e);
    }
  }

  async function resetPassword() {
    go("password");
    try {
      await api(`/api/admin/partners/${partner.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      setNewPassword("");
      done("Password reset");
    } catch (e) {
      fail(e);
    }
  }

  async function deletePartner() {
    go("delete");
    try {
      await api(`/api/admin/partners/${partner.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e) {
      fail(e);
    }
  }

  const isSelf = partner.id === currentPartnerId;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{partner.name}</DialogTitle>
          <DialogDescription>{partner.email} · /{partner.slug}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label>Subscription status</Label>
            <div className="flex gap-2">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1">
                {SUB_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Button size="sm" onClick={saveStatus} disabled={busy === "status"}>
                {busy === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <div className="flex gap-2">
              <Input id="admin-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="flex-1" />
              <Button size="sm" variant="secondary" onClick={saveEmail} disabled={busy === "email" || email === partner.email}>
                {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-3.5 w-3.5" /> Update</>}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Set new password</Label>
            <div className="flex gap-2">
              <Input
                id="admin-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="text"
                placeholder="At least 8 characters"
                minLength={8}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={resetPassword}
                disabled={busy === "password" || newPassword.length < 8}
              >
                {busy === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-3.5 w-3.5" /> Reset</>}
              </Button>
            </div>
          </div>

          {!isSelf && (
            <div className="pt-3 border-t border-border/40">
              <p className="text-xs uppercase tracking-[0.18em] text-destructive-foreground/80 mb-2 inline-flex items-center gap-2">
                <ShieldAlert className="h-3 w-3" /> Danger zone
              </p>
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-xs">Deletes the partner and all their leads. Permanent.</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={deletePartner} disabled={busy === "delete"}>
                      {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, delete"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive-foreground/90">
                  <Trash2 className="h-3.5 w-3.5" /> Delete partner
                </Button>
              )}
            </div>
          )}

          {ok && <p className="text-sm text-emerald-300">{ok}</p>}
          {error && (
            <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadsTab() {
  const leadsQuery = useQuery<{ leads: AdminLead[] }>({
    queryKey: ["admin", "leads"],
    queryFn: () => api<{ leads: AdminLead[] }>("/api/admin/leads"),
  });
  const [search, setSearch] = useState("");
  const rows = leadsQuery.data?.leads ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.partnerName ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="bfa-card">
      <div className="p-4 sm:p-5 border-b border-border/40 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-bold inline-flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--gold)]" /> All leads — last 500
        </h2>
        <Input
          placeholder="Search lead or partner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 text-sm sm:w-72"
        />
      </div>

      {leadsQuery.isPending ? (
        <div className="p-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--gold)] inline" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground text-sm">No leads yet.</div>
      ) : (
        <ul className="divide-y divide-border/30">
          {filtered.map((l) => (
            <li key={l.id}>
              <Link
                href={`/dashboard/leads/${l.id}`}
                className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-secondary/30 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{l.name}</p>
                    <Badge tone={leadStatusTone(l.status)}>{l.status}</Badge>
                    {l.interest && <Badge tone="muted">{l.interest}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {l.email} {l.phone ? ` · ${l.phone}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    via {l.partnerName ?? "—"} (/{l.partnerSlug ?? "—"})
                  </p>
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block shrink-0">
                  {new Date(l.createdAt).toLocaleDateString()}
                </p>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
