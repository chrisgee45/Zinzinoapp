// Rewrite catalog product URLs to a partner's personal Zinzino site so
// clicks from the Advisor flow through their replicated store and they
// get credit for the sale.
//
// Catalog URLs look like:
//   https://www.zinzino.com/shop/site/US/en-us/products/premier-kits/910743
//
// Partner replicated URLs slot the partner number where "site" lives:
//   https://www.zinzino.com/shop/2019713973/US/en-us/products/premier-kits/910743
//
// The partner number is the first digit run in the partner's enrollment
// link, which they paste into settings. The placeholder we show them in
// the settings field is `https://www.zinzino.com/2019713973/us/en-us/`
// so the number is in the first path segment. Some partners paste the
// shop variant (`/shop/2019713973/...`) — both formats work because we
// match any 6+ digit run.
//
// Safe-fallback policy: if we can't pull a partner ID from the link
// (empty, malformed, non-zinzino host), return the catalog URL
// unchanged. Better the user-name's link than a broken click.

const ZINZINO_HOST_RE = /(?:^|\.)zinzino\.com$/i;

export function partnerIdFromEnrollmentLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.trim());
    if (!ZINZINO_HOST_RE.test(u.hostname)) return null;
    const m = u.pathname.match(/\/(\d{6,})(?:\/|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function personalizeProductUrl(catalogUrl: string | null | undefined, partnerId: string | null): string {
  if (!catalogUrl) return "";
  if (!partnerId) return catalogUrl;
  // Only rewrite the canonical catalog pattern. Anything else (a
  // direct partner URL the catalog already carries, a fact-sheet URL,
  // a third-party link) passes through untouched.
  return catalogUrl.replace(
    /^(https?:\/\/(?:www\.)?zinzino\.com\/shop\/)site(\/)/i,
    `$1${partnerId}$2`,
  );
}
