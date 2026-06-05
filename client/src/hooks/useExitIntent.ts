import { useEffect } from "react";

interface Options {
  enabled?: boolean;
  /** Storage key — used to ensure it only fires once per session per partner. */
  storageKey?: string;
  /** Grace period before the trigger is armed (ms). */
  delayMs?: number;
}

/**
 * Detects exit-intent on both desktop and mobile:
 * - Desktop: mouse leaves the viewport from the top
 * - Mobile: rapid scroll-up while past the fold (gesture commonly preceding back-tap)
 *
 * Fires `onIntent` at most once per page mount, and at most once per session per
 * storageKey (so revisits don't get hammered).
 */
export function useExitIntent(onIntent: () => void, { enabled = true, storageKey, delayMs = 7000 }: Options = {}): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (storageKey) {
      try {
        if (sessionStorage.getItem(storageKey) === "1") return;
      } catch {
        /* private mode etc. */
      }
    }

    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, delayMs);

    let fired = false;
    const fire = () => {
      if (fired || !armed) return;
      fired = true;
      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, "1");
        } catch {
          /* ignore */
        }
      }
      onIntent();
    };

    const onMouseLeave = (e: MouseEvent) => {
      if (e.relatedTarget !== null) return;
      if (e.clientY <= 12) fire();
    };

    let lastY = window.scrollY;
    let lastT = performance.now();
    const onScroll = () => {
      const y = window.scrollY;
      const t = performance.now();
      const dy = y - lastY;
      const dt = t - lastT;
      // Mobile heuristic: was below the fold, then yanked up fast.
      if (lastY > 500 && dy < -80 && dt < 220) {
        fire();
      }
      lastY = y;
      lastT = t;
    };

    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(armTimer);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled, onIntent, storageKey, delayMs]);
}
