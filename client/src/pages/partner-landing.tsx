import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Play, PlayCircle, ShieldCheck, Smartphone } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { LeadCaptureModal } from "@/components/funnel/lead-capture-modal";
import { MeetYourGuide } from "@/components/funnel/meet-your-guide";
import { Testimonials } from "@/components/funnel/testimonials";
import { loadTracking } from "@/lib/tracking";
import { parseTestimonials } from "@/lib/testimonials";
import { parseHeadlineVariants, pickHeadlineVariant } from "@/lib/headlineVariants";
import { useExitIntent } from "@/hooks/useExitIntent";
import { useFunnel } from "@/lib/funnelContext";
import { ExitIntentModal } from "@/components/funnel/exit-intent-modal";
import type { PublicPartner } from "@shared/schema";

type PartnerWithContent = PublicPartner & { content?: Record<string, string> };
const DEFAULT_TEASER_VIDEO_ID = "l6bIKsVRsz0";

export default function PartnerLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const funnel = useFunnel();
  const [modalOpen, setModalOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  // Locked until the squeeze form is submitted. Once unlocked, the play-button
  // thumbnail is replaced inline by an autoplaying iframe — the prospect's
  // mental model is "I clicked play, the modal interrupted me, now the video
  // plays right here," not "submit kicked me to a different page."
  const videoUnlocked = funnel.leadId !== null && funnel.partnerSlug === slug;

  const partnerQuery = useQuery<PartnerWithContent>({
    queryKey: ["partner", slug],
    queryFn: () => api<PartnerWithContent>(`/api/partner/${slug}`),
    enabled: !!slug,
    retry: 0,
  });

  useEffect(() => {
    if (!partnerQuery.data) return;
    document.title = partnerQuery.data.seoTitle ?? `${partnerQuery.data.name} · Build From Anywhere`;
    const desc = partnerQuery.data.seoDescription ?? "A simple, high-leverage system to reclaim your time.";
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", desc);
  }, [partnerQuery.data]);

  useEffect(() => {
    if (!partnerQuery.data) return;
    void api("/api/page-visits", {
      method: "POST",
      body: JSON.stringify({ partnerId: partnerQuery.data.id, page: "landing" }),
    }).catch(() => undefined);
    loadTracking({
      metaPixelId: partnerQuery.data.content?.meta_pixel_id,
      tiktokPixelId: partnerQuery.data.content?.tiktok_pixel_id,
      gaMeasurementId: partnerQuery.data.content?.ga_measurement_id,
    });
  }, [partnerQuery.data]);

  const partnerName = useMemo(() => partnerQuery.data?.name ?? "your guide", [partnerQuery.data]);

  // Hooks must run on every render in the same order. This used to live below
  // the isPending/isError early returns, which made the hook count jump from
  // 8 to 9 between loading and loaded renders — React error #310. Reading
  // through optional chains here keeps it safe before data exists.
  const variantPick = useMemo(
    () =>
      pickHeadlineVariant(
        slug ?? "",
        parseHeadlineVariants(partnerQuery.data?.content?.headline_variants),
      ),
    [slug, partnerQuery.data?.content?.headline_variants],
  );

  if (partnerQuery.isPending) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  if (partnerQuery.isError || !partnerQuery.data) {
    const notFound = partnerQuery.error instanceof ApiError && partnerQuery.error.status === 404;
    return (
      <main className="min-h-[100dvh] grid place-items-center px-6">
        <div className="bfa-card p-8 text-center max-w-md">
          <BrandMark className="mb-6 justify-center" />
          <h1 className="font-display text-2xl mb-2">{notFound ? "Partner not found" : "Something went sideways"}</h1>
          <p className="text-muted-foreground text-sm">
            {notFound
              ? `We couldn't find a partner page at /${slug}.`
              : "We couldn't load this page. Try again in a moment."}
          </p>
        </div>
      </main>
    );
  }

  const partner = partnerQuery.data;
  // Videos are platform-controlled for compliance — always the default ID.
  const teaserVideoId = DEFAULT_TEASER_VIDEO_ID;
  const customSub = partner.content?.subheadline?.trim();
  const customHeadline = variantPick.variant ?? partner.content?.headline?.trim();

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="pt-6 sm:pt-10 flex justify-center bfa-animate-in">
        <BrandMark />
      </header>

      <section className="flex-1 px-5 sm:px-8 pt-8 sm:pt-12 pb-8 max-w-3xl mx-auto w-full text-center bfa-animate-in">
        <p className="bfa-pill mx-auto">Free 5-minute breakdown</p>
        <h1 className="font-display text-3xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight mt-5 leading-[1.05]">
          {customHeadline ? (
            customHeadline
          ) : (
            <>
              Build a real <span className="text-[var(--gold)]">second income</span> — without quitting your day job.
            </>
          )}
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
          {customSub ??
            "The simple, phone-first system real professionals are using to build something on the side. No pitch. No pressure. Watch the 5-minute breakdown and decide on your own time."}
        </p>

        {videoUnlocked ? (
          <div className="mt-8 bfa-card p-2 sm:p-3 bfa-animate-in">
            <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-video">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${teaserVideoId}?rel=0&modestbranding=1&autoplay=1&playsinline=1`}
                title="Build From Anywhere — 5-minute breakdown"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            aria-label="Watch the 5-minute breakdown"
            className="group mt-8 block w-full relative aspect-video rounded-2xl overflow-hidden bg-black bfa-glow ring-1 ring-[var(--gold)]/30 hover:ring-[var(--gold)]/60 transition"
          >
            <img
              src={`https://img.youtube.com/vi/${teaserVideoId}/maxresdefault.jpg`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 transition group-hover:scale-[1.02] duration-500"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${teaserVideoId}/hqdefault.jpg`;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1f33] via-[#0b1f33]/40 to-transparent" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-[var(--gold)] grid place-items-center shadow-[0_20px_60px_-10px_rgba(201,168,76,0.6)] group-hover:scale-110 transition-transform duration-300">
                <Play className="h-9 w-9 sm:h-11 sm:w-11 text-[var(--navy)] ml-1" fill="currentColor" strokeWidth={0} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-left">
              <p className="text-xs sm:text-sm text-white/95 font-semibold inline-flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-[var(--gold)]" />
                Tap to unlock — 5 minutes, free
              </p>
            </div>
          </button>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {videoUnlocked ? (
            <Button size="lg" onClick={() => setLocation(`/${slug}/breakdown`)} className="w-full sm:w-auto">
              Get the full breakdown
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
              Watch the breakdown
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
            {videoUnlocked ? "Watch above · then keep going" : "Just your name & email · No phone required"}
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-sm">
          {[
            { icon: Smartphone, label: "Phone-first system", copy: "Run it from the device in your pocket — no office, no inventory." },
            { icon: ShieldCheck, label: "No pitch on this page", copy: "Just a video. Decide on your own time, on your own terms." },
            { icon: PlayCircle, label: "Real partners, real results", copy: "Built by people with day jobs, families, and zero patience for hype." },
          ].map(({ icon: Icon, label, copy }) => (
            <li key={label} className="bfa-card p-4 flex gap-3">
              <Icon className="h-5 w-5 text-[var(--gold)] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-5 sm:px-8 pb-12 max-w-3xl mx-auto w-full">
        <Testimonials items={parseTestimonials(partner.content?.testimonials)} />
      </section>

      <section className="px-5 sm:px-8 pb-16 max-w-3xl mx-auto w-full">
        <MeetYourGuide partner={partner} />
      </section>

      <section className="px-5 sm:px-8 pb-20 max-w-3xl mx-auto w-full">
        <div className="bfa-card p-6 sm:p-8 text-center bfa-glow">
          <h3 className="font-display text-2xl sm:text-3xl">
            {videoUnlocked ? "Ready for the full breakdown?" : "Ready to see it?"}
          </h3>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            {videoUnlocked
              ? `Next: how the system actually runs, with ${partnerName.split(" ")[0]}.`
              : `Watch ${partnerName.split(" ")[0]}'s 5-minute breakdown and decide on your own time.`}
          </p>
          {videoUnlocked ? (
            <Button size="lg" className="mt-5" onClick={() => setLocation(`/${slug}/breakdown`)}>
              Get the full breakdown
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" className="mt-5" onClick={() => setModalOpen(true)}>
              Watch the free breakdown
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/70">
        © {new Date().getFullYear()} Build From Anywhere · Independent partner page
      </footer>

      <LeadCaptureModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        partnerId={partner.id}
        partnerSlug={partner.slug}
        partnerName={partner.name}
      />
      <ExitIntentModal
        open={exitOpen}
        onOpenChange={setExitOpen}
        partnerId={partner.id}
        partnerFirstName={partner.name.split(" ")[0]}
      />
      <ExitIntentArm
        partnerSlug={partner.slug}
        hasLead={!!funnel.leadId}
        modalOpen={modalOpen || exitOpen}
        onTrigger={() => setExitOpen(true)}
      />
    </main>
  );
}

function ExitIntentArm({
  partnerSlug,
  hasLead,
  modalOpen,
  onTrigger,
}: {
  partnerSlug: string;
  hasLead: boolean;
  modalOpen: boolean;
  onTrigger: () => void;
}) {
  useExitIntent(onTrigger, {
    enabled: !hasLead && !modalOpen,
    storageKey: `bfa_exit_${partnerSlug}`,
  });
  return null;
}
