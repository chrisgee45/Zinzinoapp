import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Lock, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { useFunnel } from "@/lib/funnelContext";
import { parseYouTubeId } from "@/lib/youtube";
import { loadTracking, trackViewContent } from "@/lib/tracking";
import type { PublicPartner } from "@shared/schema";

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
  const videoId = parseYouTubeId(partner.content?.teaser_video_id) ?? DEFAULT_SHORT_VIDEO_ID;

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

        <div className="mt-8 bfa-card p-6 sm:p-8 text-center bfa-glow bfa-animate-in">
          <h2 className="font-display text-2xl sm:text-3xl">Ready for the deeper look?</h2>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl mx-auto">
            That was the teaser. The full breakdown walks you through how the system actually runs — products, partners, and the pace it builds at.
          </p>
          <Button
            size="xl"
            className="mt-5"
            onClick={() => setLocation(`/${slug}/breakdown`)}
          >
            <PlayCircle className="h-5 w-5" />
            Get the full breakdown
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
            Next video · No commitment · No phone required
          </p>
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/70">
        Private session for {funnel.email ?? "guest"} · Step 2 of 3
      </footer>
    </main>
  );
}
