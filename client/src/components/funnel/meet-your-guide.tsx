import { Facebook, Instagram } from "lucide-react";
import type { PublicPartner } from "@shared/schema";

interface Props {
  partner: PublicPartner;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function MeetYourGuide({ partner }: Props) {
  return (
    <section className="bfa-card p-6 sm:p-8 bfa-animate-in">
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-6">
        <div className="relative">
          {partner.photoUrl ? (
            <img
              src={partner.photoUrl}
              alt={partner.name}
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-cover ring-1 ring-[var(--gold)]/40"
              loading="lazy"
            />
          ) : (
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-secondary/60 ring-1 ring-[var(--gold)]/30 flex items-center justify-center font-display text-3xl text-[var(--gold)]">
              {initials(partner.name) || "B"}
            </div>
          )}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 sm:left-auto sm:right-[-8px] sm:translate-x-0 bfa-pill bg-background/80">
            Your guide
          </div>
        </div>

        <div className="mt-6 sm:mt-0 flex-1 space-y-3">
          <div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{partner.name}</h3>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)] mt-1">
              buildfromanywhere.com/{partner.slug}
            </p>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-prose">
            {partner.bio ??
              "An independent partner showing real people how to build a global income asset right from their phone."}
          </p>
          {(partner.facebookUrl || partner.instagramUrl || partner.tiktokUrl) && (
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              {partner.facebookUrl && (
                <a
                  href={partner.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {partner.instagramUrl && (
                <a
                  href={partner.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {partner.tiktokUrl && (
                <a
                  href={partner.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition text-xs font-semibold"
                  aria-label="TikTok"
                >
                  TT
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
