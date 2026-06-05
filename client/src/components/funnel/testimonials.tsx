import { Quote } from "lucide-react";
import { DEFAULT_TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

interface Props {
  items?: Testimonial[] | null;
}

export function Testimonials({ items }: Props = {}) {
  const list = items && items.length > 0 ? items : DEFAULT_TESTIMONIALS;
  return (
    <section aria-label="Partner results" className="space-y-4">
      <div className="text-center">
        <p className="bfa-pill mx-auto">Real partners</p>
        <h2 className="font-display text-2xl sm:text-3xl mt-3">Built by everyday people.</h2>
      </div>
      <div className={`grid gap-4 ${list.length === 1 ? "sm:grid-cols-1 max-w-xl mx-auto" : list.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {list.slice(0, 3).map((t, i) => (
          <article
            key={`${t.name}-${i}`}
            className="bfa-card p-5 sm:p-6 flex flex-col gap-4 bfa-animate-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Quote className="h-5 w-5 text-[var(--gold)] shrink-0" />
            <p className="text-sm leading-relaxed text-foreground/90">{t.quote}</p>
            <div className="mt-auto pt-2 border-t border-border/60">
              <p className="font-semibold text-sm">{t.name}</p>
              {t.context && <p className="text-xs text-muted-foreground mt-0.5">{t.context}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
