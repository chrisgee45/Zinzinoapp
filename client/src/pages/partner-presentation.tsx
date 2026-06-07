import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { useFunnel } from "@/lib/funnelContext";
import { loadTracking, trackViewContent } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { COLOR_CODES, type ColorCode, type PublicPartner } from "@shared/schema";

type PartnerWithContent = PublicPartner & { content?: Record<string, string> };

const DEFAULT_SHORT_VIDEO_ID = "l6bIKsVRsz0";

export default function PartnerPresentation() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const funnel = useFunnel();

  const partnerQuery = useQuery<PartnerWithContent>({
    queryKey: ["partner", slug],
    queryFn: () => api<PartnerWithContent>(`/api/partner/${slug}`),
    enabled: !!slug,
  });

  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!funnel.leadId || funnel.partnerSlug !== slug) {
        setRedirecting(true);
        setLocation(`/${slug}`);
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [funnel.leadId, funnel.partnerSlug, slug, setLocation]);

  useEffect(() => {
    if (!partnerQuery.data) return;
    document.title = `Watch the breakdown · ${partnerQuery.data.name}`;
    void api("/api/page-visits", {
      method: "POST",
      body: JSON.stringify({ partnerId: partnerQuery.data.id, page: "presentation" }),
    }).catch(() => undefined);
    loadTracking({
      metaPixelId: partnerQuery.data.content?.meta_pixel_id,
      tiktokPixelId: partnerQuery.data.content?.tiktok_pixel_id,
      gaMeasurementId: partnerQuery.data.content?.ga_measurement_id,
    });
    trackViewContent();
  }, [partnerQuery.data]);

  if (redirecting || partnerQuery.isPending) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <main className="min-h-[100dvh] grid place-items-center px-6">
        <p className="text-muted-foreground">Couldn&apos;t load the presentation.</p>
      </main>
    );
  }

  const partner = partnerQuery.data;
  const firstName = partner.name.split(" ")[0];
  // Videos are platform-controlled for compliance.
  const videoId = DEFAULT_SHORT_VIDEO_ID;

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="px-5 sm:px-8 pt-5 pb-4 flex items-center justify-between border-b border-border/30 bfa-animate-in">
        <BrandMark />
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {funnel.email ?? "Private session"}
        </div>
      </header>

      <section className="flex-1 px-5 sm:px-8 py-8 max-w-3xl mx-auto w-full">
        <div className="text-center bfa-animate-in">
          <p className="bfa-pill mx-auto">Step 2 of 3</p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold mt-4 leading-[1.05]">
            Watch the <span className="text-[var(--gold)]">5-minute</span> breakdown.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            A quick overview so you can see the model before you decide if it&apos;s worth more of your time.
          </p>
        </div>

        <div className="mt-8 bfa-card p-2 sm:p-3 bfa-animate-in">
          <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              title="Build From Anywhere — 5-minute breakdown"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <ColorSelector
          onPick={(color) => {
            funnel.setColor(color);
            // Fire-and-forget — the next video is gated on the local color
            // state, not on the API call landing. If the network is slow we
            // still want the prospect's experience to feel instant.
            if (funnel.leadId) {
              void api(`/api/leads/${funnel.leadId}/color`, {
                method: "PATCH",
                body: JSON.stringify({ colorCode: color }),
              }).catch(() => undefined);
            }
            setLocation(`/${slug}/breakdown`);
          }}
        />
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/70">
        Private session for {funnel.email ?? "guest"} · Step 2 of 3
      </footer>
    </main>
  );
}

// Final copy locked in COLOR-CODE-PLAN.md §4. One-liners only — the read
// has to be instant. Driver-based, not interest-based, so it sorts cleanly
// into the four downstream scripts.
const COLOR_OPTIONS: Array<{
  code: ColorCode;
  label: string;
  hex: string;
  ringClass: string;
  glowClass: string;
}> = [
  { code: "green", label: "Show me the data and proof", hex: "#3fb87b", ringClass: "hover:ring-[#3fb87b] focus-visible:ring-[#3fb87b]", glowClass: "shadow-[0_20px_60px_-20px_rgba(63,184,123,0.55)]" },
  { code: "red", label: "Just tell me what to do and how to win", hex: "#e85a4f", ringClass: "hover:ring-[#e85a4f] focus-visible:ring-[#e85a4f]", glowClass: "shadow-[0_20px_60px_-20px_rgba(232,90,79,0.55)]" },
  { code: "yellow", label: "How do I help people and build real relationships?", hex: "#e8c054", ringClass: "hover:ring-[#e8c054] focus-visible:ring-[#e8c054]", glowClass: "shadow-[0_20px_60px_-20px_rgba(232,192,84,0.55)]" },
  { code: "blue", label: "Build it the right way and have fun doing it", hex: "#5ba8d6", ringClass: "hover:ring-[#5ba8d6] focus-visible:ring-[#5ba8d6]", glowClass: "shadow-[0_20px_60px_-20px_rgba(91,168,214,0.55)]" },
];

function ColorSelector({ onPick }: { onPick: (color: ColorCode) => void }) {
  const [picked, setPicked] = useState<ColorCode | null>(null);
  return (
    <div className="mt-10 bfa-card-strong p-6 sm:p-8 bfa-animate-in bfa-glow">
      <div className="text-center">
        <p className="bfa-pill mx-auto">One question</p>
        <h2 className="font-display text-2xl sm:text-3xl mt-3">Which of these sounds most like you?</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Tap whichever fits. The next video is the one that actually speaks your language.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.code}
            type="button"
            disabled={picked !== null}
            onClick={() => {
              if (picked) return;
              setPicked(opt.code);
              onPick(opt.code);
            }}
            aria-label={opt.label}
            className={cn(
              "group relative text-left rounded-2xl p-5 sm:p-6 transition",
              "bg-secondary/40 ring-1 ring-border/60",
              "hover:bg-secondary/60 active:scale-[0.99]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              opt.ringClass,
              picked === opt.code && `ring-2 ${opt.glowClass}`,
              picked && picked !== opt.code && "opacity-40",
            )}
            style={picked === opt.code ? { borderColor: opt.hex } : undefined}
          >
            <span
              className="inline-block h-3 w-3 rounded-full mb-3"
              style={{ backgroundColor: opt.hex, boxShadow: `0 0 0 4px ${opt.hex}22` }}
              aria-hidden
            />
            <p className="font-semibold leading-snug text-foreground">{opt.label}</p>
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
        No right answer · No commitment · Next video plays right after
      </p>
    </div>
  );
}
