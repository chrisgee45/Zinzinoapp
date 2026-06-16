export interface Testimonial {
  quote: string;
  name: string;
  context: string;
}

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
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

export function parseTestimonials(raw: string | undefined | null): Testimonial[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = parsed
      .filter((t): t is { quote: string; name: string; context?: string } =>
        Boolean(t) && typeof (t as { quote?: unknown }).quote === "string" && typeof (t as { name?: unknown }).name === "string",
      )
      .slice(0, 6)
      .map((t) => ({ quote: t.quote.trim(), name: t.name.trim(), context: (t.context ?? "").trim() }))
      .filter((t) => t.quote.length > 0 && t.name.length > 0);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export function serializeTestimonials(testimonials: Testimonial[]): string {
  return JSON.stringify(
    testimonials
      .map((t) => ({ quote: t.quote.trim(), name: t.name.trim(), context: t.context.trim() }))
      .filter((t) => t.quote.length > 0 && t.name.length > 0),
  );
}
