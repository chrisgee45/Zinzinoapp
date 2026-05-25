import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "bfa_funnel";

export interface FunnelState {
  leadId: number | null;
  email: string | null;
  partnerSlug: string | null;
}

interface FunnelValue extends FunnelState {
  setStepOne: (input: { leadId: number; email: string; partnerSlug: string }) => void;
  clear: () => void;
}

const empty: FunnelState = { leadId: null, email: null, partnerSlug: null };

function readStorage(): FunnelState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<FunnelState>;
    return {
      leadId: typeof parsed.leadId === "number" ? parsed.leadId : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      partnerSlug: typeof parsed.partnerSlug === "string" ? parsed.partnerSlug : null,
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
    const next: FunnelState = { leadId: input.leadId, email: input.email, partnerSlug: input.partnerSlug };
    setState(next);
    writeStorage(next);
  }, []);

  const clear = useCallback(() => {
    setState(empty);
    writeStorage(empty);
  }, []);

  const value = useMemo<FunnelValue>(() => ({ ...state, setStepOne, clear }), [state, setStepOne, clear]);
  return <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>;
}

export function useFunnel(): FunnelValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error("useFunnel must be used inside <FunnelProvider>");
  return ctx;
}
