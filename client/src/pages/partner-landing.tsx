import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, PlayCircle, ShieldCheck, Smartphone } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { LeadCaptureModal } from "@/components/funnel/lead-capture-modal";
import { MeetYourGuide } from "@/components/funnel/meet-your-guide";
import { Testimonials } from "@/components/funnel/testimonials";
import type { PublicPartner } from "@shared/schema";

export default function PartnerLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [modalOpen, setModalOpen] = useState(false);

  const partnerQuery = useQuery<PublicPartner>({
    queryKey: ["partner", slug],
    queryFn: () => api<PublicPartner>(`/api/partner/${slug}`),
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
  }, [partnerQuery.data]);

  const partnerName = useMemo(() => partnerQuery.data?.name ?? "your guide", [partnerQuery.data]);

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

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="pt-6 sm:pt-10 flex justify-center bfa-animate-in">
        <BrandMark />
      </header>

      <section className="flex-1 px-5 sm:px-8 pt-10 sm:pt-16 pb-8 max-w-3xl mx-auto w-full text-center bfa-animate-in">
        <p className="bfa-pill mx-auto">Built for everyday professionals</p>
        <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight mt-5 leading-[1.05]">
          How everyday professionals are building <span className="text-[var(--gold)]">global assets</span> from their phones.
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
          Discover the simple, high-leverage system to reclaim your time — without trading another evening, weekend, or vacation day.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            size="xl"
            onClick={() => setModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <PlayCircle className="h-5 w-5" />
            Watch the free breakdown
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
            5-minute video · No phone number required
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-sm">
          {[
            { icon: Smartphone, label: "Phone-first system", copy: "Run it from the device in your pocket." },
            { icon: ShieldCheck, label: "Real partners, real results", copy: "No hype — just a model that scales." },
            { icon: PlayCircle, label: "Watch before you decide", copy: "See the breakdown before any conversation." },
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
        <Testimonials />
      </section>

      <section className="px-5 sm:px-8 pb-16 max-w-3xl mx-auto w-full">
        <MeetYourGuide partner={partner} />
      </section>

      <section className="px-5 sm:px-8 pb-20 max-w-3xl mx-auto w-full">
        <div className="bfa-card p-6 sm:p-8 text-center bfa-glow">
          <h3 className="font-display text-2xl sm:text-3xl">Ready to see it?</h3>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Watch {partnerName.split(" ")[0]}&apos;s 5-minute breakdown and decide on your own time.
          </p>
          <Button size="lg" className="mt-5" onClick={() => setModalOpen(true)}>
            Watch the free breakdown
            <ArrowRight className="h-4 w-4" />
          </Button>
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
    </main>
  );
}
