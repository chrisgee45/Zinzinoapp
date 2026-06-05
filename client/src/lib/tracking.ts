/**
 * Per-partner tracking pixel loader (Meta, TikTok, GA4).
 *
 * Each funnel page calls loadTracking() with partner.content values; injected
 * scripts only fire when the corresponding ID is set. Event helpers no-op
 * when the underlying provider isn't loaded.
 */

export interface TrackingConfig {
  metaPixelId?: string;
  tiktokPixelId?: string;
  gaMeasurementId?: string;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, props?: Record<string, unknown>) => void; page: () => void };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    _bfaTrackingLoaded?: boolean;
  }
}

export function loadTracking(config: TrackingConfig): void {
  if (typeof window === "undefined") return;
  if (window._bfaTrackingLoaded) return;
  window._bfaTrackingLoaded = true;

  if (config.metaPixelId) injectMetaPixel(config.metaPixelId);
  if (config.tiktokPixelId) injectTikTokPixel(config.tiktokPixelId);
  if (config.gaMeasurementId) injectGA(config.gaMeasurementId);
}

function injectMetaPixel(id: string): void {
  if (document.getElementById("bfa-meta-pixel")) return;
  const s = document.createElement("script");
  s.id = "bfa-meta-pixel";
  s.text =
    "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
    `fbq('init','${id}');fbq('track','PageView');`;
  document.head.appendChild(s);
}

function injectTikTokPixel(id: string): void {
  if (document.getElementById("bfa-tiktok-pixel")) return;
  const s = document.createElement("script");
  s.id = "bfa-tiktok-pixel";
  s.text =
    "!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement('script');o.type='text/javascript',o.async=!0,o.src=i+'?sdkid='+e+'&lib='+t;var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};" +
    `ttq.load('${id}');ttq.page();}(window,document,'ttq');`;
  document.head.appendChild(s);
}

function injectGA(id: string): void {
  if (document.getElementById("bfa-ga")) return;
  const s1 = document.createElement("script");
  s1.id = "bfa-ga";
  s1.async = true;
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s1);
  const s2 = document.createElement("script");
  s2.text =
    "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());" +
    `gtag('config','${id}');`;
  document.head.appendChild(s2);
}

/** Fired when a prospect drops their email on the squeeze page (Step 1). */
export function trackLead(): void {
  try {
    window.fbq?.("track", "Lead");
    window.ttq?.track("Lead");
    window.gtag?.("event", "generate_lead");
  } catch {
    /* noop */
  }
}

/** Fired when a prospect completes the full application form (Step 3). */
export function trackCompleteRegistration(): void {
  try {
    window.fbq?.("track", "CompleteRegistration");
    window.ttq?.track("CompleteRegistration");
    window.gtag?.("event", "sign_up");
  } catch {
    /* noop */
  }
}

/** Fired when they view the longer breakdown video (Step 2 → 3 transition). */
export function trackViewContent(): void {
  try {
    window.fbq?.("track", "ViewContent");
    window.ttq?.track("ViewContent");
  } catch {
    /* noop */
  }
}
