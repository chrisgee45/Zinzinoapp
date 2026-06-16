import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";

// Legacy route. The first 5-minute video now plays inline on the landing
// page after the squeeze unlocks. Anyone landing here (a cached tab, a
// bookmark, a back-button hit) gets forwarded straight to the breakdown.
export default function PartnerPresentation() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(`/${slug}/breakdown`, { replace: true });
  }, [slug, setLocation]);

  return (
    <main className="min-h-[100dvh] grid place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--gold)]" />
    </main>
  );
}
