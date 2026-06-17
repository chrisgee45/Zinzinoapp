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
    <AuthShell>
      <button
        onClick={() => setLocation("/customers")}
        className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4 transition"
      >
        <ArrowLeft className="h-3 w-3" /> Back to customers
      </button>

      <article
        className="bfa-card-strong p-5 sm:p-6 mb-4 sm:mb-5 relative overflow-hidden bfa-animate-in"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "var(--gold)" }} />
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="h-14 w-14 rounded-2xl grid place-items-center font-display text-xl shrink-0"
            style={{
              background: "color-mix(in oklab, var(--gold) 14%, transparent)",
              color: "var(--gold)",
              border: "1px solid var(--border-gold)",
            }}
          >
            {customer.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="bfa-eyebrow">Customer file</p>
            <h2 className="font-display text-[22px] sm:text-[26px] font-bold mt-1 leading-tight truncate">
              {customer.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1.5">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
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
          <p
            className="text-[13px] text-muted-foreground border-l-2 pl-3 italic mt-4 leading-relaxed"
            style={{ borderColor: "var(--border-gold)" }}
          >
            {customer.notes}
          </p>
        )}

        {customer.introducedProducts.length > 0 && (
          <div className="mt-4">
            <p className="bfa-eyebrow mb-2">Products introduced</p>
            <div className="flex flex-wrap gap-1.5">
              {customer.introducedProducts.map((p) => (
                <span
                  key={p}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: "color-mix(in oklab, var(--gold) 10%, transparent)",
                    border: "1px solid var(--border-gold)",
                    color: "var(--gold)",
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {actionError && (
          <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2 mt-3">
            {actionError}
          </p>
        )}
      </article>

      <article className="bfa-card mb-4 overflow-hidden">
        <div
          className="p-4 sm:p-5 border-b"
          style={{ borderColor: "var(--border-muted)" }}
        >
          <h3 className="font-display text-base sm:text-lg font-bold">Conversation</h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Welcome, drip, and reply history. Inbound messages show the customer's words; outbound are sent in your voice.
          </p>
        </div>
        {thread.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">
            No messages yet. Send the welcome above or simulate an inbound message below.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
            {thread.map((m) => (
              <li
                key={m.id}
                className="px-4 sm:px-5 py-3.5"
                style={m.direction === "inbound" ? { background: "color-mix(in oklab, var(--success) 4%, transparent)" } : undefined}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className="bfa-eyebrow"
                    style={m.direction === "inbound" ? { color: "var(--success)" } : { color: "var(--gold)" }}
                  >
                    {m.direction === "inbound" ? "Customer wrote" : `You sent · ${m.kind}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                    {new Date(m.sentAt).toLocaleString()}
                  </span>
                </div>
                {m.subject && <p className="text-[13px] font-semibold mb-1">{m.subject}</p>}
                <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-foreground/90">{m.body}</p>
                {m.status !== "sent" && m.status !== "received" && (
                  <p className="text-[10px] mt-2" style={{ color: "var(--warning)" }}>Status: {m.status}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="bfa-card p-5 sm:p-6">
        <h3 className="font-display text-base sm:text-lg font-bold mb-1">Simulate a customer reply</h3>
        <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
          Paste what they wrote and the AI will draft and send a compliant response on your behalf.
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
      </article>
    </AuthShell>
  );
}
