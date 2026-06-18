import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  FlaskConical,
  Loader2,
  Mail,
  Package,
  Pause,
  PencilLine,
  Play,
  Receipt,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductPicker } from "@/components/customer/product-picker";
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
  billingDate: string | null;
  testDate: string | null;
  retestDate: string | null;
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

interface CustomerProduct {
  id: number;
  productName: string;
  variant: string | null;
  quantity: number;
  monthlyCreditCents: number;
  addedAt: string;
}

type Detail = { customer: Customer; thread: ThreadMessage[]; products: CustomerProduct[] };

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

  const q = useQuery<Detail>({
    queryKey: ["customer", id],
    queryFn: () => api<Detail>(`/api/customers/${id}`),
    enabled: !!partner && !!id,
  });

  const customer = q.data?.customer;
  const thread = q.data?.thread ?? [];
  const products = q.data?.products ?? [];

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

  async function removeProduct(productId: number) {
    setActionBusy(`rm-${productId}`);
    setActionError(null);
    try {
      await api(`/api/customers/${id}/products/${productId}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["customer", id] });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Couldn't remove the product.");
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

  // Total monthly partner credit across active products. Until the
  // commission data is populated per-product, every customer reads $0
  // here — the UI hides the line entirely in that case so it doesn't
  // look broken; once values are seeded, the row appears automatically.
  const totalCreditCents = products.reduce((sum, p) => sum + p.monthlyCreditCents * p.quantity, 0);

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

        {actionError && (
          <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2 mt-3">
            {actionError}
          </p>
        )}
      </article>

      <LifecycleCard
        customerId={Number(id)}
        billingDate={customer.billingDate}
        testDate={customer.testDate}
        retestDate={customer.retestDate}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["customer", id] });
        }}
      />

      <ProductsCard
        customerId={Number(id)}
        products={products}
        totalCreditCents={totalCreditCents}
        actionBusy={actionBusy}
        onRemove={removeProduct}
        onAdded={async () => {
          await queryClient.invalidateQueries({ queryKey: ["customer", id] });
        }}
      />

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

// ── LifecycleCard ──────────────────────────────────────────────────────
// Three date fields (billing, test, retest) on one row, each editable
// inline. PATCH /api/customers/:id with the changed field. Empty
// string clears the date; the server resets the corresponding
// reminder-sent timestamp so the scheduler picks up the new date on
// its next tick.

function LifecycleCard(props: {
  customerId: number;
  billingDate: string | null;
  testDate: string | null;
  retestDate: string | null;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<"billing" | "test" | "retest" | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);

  async function save(field: "billingDate" | "testDate" | "retestDate", value: string) {
    setSavingError(null);
    try {
      await api(`/api/customers/${props.customerId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value || "" }),
      });
      await props.onSaved();
      setEditing(null);
    } catch (e) {
      setSavingError(e instanceof ApiError ? e.message : "Couldn't save the date.");
    }
  }

  return (
    <article className="bfa-card mb-4 overflow-hidden">
      <div className="p-4 sm:p-5 border-b" style={{ borderColor: "var(--border-muted)" }}>
        <h3 className="font-display text-base sm:text-lg font-bold">Lifecycle</h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">
          Reminders go out to both you and the customer based on these dates.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--border-muted)" }}>
        <DateCell
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Next billing"
          value={props.billingDate}
          editing={editing === "billing"}
          onEdit={() => setEditing("billing")}
          onCancel={() => setEditing(null)}
          onSave={(v) => save("billingDate", v)}
          hint="3 days before billing, you both get a heads-up."
        />
        <DateCell
          icon={<FlaskConical className="h-3.5 w-3.5" />}
          label="Test taken"
          value={props.testDate}
          editing={editing === "test"}
          onEdit={() => setEditing("test")}
          onCancel={() => setEditing(null)}
          onSave={(v) => save("testDate", v)}
          hint="Day 15 reminder: check results at zinzinotest.com."
        />
        <DateCell
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Retest due"
          value={props.retestDate}
          editing={editing === "retest"}
          onEdit={() => setEditing("retest")}
          onCancel={() => setEditing(null)}
          onSave={(v) => save("retestDate", v)}
          hint="120 days after a fresh test is the standard cadence."
        />
      </div>
      {savingError && (
        <p className="text-[12px] text-destructive-foreground/90 bg-destructive/15 border-t border-destructive/30 px-4 py-2">
          {savingError}
        </p>
      )}
    </article>
  );
}

function DateCell(props: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (v: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(props.value ?? "");
  useEffect(() => setDraft(props.value ?? ""), [props.value, props.editing]);

  const display = props.value
    ? new Date(props.value + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Not set";

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {props.icon}
        <span className="text-[10.5px] uppercase tracking-[0.16em]">{props.label}</span>
      </div>
      {props.editing ? (
        <div className="mt-2 space-y-2">
          <Input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => void props.onSave(draft)}>Save</Button>
            <Button size="sm" variant="ghost" onClick={props.onCancel}>Cancel</Button>
            {props.value && (
              <Button size="sm" variant="ghost" onClick={() => void props.onSave("")}>Clear</Button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={props.onEdit}
          className="mt-1.5 text-left group block w-full"
        >
          <p className={`font-display text-[17px] sm:text-[18px] font-semibold ${props.value ? "" : "text-muted-foreground/60"}`}>
            {display}
            <PencilLine className="inline h-3 w-3 ml-2 opacity-0 group-hover:opacity-70 transition" />
          </p>
          <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug">{props.hint}</p>
        </button>
      )}
    </div>
  );
}

// ── ProductsCard ──────────────────────────────────────────────────────
// What the customer is on. Typeahead picker, list of active products,
// remove buttons. Partner credit total is hidden when zero (= no
// commission data populated yet) so the UI doesn't look broken.

function ProductsCard(props: {
  customerId: number;
  products: CustomerProduct[];
  totalCreditCents: number;
  actionBusy: string | null;
  onAdded: () => Promise<void>;
  onRemove: (productId: number) => Promise<void>;
}) {
  return (
    <article className="bfa-card mb-4 overflow-hidden">
      <div className="p-4 sm:p-5 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "var(--border-muted)" }}>
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold flex items-center gap-1.5">
            <Package className="h-4 w-4 text-[var(--gold)]" />
            Products
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            What this customer is currently on. Used by the AI when it writes their monthly check-in.
          </p>
        </div>
        {props.totalCreditCents > 0 && (
          <div
            className="rounded-lg px-3 py-2 text-right"
            style={{
              background: "color-mix(in oklab, var(--gold) 7%, transparent)",
              border: "1px solid var(--border-gold)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Your monthly credit</p>
            <p className="font-display text-[18px] font-bold tabular-nums" style={{ color: "var(--gold)" }}>
              ${(props.totalCreditCents / 100).toFixed(2)}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <ProductPicker customerId={props.customerId} onAdded={() => void props.onAdded()} />

        {props.products.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic">
            No products on file yet. Search above to add the first one.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-muted)" }}>
            {props.products.map((p) => (
              <li key={p.id} className="px-3.5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight">
                    {p.productName}
                    {p.quantity > 1 && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground font-normal">× {p.quantity}</span>
                    )}
                  </p>
                  {p.variant && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.variant}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void props.onRemove(p.id)}
                  disabled={props.actionBusy === `rm-${p.id}`}
                  aria-label="Remove product"
                  className="text-muted-foreground hover:text-destructive transition shrink-0"
                >
                  {props.actionBusy === `rm-${p.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
