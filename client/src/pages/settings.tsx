import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Check,
  Compass,
  ExternalLink,
  Facebook,
  Globe,
  Heart,
  Instagram,
  Loader2,
  Lock,
  PlayCircle,
  Save,
  Smartphone,
  Sparkles,
  User,
} from "lucide-react";
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
      <PublicSection partner={partner} onSaved={refresh} />
      <VideosSection />
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
