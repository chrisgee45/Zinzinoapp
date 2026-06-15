import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Eye,
  Globe,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "all";

interface AnalyticsResponse {
  range: Range;
  visits: {
    total: number;
    unique: number;
    perPage: Array<{ page: string; visits: number; uniques: number }>;
    daily: Array<{ day: string; visits: number; uniques: number }>;
    topReferrers: Array<{ referrer: string | null; visits: number }>;
  };
  funnel: {
    leadsCreated: number;
    booked: number;
    colorTagged: number;
    presentationsSent: number;
    customers: number;
  };
}

const RANGE_LABELS: Record<Range, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

const PAGE_LABELS: Record<string, string> = {
  landing: "Landing page",
  presentation: "Presentation (legacy)",
  breakdown: "Breakdown page",
  about: "About me",
  main: "Marketing home",
  dashboard: "Dashboard",
};

export default function AnalyticsPage() {
  const { partner, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const query = useQuery<AnalyticsResponse>({
    queryKey: ["analytics", range],
    queryFn: () => api<AnalyticsResponse>(`/api/analytics/summary?range=${range}`),
    enabled: !!partner,
    refetchInterval: 60_000, // pick up new visits without manual reload
  });

  if (loading || query.isPending) {
    return (
      <AuthShell>
        <div className="grid place-items-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
        </div>
      </AuthShell>
    );
  }
  if (query.isError || !query.data) {
    return (
      <AuthShell>
        <div className="bfa-card p-6 max-w-md mx-auto text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load analytics. Try again in a moment.</p>
        </div>
      </AuthShell>
    );
  }

  const data = query.data;
  const landingPage = data.visits.perPage.find((p) => p.page === "landing");
  const landingVisits = landingPage?.visits ?? 0;
  const landingUniques = landingPage?.uniques ?? 0;
  const captureRate = landingUniques > 0 ? (data.funnel.leadsCreated / landingUniques) * 100 : 0;
  const bookingRate =
    data.funnel.leadsCreated > 0 ? (data.funnel.booked / data.funnel.leadsCreated) * 100 : 0;

  return (
    <AuthShell>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      <div className="bfa-card-strong p-5 sm:p-6 mb-5 bfa-glow flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/35 grid place-items-center shrink-0">
          <BarChart3 className="h-5 w-5 text-[var(--gold)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="bfa-pill inline-flex">Traffic & funnel</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 leading-tight drop-shadow-[0_2px_12px_rgba(201,168,76,0.25)]">
            What's <span className="text-[var(--gold)]">landing</span>?
          </h1>
          <p className="text-sm text-foreground/80 mt-2 leading-relaxed max-w-2xl">
            Every visit to your funnel, including the ones who never entered their email. Updates every minute. Use the range buttons to scope it.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition border",
              range === r
                ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40"
                : "bg-transparent text-muted-foreground border-border/50 hover:bg-secondary/40 hover:text-foreground",
            )}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
        {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
      </div>

      {/* Top-line metric cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          icon={Eye}
          label="Total visits"
          value={data.visits.total}
          sub={`${data.visits.unique} unique`}
        />
        <MetricCard
          icon={Globe}
          label="Landing page visits"
          value={landingVisits}
          sub={`${landingUniques} unique`}
          accent
        />
        <MetricCard
          icon={Users}
          label="Emails captured"
          value={data.funnel.leadsCreated}
          sub={landingUniques > 0 ? `${captureRate.toFixed(1)}% of uniques` : "no traffic yet"}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Booked calls"
          value={data.funnel.booked}
          sub={data.funnel.leadsCreated > 0 ? `${bookingRate.toFixed(1)}% of captures` : "—"}
        />
      </div>

      {/* Daily chart */}
      <DailyChart daily={data.visits.daily} range={range} />

      {/* Funnel */}
      <section className="bfa-card p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[var(--gold)]" />
          <h2 className="font-display text-lg font-bold">Conversion funnel</h2>
        </div>
        <FunnelStage label="Visited landing" count={landingUniques} max={landingUniques} />
        <FunnelStage label="Entered email" count={data.funnel.leadsCreated} max={landingUniques} />
        <FunnelStage label="Picked a color" count={data.funnel.colorTagged} max={landingUniques} />
        <FunnelStage label="Booked the call" count={data.funnel.booked} max={landingUniques} />
        <FunnelStage label="Presentation sent" count={data.funnel.presentationsSent} max={landingUniques} />
        <FunnelStage label="Became a customer" count={data.funnel.customers} max={landingUniques} accent />
      </section>

      <div className="grid lg:grid-cols-2 gap-3 mb-6">
        {/* Per-page breakdown */}
        <section className="bfa-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold mb-3">By page</h2>
          {data.visits.perPage.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No visits in this range yet.</p>
          ) : (
            <ul className="divide-y divide-border/30">
              {data.visits.perPage.map((p) => (
                <li key={p.page} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{PAGE_LABELS[p.page] ?? p.page}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-bold">{p.visits}</span> visits ·{" "}
                    <span className="text-foreground/80">{p.uniques} unique</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top referrers */}
        <section className="bfa-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold mb-3">Top referrers</h2>
          {data.visits.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              No referrer data yet. Traffic from TikTok, IG, Facebook, and pasted links shows up here as it comes in.
            </p>
          ) : (
            <ul className="divide-y divide-border/30">
              {data.visits.topReferrers.map((r, i) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm truncate max-w-[60%] text-foreground/85">
                    {formatReferrer(r.referrer)}
                  </span>
                  <span className="text-xs font-bold text-foreground">{r.visits}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AuthShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "bfa-card p-4 sm:p-5",
        accent && "border-[var(--gold)]/35 bg-[var(--gold)]/5",
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.18em]">
        <Icon className="h-3.5 w-3.5 text-[var(--gold)]" />
        {label}
      </div>
      <p className="font-display text-3xl sm:text-4xl font-bold mt-2 leading-none">{value.toLocaleString()}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

function FunnelStage({
  label,
  count,
  max,
  accent,
}: {
  label: string;
  count: number;
  max: number;
  accent?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (count / max) * 100) : 0;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          <span className={cn("text-foreground font-bold", accent && "text-[var(--gold)]")}>{count}</span>
          {max > 0 && <span className="text-foreground/60"> · {pct.toFixed(1)}%</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary/30 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            accent ? "bg-[var(--gold)]" : "bg-[var(--gold)]/55",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Simple SVG bar chart — no library, sized by max value, hover title shows
// the exact number for any bar. The series is dense enough that adding a
// charting lib would be overkill.
function DailyChart({ daily, range }: { daily: AnalyticsResponse["visits"]["daily"]; range: Range }) {
  const expanded = useMemo(() => fillDays(daily, range), [daily, range]);
  const max = Math.max(1, ...expanded.map((d) => d.visits));
  const totalDays = expanded.length;

  if (totalDays === 0 || expanded.every((d) => d.visits === 0)) {
    return (
      <section className="bfa-card p-5 sm:p-6 mb-6 text-center">
        <p className="text-sm text-muted-foreground italic">
          No visits to chart yet for this range.
        </p>
      </section>
    );
  }

  return (
    <section className="bfa-card p-5 sm:p-6 mb-6">
      <h2 className="font-display text-lg font-bold mb-3">Visits over time</h2>
      <div className="flex items-end gap-[2px] h-32 sm:h-40">
        {expanded.map((d, i) => {
          const h = (d.visits / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t bg-[var(--gold)]/30 hover:bg-[var(--gold)] transition group relative"
              style={{ height: `${Math.max(h, d.visits > 0 ? 4 : 0)}%` }}
              title={`${d.day}: ${d.visits} visits · ${d.uniques} unique`}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-semibold bg-foreground text-background px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                {d.visits}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
        <span>{expanded[0]?.day}</span>
        <span>{expanded[expanded.length - 1]?.day}</span>
      </div>
    </section>
  );
}

// Fill missing days with zero-visit entries so the chart renders a continuous
// timeline even if there's a gap.
function fillDays(
  daily: AnalyticsResponse["visits"]["daily"],
  range: Range,
): AnalyticsResponse["visits"]["daily"] {
  if (range === "all") return daily;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const byDay = new Map<string, { visits: number; uniques: number }>();
  for (const row of daily) byDay.set(row.day, { visits: row.visits, uniques: row.uniques });

  const out: AnalyticsResponse["visits"]["daily"] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const found = byDay.get(key);
    out.push({ day: key.slice(5), visits: found?.visits ?? 0, uniques: found?.uniques ?? 0 });
  }
  return out;
}

function formatReferrer(ref: string | null): string {
  if (!ref) return "Direct / unknown";
  try {
    const url = new URL(ref);
    return url.hostname.replace(/^www\./, "") + (url.pathname !== "/" ? url.pathname : "");
  } catch {
    return ref.slice(0, 60);
  }
}
