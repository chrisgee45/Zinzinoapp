import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Mail, Pause, Play, Send, Sparkles, Trash2 } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string;
  aiPaused: boolean;
  emailConsent: boolean;
  welcomeSentAt: string | null;
  lastDripAt: string | null;
  introducedProducts: string[];
}

interface ThreadMessage {
  id: number;
  direction: "outbound" | "inbound";
  kind: string;
  subject: string | null;
  body: string;
  status: string;
  sentAt: string;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { partner, loading } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  const q = useQuery<{ customer: Customer; thread: ThreadMessage[] }>({
    queryKey: ["customer", id],
    queryFn: () => api<{ customer: Customer; thread: ThreadMessage[] }>(`/api/customers/${id}`),
    enabled: !!partner && !!id,
  });

  const customer = q.data?.customer;
  const thread = q.data?.thread ?? [];

  async function callAction(path: string, label: string, body?: object) {
    setActionBusy(label);
    setActionError(null);
    try {
      await api(path, body ? { method: "POST", body: JSON.stringify(body) } : { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["customer", id] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (label === "reply") setReply("");
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  if (loading || !partner || q.isPending || !customer) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  return (
    <AuthShell title={customer.name}>
      <button
        onClick={() => setLocation("/customers")}
        className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> Back to customers
      </button>

      <div className="bfa-card p-5 mb-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-2xl font-bold">{customer.name}</h2>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
            {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {customer.aiPaused ? (
              <Button size="sm" variant="ghost" onClick={() => callAction(`/api/customers/${id}/resume`, "resume")}>
                {actionBusy === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Play className="h-3.5 w-3.5" /> Resume AI</>}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => callAction(`/api/customers/${id}/pause`, "pause")}>
                {actionBusy === "pause" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Pause className="h-3.5 w-3.5" /> Pause AI</>}
              </Button>
            )}
            {!customer.welcomeSentAt && (
              <Button size="sm" onClick={() => callAction(`/api/customers/${id}/welcome`, "welcome")}>
                {actionBusy === "welcome" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Mail className="h-3.5 w-3.5" /> Send welcome</>}
              </Button>
            )}
            <Button size="sm" onClick={() => callAction(`/api/customers/${id}/drip`, "drip")}>
              {actionBusy === "drip" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="h-3.5 w-3.5" /> Send drip now</>}
            </Button>
          </div>
        </div>

        {customer.notes && (
          <p className="text-sm text-muted-foreground border-l-2 border-[var(--gold)]/40 pl-3 italic">
            {customer.notes}
          </p>
        )}

        {customer.introducedProducts.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Products introduced
            </div>
            <div className="flex flex-wrap gap-1.5">
              {customer.introducedProducts.map((p) => (
                <span key={p} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/30">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {actionError && (
          <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
            {actionError}
          </p>
        )}
      </div>

      <div className="bfa-card mb-4">
        <div className="p-4 border-b border-border/40">
          <h3 className="font-display text-lg font-bold">Conversation</h3>
          <p className="text-[11px] text-muted-foreground">
            Welcome, drip, and reply history. Inbound messages show the customer's words; outbound are sent in your voice.
          </p>
        </div>
        {thread.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">
            No messages yet. Send the welcome above or simulate an inbound message below.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {thread.map((m) => (
              <li key={m.id} className={`px-4 py-3 ${m.direction === "inbound" ? "bg-emerald-500/[0.04]" : ""}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {m.direction === "inbound" ? "Customer wrote" : `You sent (${m.kind})`}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {new Date(m.sentAt).toLocaleString()}
                  </span>
                </div>
                {m.subject && <p className="text-[12px] font-semibold mb-1">{m.subject}</p>}
                <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                {m.status !== "sent" && m.status !== "received" && (
                  <p className="text-[10px] text-amber-300 mt-2">Status: {m.status}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bfa-card p-4">
        <h3 className="font-display text-lg font-bold mb-1">Simulate a customer reply</h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Paste what they wrote and the AI will draft + send a compliant response on your behalf.
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!reply.trim()) return;
            void callAction(`/api/customers/${id}/reply`, "reply", { message: reply });
          }}
          className="space-y-2"
        >
          <Textarea
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="The customer just emailed you asking about…"
          />
          <Button type="submit" disabled={!reply.trim() || actionBusy === "reply"}>
            {actionBusy === "reply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send AI reply</>}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
