import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Filter,
  Loader2,
  Phone,
  PhoneCall,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, LEAD_STATUSES, leadStatusTone, type LeadStatus } from "@/components/ui/badge";
import { AuthShell } from "@/components/layout/auth-shell";
import { AddContactModal } from "@/components/dashboard/add-contact-modal";
import { TodayMoveCard } from "@/components/dashboard/today-move";
import { UpcomingEventsCard } from "@/components/dashboard/upcoming-events";
import { ColorBadge } from "@/components/lead/color-badge";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { Lead } from "@shared/schema";
import type { ColorCode } from "@shared/colorCode";
import { cn } from "@/lib/utils";

type Filter = "all" | LeadStatus;

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  engaged: "Engaged",
  handoff: "Handoff",
  customer: "Customer",
  lost: "Closed",
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // 'all' | 'funnel' | 'manual' | 'hundreds_list' — Source filter from
  // the 100-name list importer. Leads predating migration 0011 default to
  // 'funnel' via the resilient lead loader.
  const [sourceFilter, setSourceFilter] = useState<"all" | "funnel" | "manual" | "hundreds_list">("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const leadsQuery = useQuery<{ leads: Lead[] }>({
    queryKey: ["leads"],
    queryFn: () => api<{ leads: Lead[] }>("/api/leads"),
    enabled: !!partner,
  });

  const leads = leadsQuery.data?.leads ?? [];

  const counts = useMemo(() => {
    const acc: Record<LeadStatus, number> = {
      new: 0,
      qualified: 0,
      engaged: 0,
      handoff: 0,
      customer: 0,
      lost: 0,
    };
    for (const lead of leads) {
      const s = lead.status as LeadStatus;
      if (s in acc) acc[s] += 1;
    }
    return acc;
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (sourceFilter !== "all") {
        const leadSource = (l as { source?: string }).source ?? "funnel";
        if (leadSource !== sourceFilter) return false;
      }
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, filter, sourceFilter, search]);

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
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

  const profileIncomplete = !partner.photoUrl || !partner.bio;
  const total = leads.length;
  const newCount = counts.new;
  const liveCount = counts.qualified + counts.engaged + counts.handoff;

  return (
    <AuthShell>
      <section className="bfa-animate-in mb-6">
        <p className="bfa-pill">Dashboard</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-3">
          Welcome back, <span className="text-[var(--gold)]">{partner.name.split(" ")[0]}</span>.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
          {total === 0
            ? "No leads yet. Share your funnel link and they'll start landing here."
            : `${total} ${total === 1 ? "lead is" : "leads are"} in your pipeline. ${newCount > 0 ? `${newCount} need a first touch.` : "All current leads have been triaged."}`}
        </p>
      </section>

      <SubscriptionBanner status={partner.subscriptionStatus} isAdmin={partner.isAdmin} />

      <TodayMoveCard />

      <UpcomingEventsCard />

      {profileIncomplete && (
        <div className="bfa-card-strong p-5 mb-6 flex items-start gap-3 bfa-glow">
          <Sparkles className="h-5 w-5 text-[var(--gold)] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Your funnel is missing your face.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Partners with a real photo and bio convert ~3x better than the placeholder. Two minutes in Settings.
            </p>
          </div>
          <Button asChild size="sm" variant="primary">
            <Link href="/settings">Finish profile <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <article className="bfa-card-strong p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your funnel</p>
            <Link href={`/${partner.slug}`} className="text-[var(--gold)] text-xs inline-flex items-center gap-1 hover:underline">
              Open <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="font-display text-base sm:text-lg truncate">{funnelUrl}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" size="sm" onClick={copyLink}>
              {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a href={funnelUrl} target="_blank" rel="noopener noreferrer">Preview</a>
            </Button>
          </div>
        </article>

        <article className="bfa-card p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Pipeline at a glance</p>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total" value={total} />
            <Stat label="New" value={newCount} accent={newCount > 0} />
            <Stat label="Active" value={liveCount} />
          </div>
        </article>
      </div>

      <div className="bfa-card mb-4">
        <div className="p-4 sm:p-5 border-b border-border/40 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--gold)]" />
            <h2 className="font-display text-lg font-bold">Leads</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 text-sm sm:w-64"
            />
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add contact
            </Button>
          </div>
        </div>

        <div className="border-b border-border/30 flex items-center gap-2 overflow-x-auto px-4 sm:px-5 py-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
          <FilterChip label="All" count={total} active={filter === "all"} onClick={() => setFilter("all")} />
          {LEAD_STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={STATUS_LABEL[s]}
              count={counts[s]}
              active={filter === s}
              tone={s}
              onClick={() => setFilter(s)}
            />
          ))}
          <Filter className="h-3 w-3 text-muted-foreground ml-2 shrink-0" />
        </div>

        {/* Source filter row — separate axis from status. Lights up when a
            non-default selection is active so the partner can see they're
            looking at a filtered view. */}
        <div className="border-b border-border/30 flex items-center gap-2 overflow-x-auto px-4 sm:px-5 py-2.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0 mr-1">Source</span>
          <SourceChip label="All" active={sourceFilter === "all"} onClick={() => setSourceFilter("all")} />
          <SourceChip label="Funnel" active={sourceFilter === "funnel"} onClick={() => setSourceFilter("funnel")} />
          <SourceChip label="Manual" active={sourceFilter === "manual"} onClick={() => setSourceFilter("manual")} />
          <SourceChip label="100-list" active={sourceFilter === "hundreds_list"} onClick={() => setSourceFilter("hundreds_list")} />
        </div>

        {leadsQuery.isPending ? (
          <div className="p-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)] inline" />
          </div>
        ) : visibleLeads.length === 0 ? (
          <EmptyLeads
            total={total}
            filterActive={filter !== "all" || !!search.trim()}
            onAdd={() => setAddOpen(true)}
            funnelUrl={funnelUrl}
          />
        ) : (
          <ul className="divide-y divide-border/30">
            {visibleLeads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </ul>
        )}
      </div>

      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
      />
    </AuthShell>
  );
}

function SubscriptionBanner({ status, isAdmin }: { status: string; isAdmin: boolean }) {
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (isAdmin) return null;
  if (status === "active" || status === "trialing") return null;

  const isPastDue = status === "past_due" || status === "unpaid";

  // Subscribe button: POST /api/billing/checkout and redirect to the Stripe
  // hosted checkout URL directly. Past-due partners go to the billing portal
  // instead so they can update the card on the live subscription.
  // Fallback to /settings if the call fails for any reason so the partner
  // is never stranded.
  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const endpoint = isPastDue ? "/api/billing/portal" : "/api/billing/checkout";
      const data = await api<{ url?: string }>(endpoint, { method: "POST" });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setLocation("/settings");
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError("Billing isn't configured yet.");
      } else if (e instanceof ApiError && e.status === 400 && isPastDue) {
        // No customer yet — fall through to checkout to create one.
        try {
          const data = await api<{ url?: string }>("/api/billing/checkout", { method: "POST" });
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        } catch {
          /* fall through */
        }
        setLocation("/settings");
      } else {
        setError(e instanceof ApiError ? e.message : "Couldn't open checkout. Try Settings.");
        window.setTimeout(() => setLocation("/settings"), 2000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "mb-6 rounded-2xl border p-5 flex items-start gap-3",
        isPastDue
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-[var(--gold)]/35 bg-[var(--gold)]/8",
      )}
    >
      {isPastDue ? (
        <AlertCircle className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
      ) : (
        <CreditCard className="h-5 w-5 text-[var(--gold)] mt-0.5 shrink-0" />
      )}
      <div className="flex-1">
        <p className="font-semibold">
          {isPastDue ? "Your last payment didn't go through." : "Activate your subscription."}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isPastDue
            ? "Update your card to keep the funnel, dashboard, and follow-up engine running."
            : "$14.95/mo unlocks the platform — your live funnel, lead pipeline, and the auto-follow-up engine. Cancel any time."}
        </p>
        {error && <p className="text-xs text-amber-300 mt-2">{error}</p>}
      </div>
      <Button size="sm" variant="primary" onClick={() => void go()} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isPastDue ? "Update billing" : "Subscribe"}
      </Button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn("font-display text-3xl font-bold", accent && value > 0 && "text-[var(--gold)]")}>{value}</p>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: LeadStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition border",
        active
          ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40"
          : "bg-transparent text-muted-foreground border-border/50 hover:bg-secondary/40 hover:text-foreground",
      )}
    >
      {label}
      <span className="text-[10px] opacity-70">{count}</span>
    </button>
  );
}

function SourceChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold transition border",
        active
          ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40"
          : "bg-transparent text-muted-foreground border-border/50 hover:bg-secondary/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const status = lead.status as LeadStatus;
  const created = new Date(lead.createdAt);
  const ago = relativeTime(created);

  return (
    <li>
      <Link
        href={`/dashboard/leads/${lead.id}`}
        className="flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-secondary/30 transition group"
      >
        <div className="h-10 w-10 rounded-full bg-secondary/60 grid place-items-center font-semibold text-sm text-[var(--gold)] shrink-0">
          {lead.name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("") || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{lead.name}</p>
            <Badge tone={leadStatusTone(status)}>{STATUS_LABEL[status] ?? status}</Badge>
            <ColorBadge color={lead.colorCode as ColorCode | null} variant="chip" />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.email}</p>
          {lead.phone && (
            <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {lead.phone}
            </p>
          )}
        </div>
        <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
          <p className="text-xs text-muted-foreground">{ago}</p>
          {lead.bestTime && (
            <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[16ch] truncate" title={lead.bestTime}>
              {lead.bestTime}
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-[var(--gold)] transition" />
      </Link>
    </li>
  );
}

function EmptyLeads({
  total,
  filterActive,
  onAdd,
  funnelUrl,
}: {
  total: number;
  filterActive: boolean;
  onAdd: () => void;
  funnelUrl: string;
}) {
  if (filterActive) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground text-sm">No leads match this filter.</p>
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className="p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-[var(--gold)]/15 grid place-items-center mb-4">
          <PhoneCall className="h-5 w-5 text-[var(--gold)]" />
        </div>
        <h3 className="font-display text-xl">Your first lead is one share away.</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Drop your funnel link in your stories, in a DM to one person, or in your text signature. Then watch this page light up.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild>
            <a href={funnelUrl} target="_blank" rel="noopener noreferrer">Preview your funnel</a>
          </Button>
          <Button variant="secondary" onClick={onAdd}>
            <UserPlus className="h-4 w-4" /> Add a contact manually
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="p-10 text-center">
      <p className="text-muted-foreground text-sm">No leads to show.</p>
    </div>
  );
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
