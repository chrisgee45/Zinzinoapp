import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColorCode } from "@shared/schema";
import { COLOR_CODES } from "@shared/schema";

const STORAGE_KEY = "bfa_funnel";

export interface FunnelState {
  leadId: number | null;
  email: string | null;
  partnerSlug: string | null;
  colorCode: ColorCode | null;
}

interface FunnelValue extends FunnelState {
  setStepOne: (input: { leadId: number; email: string; partnerSlug: string }) => void;
  setColor: (color: ColorCode) => void;
  clear: () => void;
}

const empty: FunnelState = { leadId: null, email: null, partnerSlug: null, colorCode: null };

function readStorage(): FunnelState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<FunnelState>;
    const color = typeof parsed.colorCode === "string" && (COLOR_CODES as readonly string[]).includes(parsed.colorCode)
      ? (parsed.colorCode as ColorCode)
      : null;
    return {
      leadId: typeof parsed.leadId === "number" ? parsed.leadId : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      partnerSlug: typeof parsed.partnerSlug === "string" ? parsed.partnerSlug : null,
      colorCode: color,
    };
  } catch {
    return empty;
  }
}

function writeStorage(state: FunnelState): void {
  try {
    if (!state.leadId) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

const FunnelContext = createContext<FunnelValue | null>(null);

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FunnelState>(empty);

  useEffect(() => {
    setState(readStorage());
  }, []);

  const setStepOne = useCallback((input: { leadId: number; email: string; partnerSlug: string }) => {
    // New email → always reset color so a returning prospect re-picks.
    const next: FunnelState = { leadId: input.leadId, email: input.email, partnerSlug: input.partnerSlug, colorCode: null };
    setState(next);
    writeStorage(next);
  }, []);

  const setColor = useCallback((color: ColorCode) => {
    setState((prev) => {
      const next = { ...prev, colorCode: color };
      writeStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setState(empty);
    writeStorage(empty);
  }, []);

  const value = useMemo<FunnelValue>(() => ({ ...state, setStepOne, setColor, clear }), [state, setStepOne, setColor, clear]);
  return <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>;
}

export function useFunnel(): FunnelValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error("useFunnel must be used inside <FunnelProvider>");
  return ctx;
}
