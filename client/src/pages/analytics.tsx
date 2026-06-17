import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Eye,
  Globe,
  Lightbulb,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { EmptyState, Tile } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

type Range = "today" | "7d" | "30d" | "90d" | "all";

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
  today: "Today",
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
    refetchInterval: 60_000,
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
        <EmptyState title="Couldn't load analytics" description="Try again in a moment." />
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
  const closeRate =
    data.funnel.presentationsSent > 0 ? (data.funnel.customers / data.funnel.presentationsSent) * 100 : 0;

  const insights = computeInsights({
    landingUniques,
    captureRate,
    bookingRate,
    closeRate,
    presentationsSent: data.funnel.presentationsSent,
    customers: data.funnel.customers,
    leadsCreated: data.funnel.leadsCreated,
  });

  return (
    <AuthShell>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4 transition"
      >
        <ArrowLeft className="h-3 w-3" /> Back to dashboard
      </Link>

      {/* Hero header */}
      <article
        className="bfa-card-strong p-5 sm:p-6 mb-4 sm:mb-5 bfa-glow flex items-start gap-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.06) 0%, transparent 60%), var(--surface-2)" }}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "var(--gold)" }} />
        <div
          className="h-11 w-11 rounded-xl grid place-items-center shrink-0"
          style={{
            background: "color-mix(in oklab, var(--gold) 14%, transparent)",
            border: "1px solid var(--border-gold)",
            color: "var(--gold)",
          }}
        >
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="bfa-eyebrow">Traffic & funnel</p>
          <h1 className="font-display text-[22px] sm:text-[26px] font-bold mt-1 leading-tight">
            What's <span className="text-[var(--gold)]">landing</span>?
          </h1>
          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Every visit to your funnel — including the ones who never entered their email. Updates every minute. Use the range buttons below to scope it.
          </p>
        </div>
      </article>

      {/* Range chips */}
      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            data-active={range === r}
            className="bfa-nav-item shrink-0 text-[12px] !px-2.5 !py-1"
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
        {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
      </div>

      {/* Top-line tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <Tile
          label="Total visits"
          value={data.visits.total.toLocaleString()}
          caption={`${data.visits.unique.toLocaleString()} unique`}
          icon={<Eye className="h-3.5 w-3.5" />}
        />
        <Tile
          label="Landing page"
          value={landingVisits.toLocaleString()}
          caption={`${landingUniques.toLocaleString()} unique`}
          icon={<Globe className="h-3.5 w-3.5" />}
          tone="accent"
        />
        <Tile
          label="Emails captured"
          value={data.funnel.leadsCreated.toLocaleString()}
          caption={landingUniques > 0 ? `${captureRate.toFixed(1)}% of uniques` : "no traffic yet"}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <Tile
          label="Booked calls"
          value={data.funnel.booked.toLocaleString()}
          caption={data.funnel.leadsCreated > 0 ? `${bookingRate.toFixed(1)}% of captures` : "—"}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          tone={data.funnel.booked > 0 ? "success" : "default"}
        />
      </div>

      {/* Insights — only render if there's something honest to say */}
      {insights.length > 0 && (
        <article className="bfa-card mb-5 overflow-hidden">
          <div
            className="px-5 py-3.5 border-b flex items-center gap-2"
            style={{ borderColor: "var(--border-muted)" }}
          >
            <Lightbulb className="h-4 w-4 text-[var(--gold)]" />
            <h2 className="font-display text-base sm:text-lg font-bold">Insights</h2>
            <span className="bfa-eyebrow ml-auto hidden sm:inline">Derived from this range</span>
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
            {insights.map((ins, i) => (
              <InsightRow key={i} tone={ins.tone} title={ins.title} body={ins.body} />
            ))}
          </ul>
        </article>
      )}

      {/* Daily / hourly chart */}
      <DailyChart daily={data.visits.daily} range={range} />

      {/* Funnel */}
      <article className="bfa-card p-5 sm:p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--gold)]" />
            <h2 className="font-display text-base sm:text-lg font-bold">Conversion funnel</h2>
          </div>
          {data.funnel.customers > 0 && (
            <span className="bfa-eyebrow">
              {closeRate.toFixed(1)}% close
            </span>
          )}
        </div>
        <FunnelStage label="Visited landing" count={landingUniques} max={landingUniques} />
        <FunnelStage label="Entered email" count={data.funnel.leadsCreated} max={landingUniques} />
        <FunnelStage label="Picked a color" count={data.funnel.colorTagged} max={landingUniques} />
        <FunnelStage label="Booked the call" count={data.funnel.booked} max={landingUniques} />
        <FunnelStage label="Presentation sent" count={data.funnel.presentationsSent} max={landingUniques} />
        <FunnelStage label="Became a customer" count={data.funnel.customers} max={landingUniques} accent />
      </article>

      {/* Side-by-side breakdowns */}
      <div className="grid lg:grid-cols-2 gap-3 mb-5">
        <article className="bfa-card p-5 sm:p-6">
          <h2 className="font-display text-base sm:text-lg font-bold mb-3">By page</h2>
          {data.visits.perPage.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No visits in this range yet.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
              {data.visits.perPage.map((p) => (
                <li key={p.page} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-semibold">{PAGE_LABELS[p.page] ?? p.page}</span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    <span className="text-foreground font-semibold">{p.visits.toLocaleString()}</span>
                    <span className="text-muted-foreground/70"> · {p.uniques.toLocaleString()} unique</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="bfa-card p-5 sm:p-6">
          <h2 className="font-display text-base sm:text-lg font-bold mb-3">Top referrers</h2>
          {data.visits.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              No referrer data yet. Traffic from TikTok, IG, Facebook, and pasted links shows up here as it comes in.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
              {data.visits.topReferrers.map((r, i) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-[13px] truncate max-w-[70%] text-foreground/85">
                    {formatReferrer(r.referrer)}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums">{r.visits.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </AuthShell>
  );
}

// ── Insight engine ──────────────────────────────────────────────────────────
// Real-data-only. Returns an empty array if there's nothing meaningful to
// say — the section then hides entirely on the page. Each rule has a
// clear precondition so we never invent guidance that isn't earned by the
// numbers.

interface Insight {
  tone: "warning" | "success" | "info";
  title: string;
  body: string;
}

function computeInsights(args: {
  landingUniques: number;
  captureRate: number;
  bookingRate: number;
  closeRate: number;
  presentationsSent: number;
  customers: number;
  leadsCreated: number;
}): Insight[] {
  const { landingUniques, captureRate, bookingRate, closeRate, presentationsSent, customers, leadsCreated } = args;
  const out: Insight[] = [];

  // Capture-rate insight
  if (landingUniques >= 10 && captureRate < 5) {
    out.push({
      tone: "warning",
      title: "Visitors are landing, but email capture is low.",
      body: `${landingUniques.toLocaleString()} unique visitors, ${captureRate.toFixed(1)}% captured. Your first bottleneck is the unlock step. Test the headline, the play-button thumbnail, or the squeeze copy.`,
    });
  } else if (landingUniques >= 10 && captureRate >= 20) {
    out.push({
      tone: "success",
      title: "Solid capture rate.",
      body: `${captureRate.toFixed(1)}% of unique visitors are saying yes to your hook. Keep doing what's working — and start driving more traffic.`,
    });
  }

  // Booking-rate insight
  if (leadsCreated >= 5 && bookingRate < 25) {
    out.push({
      tone: "warning",
      title: "Captures aren't turning into bookings.",
      body: `Only ${bookingRate.toFixed(1)}% of captured leads are making it through video 2 to the booking form. That's where they decide to take the call. Watch the breakdown video as a prospect would and see what's missing.`,
    });
  } else if (leadsCreated >= 5 && bookingRate >= 50) {
    out.push({
      tone: "success",
      title: "Strong booking rate.",
      body: `${bookingRate.toFixed(1)}% of captures are booking the call. Your video 2 is doing the work — protect that funnel.`,
    });
  }

  // Close-rate insight
  if (presentationsSent >= 3 && customers === 0) {
    out.push({
      tone: "warning",
      title: "Presentations sent, no closes yet.",
      body: `${presentationsSent} presentations have gone out and zero customers closed. Time to revisit how you set up the close after the walkthrough — most partners over-explain instead of asking for the decision.`,
    });
  } else if (presentationsSent >= 3 && closeRate >= 30) {
    out.push({
      tone: "success",
      title: "Strong close rate.",
      body: `${closeRate.toFixed(1)}% of presentations are closing. Few partners hit that. Document what you say at the end and lock it in.`,
    });
  }

  // No-traffic case
  if (landingUniques === 0 && presentationsSent === 0) {
    out.push({
      tone: "info",
      title: "Nothing's landing yet.",
      body: "Drop your funnel link in your stories, in one DM, or in your text signature. Then check this page tomorrow morning.",
    });
  }

  return out;
}

function InsightRow({ tone, title, body }: { tone: Insight["tone"]; title: string; body: string }) {
  const TONE: Record<Insight["tone"], { color: string; bg: string; ringRgb: string }> = {
    warning: { color: "var(--warning)", bg: "rgba(245,158,11,0.10)", ringRgb: "245,158,11" },
    success: { color: "var(--success)", bg: "rgba(34,197,94,0.10)", ringRgb: "34,197,94" },
    info: { color: "var(--cyan)", bg: "rgba(34,211,238,0.10)", ringRgb: "34,211,238" },
  };
  const t = TONE[tone];
  return (
    <li className="px-5 py-4 flex items-start gap-3">
      <span
        className="h-7 w-7 rounded-lg grid place-items-center shrink-0 mt-0.5"
        style={{ background: t.bg, color: t.color, boxShadow: `inset 0 0 0 1px rgb(${t.ringRgb} / 0.25)` }}
      >
        <Lightbulb className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[13.5px] leading-snug">{title}</p>
        <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">{body}</p>
      </div>
    </li>
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
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          <span className={`font-semibold ${accent ? "text-[var(--gold)]" : "text-foreground"}`}>
            {count.toLocaleString()}
          </span>
          {max > 0 && <span className="text-muted-foreground/70"> · {pct.toFixed(1)}%</span>}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "color-mix(in oklab, var(--surface-3) 60%, transparent)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: accent
              ? "linear-gradient(90deg, var(--gold-soft), var(--gold-deep))"
              : "color-mix(in oklab, var(--gold) 55%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

// SVG-free bar chart — sized by max value, hover title shows the exact
// number for any bar.
function DailyChart({ daily, range }: { daily: AnalyticsResponse["visits"]["daily"]; range: Range }) {
  const expanded = useMemo(() => fillDays(daily, range), [daily, range]);
  const max = Math.max(1, ...expanded.map((d) => d.visits));
  const totalDays = expanded.length;

  if (totalDays === 0 || expanded.every((d) => d.visits === 0)) {
    return (
      <article className="bfa-card mb-5">
        <EmptyState
          title="No visits to chart yet."
          description={range === "today" ? "Visits will populate the hour they happen." : "Visits will populate as soon as someone lands on your funnel."}
        />
      </article>
    );
  }

  return (
    <article className="bfa-card p-5 sm:p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base sm:text-lg font-bold">
          {range === "today" ? "Today, by the hour" : "Visits over time"}
        </h2>
        <span className="bfa-eyebrow tabular-nums">Peak {max.toLocaleString()}</span>
      </div>
      <div className="flex items-end gap-[3px] h-36 sm:h-44">
        {expanded.map((d, i) => {
          const h = (d.visits / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t group relative transition"
              style={{
                height: `${Math.max(h, d.visits > 0 ? 4 : 1)}%`,
                background: d.visits > 0
                  ? "linear-gradient(180deg, var(--gold-soft), color-mix(in oklab, var(--gold) 40%, transparent))"
                  : "color-mix(in oklab, var(--border-muted) 100%, transparent)",
              }}
              title={`${d.day}: ${d.visits} visits · ${d.uniques} unique`}
            >
              <div
                className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none transition"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border-muted)" }}
              >
                {d.visits.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 tabular-nums">
        <span>{expanded[0]?.day}</span>
        <span>{expanded[expanded.length - 1]?.day}</span>
      </div>
    </article>
  );
}

function fillDays(
  daily: AnalyticsResponse["visits"]["daily"],
  range: Range,
): AnalyticsResponse["visits"]["daily"] {
  if (range === "all") return daily;

  if (range === "today") {
    const byHour = new Map<string, { visits: number; uniques: number }>();
    for (const row of daily) byHour.set(row.day, { visits: row.visits, uniques: row.uniques });

    const out: AnalyticsResponse["visits"]["daily"] = [];
    const now = new Date();
    const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const lastHourToShow = now.getUTCHours();
    for (let h = 0; h <= lastHourToShow; h++) {
      const d = new Date(startUTC);
      d.setUTCHours(h);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}:00`;
      const found = byHour.get(key);
      const display = d.toLocaleString("en-US", { hour: "numeric", hour12: true }).replace(/\s/g, "");
      out.push({ day: display, visits: found?.visits ?? 0, uniques: found?.uniques ?? 0 });
    }
    return out;
  }

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
