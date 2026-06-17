import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Filter,
  Loader2,
  MessageCircle,
  Phone,
  PhoneCall,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, LEAD_STATUSES, leadStatusTone, type LeadStatus } from "@/components/ui/badge";
import { AuthShell } from "@/components/layout/auth-shell";
import { EmptyState, Tile } from "@/components/ui/primitives";
import { AddContactModal } from "@/components/dashboard/add-contact-modal";
import { ImportLeadsModal } from "@/components/dashboard/import-leads-modal";
import { TodayMoveCard } from "@/components/dashboard/today-move";
import { UpcomingEventsCard } from "@/components/dashboard/upcoming-events";
import { ColorBadge } from "@/components/lead/color-badge";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { Lead } from "@shared/schema";
import type { ColorCode } from "@shared/colorCode";
import { cn } from "@/lib/utils";

// Server enriches each lead with the timestamp of its most recent reply
// (null when the prospect hasn't replied). Kept loose here because the
// shared Lead type doesn't carry it.
type LeadWithReply = Lead & { lastReplyAt?: string | null };

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
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "funnel" | "manual" | "hundreds_list" | "internet_lead"
  >("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const leadsQuery = useQuery<{ leads: LeadWithReply[] }>({
    queryKey: ["leads"],
    queryFn: () => api<{ leads: LeadWithReply[] }>("/api/leads"),
    enabled: !!partner,
  });

  const leads = leadsQuery.data?.leads ?? [];

  const counts = useMemo(() => {
    const acc: Record<LeadStatus, number> = {
      new: 0, qualified: 0, engaged: 0, handoff: 0, customer: 0, lost: 0,
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
  const repliedCount = leads.reduce((n, l) => (l.lastReplyAt ? n + 1 : n), 0);

  // Tasteful, time-aware greeting. Doesn't need an API — pure window time.
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "You're up early" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AuthShell>
      <section className="bfa-animate-in mb-5">
        <p className="bfa-eyebrow">Dashboard</p>
        <h1 className="font-display text-[26px] sm:text-[34px] font-bold mt-2 leading-tight">
          {greeting}, <span className="text-[var(--gold)]">{partner.name.split(" ")[0]}</span>.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-[14px] sm:text-[15px]">
          {total === 0
            ? "No leads yet. Share your funnel link and they'll start landing here."
            : `${total} ${total === 1 ? "lead is" : "leads are"} in your pipeline. ${newCount > 0 ? `${newCount} ${newCount === 1 ? "needs" : "need"} a first touch.` : "All current leads have been triaged."}`}
        </p>
      </section>

      <SubscriptionBanner status={partner.subscriptionStatus} isAdmin={partner.isAdmin} />

      <TodayMoveCard />

      {/* Pipeline snapshot — uniform tiles. Replaces the prior ad-hoc Stat
          grid + funnel URL card with two equal-weight surfaces. */}
      <div className="grid lg:grid-cols-[1.1fr_2fr] gap-4 mb-5">
        <article className="bfa-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2.5">
            <p className="bfa-eyebrow">Your funnel</p>
            <Link href={`/${partner.slug}`} className="text-[var(--gold)] text-[11px] inline-flex items-center gap-1 hover:underline">
              Open <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="font-mono text-[13px] sm:text-[14px] truncate text-foreground/85">
            {funnelUrl}
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Button variant="primary" size="sm" onClick={copyLink}>
              {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a href={funnelUrl} target="_blank" rel="noopener noreferrer">Preview</a>
            </Button>
          </div>
        </article>

        <article className="bfa-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="bfa-eyebrow">Pipeline snapshot</p>
            <span className="text-[11px] text-muted-foreground">{total} total</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Tile label="Total" value={total} />
            <Tile label="New" value={newCount} tone={newCount > 0 ? "accent" : "default"} />
            <Tile label="Active" value={liveCount} />
            <Tile label="Replied" value={repliedCount} tone={repliedCount > 0 ? "success" : "default"} />
          </div>
        </article>
      </div>

      <UpcomingEventsCard />

      {profileIncomplete && (
        <article
          className="bfa-card p-5 mb-5 flex items-start gap-3.5"
          style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.06), transparent)",
            borderColor: "var(--border-gold)",
          }}
        >
          <Sparkles className="h-5 w-5 text-[var(--gold)] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Your funnel is missing your face.</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Partners with a real photo and bio convert ~3x better than the placeholder. Two minutes in Settings.
            </p>
          </div>
          <Button asChild size="sm" variant="primary">
            <Link href="/settings">Finish profile <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </article>
      )}

      {/* Leads workbench. Refined chrome: tighter filter rows, premium
          row hover, restrained badges. */}
      <article className="bfa-card mb-4 overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--gold)]" />
            <h2 className="font-display text-lg font-bold">Leads</h2>
            <span className="text-[11px] text-muted-foreground">({visibleLeads.length})</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              placeholder="Search by name, email or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 text-sm sm:w-64"
            />
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        <div
          className="border-t flex items-center gap-1.5 overflow-x-auto px-4 sm:px-5 py-2.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5"
          style={{ borderColor: "var(--border-muted)" }}
        >
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

        <div
          className="border-t flex items-center gap-1.5 overflow-x-auto px-4 sm:px-5 py-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5"
          style={{ borderColor: "var(--border-muted)" }}
        >
          <span className="bfa-eyebrow shrink-0 mr-1.5">Source</span>
          <SourceChip label="All" active={sourceFilter === "all"} onClick={() => setSourceFilter("all")} />
          <SourceChip label="Funnel" active={sourceFilter === "funnel"} onClick={() => setSourceFilter("funnel")} />
          <SourceChip label="Manual" active={sourceFilter === "manual"} onClick={() => setSourceFilter("manual")} />
          <SourceChip label="Internet" active={sourceFilter === "internet_lead"} onClick={() => setSourceFilter("internet_lead")} />
          <SourceChip label="100-list" active={sourceFilter === "hundreds_list"} onClick={() => setSourceFilter("hundreds_list")} />
        </div>

        {leadsQuery.isPending ? (
          <div className="p-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)] inline" />
          </div>
        ) : visibleLeads.length === 0 ? (
          <EmptyLeads
            total={total}
            filterActive={filter !== "all" || sourceFilter !== "all" || !!search.trim()}
            onAdd={() => setAddOpen(true)}
            funnelUrl={funnelUrl}
          />
        ) : (
          <>
            <div
              className="border-t px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-2"
              style={{ borderColor: "var(--border-muted)" }}
            >
              <label className="inline-flex items-center gap-2 text-xs text-foreground/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--gold)] cursor-pointer"
                  checked={selected.size > 0 && selected.size === visibleLeads.length}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selected.size > 0 && selected.size < visibleLeads.length;
                    }
                  }}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(visibleLeads.map((l) => l.id)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                />
                {selected.size === 0
                  ? `Select all (${visibleLeads.length})`
                  : `${selected.size} selected`}
              </label>
              {selected.size > 0 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                  <div className="ml-auto inline-flex items-center gap-2">
                    {confirmBulkDelete ? (
                      <>
                        <span className="text-xs text-foreground/80">
                          Delete {selected.size}?
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={bulkBusy}
                          onClick={async () => {
                            if (bulkBusy) return;
                            setBulkBusy(true);
                            try {
                              const ids = Array.from(selected);
                              await api("/api/leads/bulk-delete", {
                                method: "POST",
                                body: JSON.stringify({ ids }),
                              });
                              setSelected(new Set());
                              setConfirmBulkDelete(false);
                              await queryClient.invalidateQueries({ queryKey: ["leads"] });
                            } catch (e) {
                              console.warn("[bulk-delete] failed", e);
                            } finally {
                              setBulkBusy(false);
                            }
                          }}
                        >
                          {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, delete"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmBulkDelete(false)}
                          disabled={bulkBusy}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmBulkDelete(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            <ul className="border-t border-border/30 divide-y divide-border/30">
              {visibleLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  selected={selected.has(lead.id)}
                  onToggle={(checked) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(lead.id);
                      else next.delete(lead.id);
                      return next;
                    });
                  }}
                  selectionActive={selected.size > 0}
                />
              ))}
            </ul>
          </>
        )}
      </article>

      <ImportLeadsModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
      />
      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
      />
    </AuthShell>
  );
}

// ── Action queue ────────────────────────────────────────────────────────────
// Three small lists derived from leads data. No new API. The card hides
// entirely if all buckets are empty. Each row links to the lead detail.


// ── Subscription banner — unchanged behavior, refined chrome ────────────────

function SubscriptionBanner({ status, isAdmin }: { status: string; isAdmin: boolean }) {
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (isAdmin) return null;
  if (status === "active" || status === "trialing") return null;

  const isPastDue = status === "past_due" || status === "unpaid";

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
      className="mb-5 rounded-2xl border p-5 flex items-start gap-3.5"
      style={{
        borderColor: isPastDue ? "rgba(245,158,11,0.4)" : "var(--border-gold)",
        background: isPastDue
          ? "linear-gradient(135deg, rgba(245,158,11,0.08), transparent)"
          : "linear-gradient(135deg, rgba(212,175,55,0.08), transparent)",
      }}
    >
      {isPastDue ? (
        <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
      ) : (
        <CreditCard className="h-5 w-5 text-[var(--gold)] mt-0.5 shrink-0" />
      )}
      <div className="flex-1">
        <p className="font-semibold">
          {isPastDue ? "Your last payment didn't go through." : "Activate your subscription."}
        </p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {isPastDue
            ? "Update your card to keep the funnel, dashboard, and follow-up engine running."
            : "$14.95/mo unlocks the platform — your live funnel, lead pipeline, and the auto-follow-up engine. Cancel any time."}
        </p>
        {error && <p className="text-xs mt-2" style={{ color: "var(--warning)" }}>{error}</p>}
      </div>
      <Button size="sm" variant="primary" onClick={() => void go()} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isPastDue ? "Update billing" : "Subscribe"}
      </Button>
    </div>
  );
}

// ── Filter chips ────────────────────────────────────────────────────────────

function FilterChip({
  label,
  count,
  active,
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
      data-active={active}
      className="bfa-nav-item shrink-0 text-[12px] !px-2.5 !py-1"
    >
      {label}
      <span className="text-[10px] opacity-70 tabular-nums">{count}</span>
    </button>
  );
}

function SourceChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className="bfa-nav-item shrink-0 text-[11px] !px-2.5 !py-1"
    >
      {label}
    </button>
  );
}

// ── Lead row ────────────────────────────────────────────────────────────────

function LeadRow({
  lead,
  selected,
  onToggle,
  selectionActive,
}: {
  lead: LeadWithReply;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  selectionActive: boolean;
}) {
  const status = lead.status as LeadStatus;
  const created = new Date(lead.createdAt);
  const ago = relativeTime(created);
  const lastReplyAt = lead.lastReplyAt ? new Date(lead.lastReplyAt) : null;
  const hasReplied = lastReplyAt !== null && !Number.isNaN(lastReplyAt.getTime());
  // Priority flag: a "needs first touch" hint surfaced inline. Don't show
  // for already-engaged statuses — it'd just be noise there.
  const ageHours = (Date.now() - created.getTime()) / (60 * 60 * 1000);
  const needsTouch = status === "new" && ageHours > 24;

  return (
    <li
      className={cn(
        "transition",
        selected && "bg-[var(--gold)]/8",
      )}
    >
      <Link
        href={`/dashboard/leads/${lead.id}`}
        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-white/[0.03] transition group"
      >
        <label
          className="flex items-center justify-center h-10 w-6 shrink-0 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--gold)] cursor-pointer"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(e.target.checked);
            }}
            aria-label={`Select ${lead.name}`}
          />
        </label>
        <div
          className="h-10 w-10 rounded-full grid place-items-center font-semibold text-sm shrink-0"
          style={{
            background: "color-mix(in oklab, var(--gold) 14%, transparent)",
            color: "var(--gold)",
            border: "1px solid var(--border-gold)",
          }}
        >
          {lead.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold truncate text-[14px]">{lead.name}</p>
            <Badge tone={leadStatusTone(status)}>{STATUS_LABEL[status] ?? status}</Badge>
            <ColorBadge color={lead.colorCode as ColorCode | null} variant="chip" />
            {hasReplied && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.40)",
                  color: "var(--success)",
                }}
                title={`Replied ${relativeTime(lastReplyAt!)}`}
              >
                <MessageCircle className="h-3 w-3" />
                Replied
              </span>
            )}
            {needsTouch && !hasReplied && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.40)",
                  color: "var(--warning)",
                }}
              >
                <Clock className="h-3 w-3" />
                Follow up
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{lead.email}</p>
          {lead.phone && (
            <p className="text-[11px] text-muted-foreground/85 mt-0.5 inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {lead.phone}
            </p>
          )}
        </div>
        <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
          <p className="text-[11px] text-muted-foreground tabular-nums">{ago}</p>
          {lead.bestTime && (
            <p className="text-[10px] text-muted-foreground/80 mt-0.5 max-w-[16ch] truncate" title={lead.bestTime}>
              {lead.bestTime}
            </p>
          )}
        </div>
        {!selectionActive && (
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-[var(--gold)] transition" />
        )}
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
      <EmptyState
        title="No leads match this filter."
        description="Loosen your filters to see more, or clear them to see the full pipeline."
      />
    );
  }
  if (total === 0) {
    return (
      <EmptyState
        icon={<PhoneCall className="h-5 w-5" />}
        title="Your first lead is one share away."
        description="Drop your funnel link in your stories, in a DM to one person, or in your text signature. Then watch this page light up."
        action={
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild>
              <a href={funnelUrl} target="_blank" rel="noopener noreferrer">Preview your funnel</a>
            </Button>
            <Button variant="secondary" onClick={onAdd}>
              <UserPlus className="h-4 w-4" /> Add a contact manually
            </Button>
          </div>
        }
      />
    );
  }
  return <EmptyState title="No leads to show." />;
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
