import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

export default function NotFoundPage() {
  return (
    <main className="min-h-[100dvh] grid place-items-center px-5">
      <div className="bfa-card-strong p-8 max-w-md text-center bfa-animate-in">
        <BrandMark className="justify-center mb-6" />
        <p className="bfa-pill mx-auto">404</p>
        <h1 className="font-display text-3xl font-bold mt-3">This page doesn&apos;t exist.</h1>
        <p className="text-muted-foreground text-sm mt-2">
          The link may be off, or the partner page hasn&apos;t been claimed yet.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
