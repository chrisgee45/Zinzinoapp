import { useEffect, useState } from "react";

// Theme preference the partner has chosen. 'system' follows the OS-level
// prefers-color-scheme and re-evaluates if the OS setting flips while the
// app is open.
export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "bfa-theme";

function readStored(): ThemePref {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage can throw in private-mode Safari; fall through to default.
  }
  return "dark";
}

function osPref(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? osPref() : pref;
}

// Apply the resolved theme to <html> by toggling a class. We toggle
// .light only — the default (no class) is treated as dark so anything
// that hasn't been audited for light mode stays in the original look.
// The matching meta theme-color flip keeps iOS status-bar tinting honest.
function apply(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "light") root.classList.add("light");
  else root.classList.remove("light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#faf6ec" : "#0b1f33");
}

// Pre-React boot hook called from main.tsx so the first paint already has
// the right class on <html>. Without this the page flashes dark for one
// frame on light-mode partners.
export function initTheme(): void {
  apply(resolve(readStored()));
}

// React hook that exposes the current preference + resolved value and
// gives setters that update storage + DOM together.
export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(() => readStored());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readStored()));

  useEffect(() => {
    const next = resolve(pref);
    setResolved(next);
    apply(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Ignore — see readStored().
    }
  }, [pref]);

  // When the partner picked 'system' we listen for OS theme changes so a
  // night-shift flip propagates without a reload. The listener is a no-op
  // in non-system mode but cheap to keep mounted.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const next = osPref();
      setResolved(next);
      apply(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref]);

  return {
    pref,
    resolved,
    setPref: setPrefState,
  };
}
