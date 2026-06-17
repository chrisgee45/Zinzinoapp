// Canonical funnel-URL helper.
//
// The portal is reachable on two hostnames in production:
//   - buildfromanywhere.com (the canonical brand domain)
//   - zinzinoapp-production.up.railway.app (the underlying Railway host)
// If a partner happens to be logged into the Railway host, every
// share-this-link copy was inheriting the wrong origin, so prospects
// would see and forward a Railway URL instead of the brand domain.
//
// Resolution order:
//   1. If we're already on the canonical brand domain, use that origin
//      verbatim — preserves protocol and port for local dev.
//   2. Otherwise (Railway host, preview deploy, dev tunnel, etc.) fall
//      back to the hardcoded canonical https origin so the link
//      partners share always shows their brand domain.

const CANONICAL_ORIGIN = "https://buildfromanywhere.com";
const CANONICAL_HOST = "buildfromanywhere.com";

export function publicOrigin(): string {
  if (typeof window === "undefined") return CANONICAL_ORIGIN;
  const host = window.location.hostname;
  if (host === CANONICAL_HOST || host.endsWith(`.${CANONICAL_HOST}`)) {
    return window.location.origin;
  }
  return CANONICAL_ORIGIN;
}

export function funnelUrlFor(slug: string): string {
  return `${publicOrigin()}/${slug}`;
}
