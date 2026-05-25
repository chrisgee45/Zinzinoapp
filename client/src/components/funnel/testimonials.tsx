import { Quote } from "lucide-react";

interface Testimonial {
  quote: string;
  name: string;
  context: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Came to America at 18 with nothing — went from delivering pizza to traveling the world with my wife and twins. The system did what no job could.",
    name: "Andi & Shannon",
    context: "Immigrant story · Full-time family",
  },
  {
    quote:
      "Police officer and safety tech. We needed something that respected our schedule and our faith. We built supplemental income without sacrificing either.",
    name: "Chris & Jess",
    context: "First responder + safety tech",
  },
  {
    quote:
      "I was already earning online at 21. This added a product layer and a team layer my other businesses didn't have. Now I'm chasing my next $100K.",
    name: "Kaden",
    context: "Online entrepreneur · Age 21",
  },
];

export function Testimonials() {
  return (
    <section aria-label="Partner results" className="space-y-4">
      <div className="text-center">
        <p className="bfa-pill mx-auto">Real partners</p>
        <h2 className="font-display text-2xl sm:text-3xl mt-3">Built by everyday people.</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <article
            key={t.name}
            className="bfa-card p-5 sm:p-6 flex flex-col gap-4 bfa-animate-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Quote className="h-5 w-5 text-[var(--gold)] shrink-0" />
            <p className="text-sm leading-relaxed text-foreground/90">{t.quote}</p>
            <div className="mt-auto pt-2 border-t border-border/60">
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.context}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
