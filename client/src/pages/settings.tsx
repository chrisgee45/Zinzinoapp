import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BellOff,
  Check,
  Compass,
  CreditCard,
  ExternalLink,
  Facebook,
  FlaskConical,
  Globe,
  Heart,
  Instagram,
  Loader2,
  Lock,
  MessageSquareQuote,
  PlayCircle,
  Plus,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { DEFAULT_TESTIMONIALS, parseTestimonials, serializeTestimonials, type Testimonial } from "@/lib/testimonials";
import { parseHeadlineVariants, serializeHeadlineVariants } from "@/lib/headlineVariants";
import { parseYouTubeId } from "@/lib/youtube";
import { useAuth } from "@/lib/auth";
import { AuthShell, Section } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import {
  isStandalone,
  onInstallAvailable,
  promptInstall,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pwa";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { partner, loading, refresh } = useAuth();

  useEffect(() => {
    if (!loading && !partner) setLocation("/login");
  }, [loading, partner, setLocation]);

  if (loading || !partner) {
    return (
      <main className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--gold)]" />
      </main>
    );
  }

  return (
    <AuthShell title="Settings">
      <ProfileSection partner={partner} onSaved={refresh} />
      <BillingSection partner={partner} />
      <PublicSection partner={partner} onSaved={refresh} />
      <VideosSection />
      <HeadlineVariantsSection />
      <TestimonialsSection />
      <TrackingSection />
      <SeoSection partner={partner} onSaved={refresh} />
      <CoachingSection partner={partner} onSaved={refresh} />
      <DeviceSection />
      <SecuritySection />
    </AuthShell>
  );
}

type Partner = NonNullable<ReturnType<typeof useAuth>["partner"]>;
type SaveFn = () => Promise<void>;

interface SectionProps {
  partner: Partner;
  onSaved: SaveFn;
}

function useSaver(onSaved: SaveFn) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/auth/profile", { method: "PUT", body: JSON.stringify(body) });
      await onSaved();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return { save, saving, saved, error };
}

function StatusLine({ saving, saved, error }: { saving: boolean; saved: boolean; error: string | null }) {
  if (error) {
    return (
      <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  }
  if (saved) {
    return (
      <p className="text-sm text-emerald-300 inline-flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5" /> Saved
      </p>
    );
  }
  if (saving) {
    return <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</p>;
  }
  return null;
}

function ProfileSection({ partner, onSaved }: SectionProps) {
  const { save, saving, saved, error } = useSaver(onSaved);
  const [name, setName] = useState(partner.name);
  const [phone, setPhone] = useState(partner.phone ?? "");
  const [bio, setBio] = useState(partner.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(partner.photoUrl ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save({ name, phone: phone || null, bio: bio || null, photoUrl: photoUrl || null });
  }

  return (
    <Section
      title="Your story"
      icon={User}
      description="This is what shows up on your funnel page. Photo + bio = trust. A blank guide card converts ~3x worse than a real one."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-[160px_1fr] gap-4 items-start">
          <PhotoPreview url={photoUrl} name={name} />
          <div className="space-y-1.5">
            <Label htmlFor="photoUrl">Photo URL</Label>
            <Input
              id="photoUrl"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…/your-headshot.jpg"
              type="url"
              inputMode="url"
            />
            <p className="text-[11px] text-muted-foreground">
              Square headshot works best. Paste any public image URL — your Facebook profile photo, Imgur, etc.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (private)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              type="tel"
              inputMode="tel"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">Short bio</Label>
          <Textarea
            id="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A line or two about who you are and why this matters. Talk to one person, not 'an audience.'"
          />
          <p className="text-[11px] text-muted-foreground">
            Sweet spot: 2-3 sentences. Real, specific, human.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save story</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PhotoPreview({ url, name }: { url: string; name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (url) {
    return (
      <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl overflow-hidden ring-1 ring-[var(--gold)]/40 bg-secondary">
        <img
          src={url}
          alt="Profile preview"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    );
  }
  return (
    <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl bg-secondary/60 ring-1 ring-[var(--gold)]/30 grid place-items-center font-display text-4xl text-[var(--gold)]">
      {initials || "B"}
    </div>
  );
}

function PublicSection({ partner, onSaved }: SectionProps) {
  const { save, saving, saved, error } = useSaver(onSaved);
  const [enrollmentLink, setEnrollmentLink] = useState(partner.enrollmentLink ?? "");
  const [facebookUrl, setFacebookUrl] = useState(partner.facebookUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(partner.instagramUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(partner.tiktokUrl ?? "");

  const funnelUrl = `${window.location.origin}/${partner.slug}`;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save({
      enrollmentLink: enrollmentLink || null,
      facebookUrl: facebookUrl || null,
      instagramUrl: instagramUrl || null,
      tiktokUrl: tiktokUrl || null,
    });
  }

  return (
    <Section
      title="Links"
      icon={Globe}
      description="Your funnel URL is locked to your slug. Your enrollment link powers the soft 'Start now' CTA on the post-submit page."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Your funnel</p>
          <div className="flex items-center justify-between gap-3 mt-1">
            <p className="font-display text-base sm:text-lg truncate">{funnelUrl}</p>
            <a
              href={funnelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--gold)] text-xs inline-flex items-center gap-1 hover:underline shrink-0"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollmentLink">Zinzino enrollment link</Label>
          <Input
            id="enrollmentLink"
            value={enrollmentLink}
            onChange={(e) => setEnrollmentLink(e.target.value)}
            placeholder="https://www.zinzino.com/2019713973/us/en-us/"
            type="url"
            inputMode="url"
          />
          <p className="text-[11px] text-muted-foreground">
            Your personal replicated Zinzino store. Activates the &quot;Start with me now&quot; link on the post-submit page for hot prospects.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="facebookUrl"><Facebook className="inline h-3 w-3 -mt-0.5 mr-1" /> Facebook</Label>
            <Input
              id="facebookUrl"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/you"
              type="url"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instagramUrl"><Instagram className="inline h-3 w-3 -mt-0.5 mr-1" /> Instagram</Label>
            <Input
              id="instagramUrl"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/you"
              type="url"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tiktokUrl">TikTok</Label>
            <Input
              id="tiktokUrl"
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              placeholder="https://tiktok.com/@you"
              type="url"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save links</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function BillingSection({ partner }: { partner: Partner }) {
  const billingQuery = useQuery<{
    configured: boolean;
    status: string;
    hasCustomer: boolean;
    hasSubscription: boolean;
  }>({
    queryKey: ["billing-status"],
    queryFn: () =>
      api<{ configured: boolean; status: string; hasCustomer: boolean; hasSubscription: boolean }>(
        "/api/billing/status",
      ),
  });

  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    setLoading("checkout");
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start checkout.");
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    setError(null);
    setLoading("portal");
    try {
      const { url } = await api<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't open billing portal.");
    } finally {
      setLoading(null);
    }
  }

  const status = billingQuery.data?.status ?? partner.subscriptionStatus;
  const configured = billingQuery.data?.configured ?? false;
  const hasCustomer = billingQuery.data?.hasCustomer ?? Boolean(partner.stripeCustomerId);
  const isActive = status === "active" || status === "trialing";
  const isPastDue = status === "past_due" || status === "unpaid";
  const isCanceled = status === "canceled" || status === "incomplete_expired";

  return (
    <Section
      title="Billing"
      icon={CreditCard}
      description="$14.95/month for full platform access — funnel, dashboard, follow-up engine, coaching. Cancel any time."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/30 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Status</p>
            <p className="font-display text-xl mt-1">
              {isActive ? (
                <span className="text-emerald-300">Active</span>
              ) : isPastDue ? (
                <span className="text-amber-300">Past due</span>
              ) : isCanceled ? (
                <span className="text-zinc-400">Canceled</span>
              ) : (
                <span className="text-muted-foreground">Not subscribed</span>
              )}
            </p>
          </div>
          {isActive ? (
            <Button variant="secondary" size="sm" onClick={openPortal} disabled={loading === "portal"}>
              {loading === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4" /> Manage billing</>}
            </Button>
          ) : (
            <Button onClick={startCheckout} disabled={loading === "checkout" || !configured}>
              {loading === "checkout" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><CreditCard className="h-4 w-4" /> {hasCustomer ? "Resume subscription" : "Subscribe — $14.95/mo"}</>
              )}
            </Button>
          )}
        </div>

        {!configured && (
          <p className="text-xs text-muted-foreground bg-secondary/20 border border-border/40 rounded-lg px-3 py-2">
            Billing isn&apos;t configured on the server yet. Once <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PRICE_ID</code> are set, subscribe to activate.
          </p>
        )}

        {isPastDue && (
          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            Your last payment didn&apos;t go through. Use Manage billing to update your card.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Section>
  );
}

function VideosSection() {
  const queryClient = useQueryClient();
  const contentQuery = useQuery<{ content: Record<string, string> }>({
    queryKey: ["site-content"],
    queryFn: () => api<{ content: Record<string, string> }>("/api/site-content"),
  });

  const [teaser, setTeaser] = useState("");
  const [full, setFull] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contentQuery.data) {
      setTeaser(contentQuery.data.content.teaser_video_id ?? "");
      setFull(contentQuery.data.content.full_video_id ?? "");
    }
  }, [contentQuery.data]);

  const teaserParsed = parseYouTubeId(teaser);
  const fullParsed = parseYouTubeId(full);
  const teaserInvalid = teaser.trim().length > 0 && !teaserParsed;
  const fullInvalid = full.trim().length > 0 && !fullParsed;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (teaserInvalid || fullInvalid) {
      setError("One of the video URLs doesn't look like a YouTube link or ID.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const ops: Promise<unknown>[] = [];
      const original = contentQuery.data?.content ?? {};

      // Teaser
      if (teaserParsed && original.teaser_video_id !== teaserParsed) {
        ops.push(
          api("/api/site-content", {
            method: "PUT",
            body: JSON.stringify({ key: "teaser_video_id", value: teaserParsed }),
          }),
        );
      } else if (!teaser.trim() && original.teaser_video_id) {
        ops.push(api("/api/site-content/teaser_video_id", { method: "DELETE" }));
      }

      // Full
      if (fullParsed && original.full_video_id !== fullParsed) {
        ops.push(
          api("/api/site-content", {
            method: "PUT",
            body: JSON.stringify({ key: "full_video_id", value: fullParsed }),
          }),
        );
      } else if (!full.trim() && original.full_video_id) {
        ops.push(api("/api/site-content/full_video_id", { method: "DELETE" }));
      }

      await Promise.all(ops);
      await queryClient.invalidateQueries({ queryKey: ["site-content"] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save videos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Videos"
      icon={PlayCircle}
      description="Use your own videos so the funnel feels like yours, not a template. Paste a full YouTube link or just the 11-character video ID. Leave blank to use the default."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="teaserVideo">Step 2 video — the 5-minute teaser</Label>
          <Input
            id="teaserVideo"
            value={teaser}
            onChange={(e) => setTeaser(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or 11-char ID"
          />
          {teaser && teaserParsed && (
            <p className="text-[11px] text-emerald-300">Detected: {teaserParsed}</p>
          )}
          {teaserInvalid && <p className="text-[11px] text-destructive-foreground/90">Doesn&apos;t look like a YouTube link.</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullVideo">Step 3 video — the full breakdown</Label>
          <Input
            id="fullVideo"
            value={full}
            onChange={(e) => setFull(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or 11-char ID"
          />
          {full && fullParsed && (
            <p className="text-[11px] text-emerald-300">Detected: {fullParsed}</p>
          )}
          {fullInvalid && <p className="text-[11px] text-destructive-foreground/90">Doesn&apos;t look like a YouTube link.</p>}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Pro tip: make the teaser 4-6 min and the full breakdown 15-25 min. The teaser earns the right to ask for their time on the longer one.
        </p>

        <div className="flex items-center justify-between gap-3">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save videos</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function HeadlineVariantsSection() {
  const queryClient = useQueryClient();
  const contentQuery = useQuery<{ content: Record<string, string> }>({
    queryKey: ["site-content"],
    queryFn: () => api<{ content: Record<string, string> }>("/api/site-content"),
  });

  const [variants, setVariants] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contentQuery.data || hydrated) return;
    setVariants(parseHeadlineVariants(contentQuery.data.content.headline_variants));
    setHydrated(true);
  }, [contentQuery.data, hydrated]);

  function update(idx: number, value: string) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }
  function add() {
    if (variants.length >= 4) return;
    setVariants((prev) => [...prev, ""]);
  }
  function remove(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const cleaned = variants.map((v) => v.trim()).filter(Boolean);
      if (cleaned.length > 0) {
        await api("/api/site-content", {
          method: "PUT",
          body: JSON.stringify({ key: "headline_variants", value: serializeHeadlineVariants(cleaned) }),
        });
      } else if (contentQuery.data?.content.headline_variants) {
        await api("/api/site-content/headline_variants", { method: "DELETE" });
      }
      await queryClient.invalidateQueries({ queryKey: ["site-content"] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save variants");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="A/B test headlines"
      icon={FlaskConical}
      description="Up to 4 headline variants. Each visitor sees one at random and keeps that variant on repeat visits. Compare conversion in Meta/TikTok/GA using the Lead and CompleteRegistration events. Leave blank to use the default headline."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {variants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-5 text-center">
            <p className="text-sm text-muted-foreground mb-3">No variants yet — your funnel shows the default headline.</p>
            <Button type="button" size="sm" onClick={add}>
              <Plus className="h-3.5 w-3.5" /> Add a variant
            </Button>
          </div>
        ) : (
          variants.map((v, i) => (
            <div key={i} className="rounded-xl border bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`variant-${i}`}>Variant {String.fromCharCode(65 + i)}</Label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive-foreground/90 transition"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                id={`variant-${i}`}
                rows={2}
                value={v}
                onChange={(e) => update(i, e.target.value)}
                placeholder="Build a real second income — without quitting your day job."
                maxLength={200}
              />
              <p className="text-[11px] text-muted-foreground">{v.trim().length}/200</p>
            </div>
          ))
        )}

        {variants.length > 0 && variants.length < 4 && (
          <Button type="button" variant="secondary" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add another ({variants.length}/4)
          </Button>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save variants</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function TestimonialsSection() {
  const queryClient = useQueryClient();
  const contentQuery = useQuery<{ content: Record<string, string> }>({
    queryKey: ["site-content"],
    queryFn: () => api<{ content: Record<string, string> }>("/api/site-content"),
  });

  const [items, setItems] = useState<Testimonial[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contentQuery.data || hydrated) return;
    const parsed = parseTestimonials(contentQuery.data.content.testimonials);
    setItems(parsed && parsed.length > 0 ? parsed : []);
    setHydrated(true);
  }, [contentQuery.data, hydrated]);

  function update(idx: number, patch: Partial<Testimonial>) {
    setItems((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function add() {
    if (items.length >= 3) return;
    setItems((prev) => [...prev, { quote: "", name: "", context: "" }]);
  }

  function remove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function useDefaults() {
    setItems(DEFAULT_TESTIMONIALS.map((t) => ({ ...t })));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const cleaned = items.filter((t) => t.quote.trim() && t.name.trim());
      if (cleaned.length > 0) {
        await api("/api/site-content", {
          method: "PUT",
          body: JSON.stringify({ key: "testimonials", value: serializeTestimonials(cleaned) }),
        });
      } else if (contentQuery.data?.content.testimonials) {
        await api("/api/site-content/testimonials", { method: "DELETE" });
      }
      await queryClient.invalidateQueries({ queryKey: ["site-content"] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save testimonials");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Testimonials"
      icon={MessageSquareQuote}
      description="Up to 3 real partner stories. The first one you save also becomes the inline social proof next to the apply form on your breakdown page. Leave blank to use the platform defaults."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 p-5 text-center">
            <p className="text-sm text-muted-foreground mb-3">No custom testimonials yet — your funnel shows the platform defaults.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button type="button" variant="secondary" size="sm" onClick={useDefaults}>
                Start from defaults
              </Button>
              <Button type="button" size="sm" onClick={add}>
                <Plus className="h-3.5 w-3.5" /> Add your first
              </Button>
            </div>
          </div>
        )}

        {items.map((t, i) => (
          <div key={i} className="rounded-xl border bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Testimonial {i + 1}</p>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive-foreground/90 transition"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`t-quote-${i}`}>Quote</Label>
              <Textarea
                id={`t-quote-${i}`}
                rows={3}
                value={t.quote}
                onChange={(e) => update(i, { quote: e.target.value })}
                placeholder="A real story in their words. Specific beats generic."
                maxLength={500}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`t-name-${i}`}>Name</Label>
                <Input
                  id={`t-name-${i}`}
                  value={t.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Andi & Shannon"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`t-context-${i}`}>Context</Label>
                <Input
                  id={`t-context-${i}`}
                  value={t.context}
                  onChange={(e) => update(i, { context: e.target.value })}
                  placeholder="Immigrant story · Full-time family"
                />
              </div>
            </div>
          </div>
        ))}

        {items.length > 0 && items.length < 3 && (
          <Button type="button" variant="secondary" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add another ({items.length}/3)
          </Button>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save testimonials</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function TrackingSection() {
  const queryClient = useQueryClient();
  const contentQuery = useQuery<{ content: Record<string, string> }>({
    queryKey: ["site-content"],
    queryFn: () => api<{ content: Record<string, string> }>("/api/site-content"),
  });

  const [meta, setMeta] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [ga, setGa] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contentQuery.data) {
      setMeta(contentQuery.data.content.meta_pixel_id ?? "");
      setTiktok(contentQuery.data.content.tiktok_pixel_id ?? "");
      setGa(contentQuery.data.content.ga_measurement_id ?? "");
    }
  }, [contentQuery.data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const original = contentQuery.data?.content ?? {};
      const ops: Promise<unknown>[] = [];

      const sync = (key: string, value: string) => {
        const v = value.trim();
        const o = original[key] ?? "";
        if (v === o) return;
        if (v) {
          ops.push(api("/api/site-content", { method: "PUT", body: JSON.stringify({ key, value: v }) }));
        } else if (o) {
          ops.push(api(`/api/site-content/${key}`, { method: "DELETE" }));
        }
      };

      sync("meta_pixel_id", meta);
      sync("tiktok_pixel_id", tiktok);
      sync("ga_measurement_id", ga);

      await Promise.all(ops);
      await queryClient.invalidateQueries({ queryKey: ["site-content"] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save pixels");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Ad tracking pixels"
      icon={BarChart3}
      description="Fires PageView on every funnel page, Lead when someone drops their email, and CompleteRegistration when they finish the application. Leave blank to skip."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="metaPixel">Meta Pixel ID (Facebook / Instagram ads)</Label>
          <Input
            id="metaPixel"
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="123456789012345"
            inputMode="numeric"
          />
          <p className="text-[11px] text-muted-foreground">
            Find it in Meta Events Manager → Data sources → your pixel name.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tiktokPixel">TikTok Pixel ID</Label>
          <Input
            id="tiktokPixel"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="C7XXXXXXXXXXXXXXXXXX"
          />
          <p className="text-[11px] text-muted-foreground">
            TikTok Ads Manager → Assets → Events → your pixel.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gaId">GA4 Measurement ID</Label>
          <Input
            id="gaId"
            value={ga}
            onChange={(e) => setGa(e.target.value)}
            placeholder="G-XXXXXXXXXX"
          />
          <p className="text-[11px] text-muted-foreground">
            Google Analytics → Admin → Data Streams → your stream.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save pixels</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function SeoSection({ partner, onSaved }: SectionProps) {
  const { save, saving, saved, error } = useSaver(onSaved);
  const [seoTitle, setSeoTitle] = useState(partner.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(partner.seoDescription ?? "");
  const [seoKeywords, setSeoKeywords] = useState(partner.seoKeywords ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save({
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoKeywords: seoKeywords || null,
    });
  }

  return (
    <Section
      title="Search & sharing"
      icon={Compass}
      description="What people see when they Google you or share your link in messages. Defaults are fine if you skip these."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="seoTitle">Page title</Label>
          <Input
            id="seoTitle"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder={`${partner.name} · Build From Anywhere`}
            maxLength={70}
          />
          <p className="text-[11px] text-muted-foreground">{seoTitle.length}/70 — short and personal beats keyword stuffing</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seoDescription">Description</Label>
          <Textarea
            id="seoDescription"
            rows={3}
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            placeholder="A simple, high-leverage system to reclaim your time. See the 5-minute breakdown."
            maxLength={160}
          />
          <p className="text-[11px] text-muted-foreground">{seoDescription.length}/160</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seoKeywords">Keywords</Label>
          <Input
            id="seoKeywords"
            value={seoKeywords}
            onChange={(e) => setSeoKeywords(e.target.value)}
            placeholder="zinzino, balance oil, omega 3, side income"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save SEO</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function CoachingSection({ partner, onSaved }: SectionProps) {
  const { save, saving, saved, error } = useSaver(onSaved);
  const [emailNotifications, setEmailNotifications] = useState(partner.emailNotifications);
  const [toneProfile, setToneProfile] = useState<"friendly" | "direct" | "professional" | "faith_based">(partner.toneProfile);
  const [coachingMinimal, setCoachingMinimal] = useState(partner.coachingMinimal);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save({ emailNotifications, toneProfile, coachingMinimal });
  }

  return (
    <Section
      title="Coaching & voice"
      icon={Heart}
      description="Sets the tone of your auto-follow-up emails (when the bot lands in M2) and how often the coaching nudges you. You can change this any time."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="toneProfile">Your voice</Label>
          <Select
            id="toneProfile"
            value={toneProfile}
            onChange={(e) => setToneProfile(e.target.value as typeof toneProfile)}
          >
            <option value="friendly">Friendly — warm, casual, conversational</option>
            <option value="direct">Direct — no fluff, gets to the point</option>
            <option value="professional">Professional — polished, measured</option>
            <option value="faith_based">Faith-based — biblical framing, family-forward</option>
          </Select>
        </div>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border bg-secondary/30 p-4 hover:bg-secondary/50 transition">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
          />
          <div>
            <p className="font-semibold text-sm">Email me when leads come in</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              New lead, lead replies, handoff requests — all go to {partner.email}.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border bg-secondary/30 p-4 hover:bg-secondary/50 transition">
          <input
            type="checkbox"
            checked={coachingMinimal}
            onChange={(e) => setCoachingMinimal(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
          />
          <div>
            <p className="font-semibold text-sm">Keep coaching minimal</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shorter, less frequent daily nudges. Best if you already have your own rhythm.
            </p>
          </div>
        </label>

        <div className="flex items-center justify-between gap-3">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save preferences</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function DeviceSection() {
  const [installAvailable, setInstallAvailable] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "loading" | "on" | "off">("idle");
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => onInstallAvailable(setInstallAvailable), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("off");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushState(sub ? "on" : "off"))
      .catch(() => setPushState("off"));
  }, []);

  async function togglePush() {
    setPushError(null);
    if (pushState === "on") {
      setPushState("loading");
      await unsubscribeFromPush();
      setPushState("off");
      return;
    }
    setPushState("loading");
    const result = await subscribeToPush();
    if (result.ok) setPushState("on");
    else {
      setPushState("off");
      setPushError(result.reason ?? "Couldn't enable notifications.");
    }
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === "accepted") setInstallAvailable(false);
  }

  return (
    <Section
      title="This device"
      icon={Smartphone}
      description="Install the app to your phone so a tap on your icon opens your dashboard. Push notifications hit you in real time when leads come in."
    >
      <div className="space-y-3">
        {isStandalone() ? (
          <p className="text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 px-4 py-3 inline-flex items-center gap-2">
            <Check className="h-4 w-4" /> Running as an installed app
          </p>
        ) : installAvailable ? (
          <Button variant="secondary" onClick={handleInstall}>
            <Smartphone className="h-4 w-4" /> Install on this device
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Install prompt isn&apos;t available here. On iOS Safari: tap the share icon → &quot;Add to Home Screen&quot;.
          </p>
        )}

        <div className="pt-3 border-t border-border/40">
          <Button
            variant={pushState === "on" ? "primary" : "secondary"}
            onClick={togglePush}
            disabled={pushState === "loading"}
          >
            {pushState === "on" ? (
              <><Bell className="h-4 w-4" /> Notifications on — tap to disable</>
            ) : (
              <><BellOff className="h-4 w-4" /> Enable push notifications</>
            )}
          </Button>
          {pushError && (
            <p className="mt-2 text-xs text-destructive-foreground/90 bg-destructive/15 border border-destructive/30 rounded-lg px-3 py-2">
              {pushError}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordMismatch = useMemo(
    () => Boolean(newPassword && confirmPassword && newPassword !== confirmPassword),
    [newPassword, confirmPassword],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (passwordMismatch) {
      setError("New passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Security" icon={Lock} description="Change your password.">
      <form onSubmit={onSubmit} className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {passwordMismatch && <p className="text-xs text-destructive-foreground/90">Doesn&apos;t match.</p>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <StatusLine saving={saving} saved={saved} error={error} />
          <Button type="submit" disabled={saving || passwordMismatch}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Update password</>}
          </Button>
        </div>
      </form>
    </Section>
  );
}
