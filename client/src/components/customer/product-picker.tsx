import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

// A single search hit as returned by /api/products/search. The
// advisor endpoint emits richer fields (brand, tagline, priceLine,
// url, factSheet) — we only need name + brand + priceLine on the
// picker so the typeahead row stays compact.
interface ProductHit {
  name: string;
  brand: string;
  tagline: string;
  priceLine: string;
}

interface Props {
  customerId: number;
  // Called after a successful add so the parent re-fetches the
  // customer detail and refreshes the products list.
  onAdded: () => void;
}

// Product picker — typeahead against the live Zinzino catalog
// (/api/products/search?q=…), confirms with a small variant/quantity
// form, then POSTs to /api/customers/:id/products. Built as a single
// component because the entire flow (search → pick → variant) is one
// short user interaction; splitting it would mean prop-drilling state
// for no gain.
export function ProductPicker({ customerId, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<ProductHit | null>(null);
  const [variant, setVariant] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Debounced search. 200ms feels snappy without spamming the API as
  // the partner types out a product name. Empty input clears the
  // dropdown rather than fetching everything.
  useEffect(() => {
    if (picked) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api<{ products: ProductHit[] }>(`/api/products/search?q=${encodeURIComponent(q)}`);
        setResults(data.products.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, picked]);

  // Close the dropdown when the user clicks outside the picker. The
  // input stays editable — we just collapse the result list so it
  // doesn't hover over other UI.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function reset() {
    setQuery("");
    setResults([]);
    setPicked(null);
    setVariant("");
    setQuantity(1);
    setError(null);
    setOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!picked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/customers/${customerId}/products`, {
        method: "POST",
        body: JSON.stringify({
          productName: picked.name,
          variant: variant.trim(),
          quantity,
        }),
      });
      reset();
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add the product.");
    } finally {
      setSubmitting(false);
    }
  }

  // Two-state UI:
  //   (1) typeahead — input + dropdown of catalog hits
  //   (2) variant capture — small inline form after a pick
  return (
    <div ref={containerRef} className="relative">
      {!picked ? (
        <>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search products — BalanceOil+, ZinoBiotic, Xtend…"
              className="pl-9"
            />
            {searching && (
              <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
            )}
          </div>
          {open && results.length > 0 && (
            <ul
              className="absolute z-30 top-full left-0 right-0 mt-1.5 rounded-xl border overflow-hidden max-h-72 overflow-y-auto"
              style={{
                background: "var(--surface-1)",
                borderColor: "var(--border-muted)",
                boxShadow: "0 14px 40px -10px rgba(0,0,0,0.45)",
              }}
            >
              {results.map((p) => (
                <li key={p.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(p);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[color-mix(in_oklab,var(--gold)_8%,transparent)] transition"
                  >
                    <p className="text-[13px] font-semibold leading-tight">{p.name}</p>
                    {p.priceLine && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.priceLine}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-xl border p-3.5 space-y-3"
          style={{ borderColor: "var(--border-gold)", background: "color-mix(in oklab, var(--gold) 5%, transparent)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">Adding</p>
              <p className="font-semibold text-[14px] mt-0.5 truncate">{picked.name}</p>
              {picked.priceLine && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{picked.priceLine}</p>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Cancel"
              className="text-muted-foreground hover:text-foreground transition shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_92px] gap-3">
            <div className="space-y-1">
              <Label htmlFor="variant" className="text-[11px]">Size / flavor (optional)</Label>
              <Input
                id="variant"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="e.g. 300 ml, Tutti Frutti"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quantity" className="text-[11px]">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              />
            </div>
          </div>
          {error && (
            <p className="text-[12px] text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" /> Add to file</>}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
