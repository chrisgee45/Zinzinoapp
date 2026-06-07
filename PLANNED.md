# Build From Anywhere — Project Stack & Architecture

A multi-tenant SaaS partner platform for Zinzino network-marketing partners
(brand: **Adventure Out Wellness**). Each partner gets a branded
two-step-into-three-step squeeze funnel at `buildfromanywhere.com/[slug]`,
a private dashboard with lead pipeline, daily AI coaching, an auto-follow-up
email bot, Stripe billing, and a tiered training program.

This document is the source of truth for anyone (human or AI) picking up
the project. Keep it updated when you change anything structural.

---

## Live URLs

- **Production**: `https://buildfromanywhere.com` (Railway-hosted)
- **Repo**: `chrisgee45/Zinzinoapp` on GitHub
- **Working branch**: `claude/bfa-platform-rebuild-MIkEh`
- **DB**: Supabase project `nwvvblwjeqkfsjqitscx`
- **Storage**: Supabase Storage bucket `partner-photos`

---

## Tech stack

### Frontend
- **Vite 6** + **React 18** + **TypeScript 5**
- **Tailwind CSS v4** (CSS-first config via `@theme` in `index.css`)
- **shadcn/ui** (New York style — Button, Input, Label, Dialog, Select, Textarea, Badge)
- **Wouter** for routing (no React Router)
- **TanStack Query v5** for server state
- **Lucide React** for icons
- **vite-plugin-pwa** for install + service worker + offline shell

### Backend
- **Node 20+ / ESM**
- **Express 4**
- **tsx** for dev, **esbuild** for prod bundle (single `dist/server.js`)
- **Drizzle ORM** + **node-postgres (pg)**
- **bcryptjs** for password hashing
- **jsonwebtoken** for auth (30-day tokens in localStorage)
- **express-rate-limit** on auth and lead routes
- **multer** for multipart uploads
- **cookie-parser** + **cors**

### Database
- **PostgreSQL** (hosted by Supabase — Session pooler at port 5432)
- Migrations live in `drizzle/` (generated from `shared/schema.ts` via drizzle-kit)
- Schema is shared between client and server via `shared/schema.ts`

### Integrations
- **Stripe** — `$14.95/mo` subscription via Checkout + Customer Portal + webhook
- **Resend** — outbound email (bot follow-ups, partner notifications) + inbound webhook (Svix signature verified) for lead replies
- **Anthropic Claude** (`claude-sonnet-4-6`) — generates outbound bot emails and inbound replies; first-person partner voice with tone-profile awareness
- **OpenAI** (`gpt-4.1-mini`) — Shadow Partner AI message drafts (SMS + DM)
- **Supabase Storage** — partner photo uploads (REST API, no SDK)

### Deployment
- **Railway** for the Node server (autodeploys on push to the working branch)
- **Supabase** for Postgres + Storage
- Build: `npm run build` → `vite build` (client to `dist/client/`) + `esbuild` (server to `dist/server.js`)
- Start: `NODE_ENV=production node dist/server.js`

---

## File structure

```
.
├── shared/
│   └── schema.ts                # Drizzle schema + Zod validators (single source of truth for types)
│
├── server/
│   ├── index.ts                 # Express bootstrap, route mounting, catchup engine kick
│   ├── db.ts                    # pg Pool + Drizzle instance with auto-SSL for managed PG
│   ├── seed.ts                  # Seeds admin@example.com / admin2026 on boot
│   ├── tsconfig.json
│   ├── lib/
│   │   ├── jwt.ts               # signToken / verifyToken (30-day default)
│   │   └── stripe.ts            # Lazy Stripe init (null if STRIPE_SECRET_KEY missing)
│   ├── middleware/
│   │   └── auth.ts              # authenticate, optionalAuth, requireAdmin
│   ├── routes/
│   │   ├── auth.ts              # register, login, me, profile, password
│   │   ├── partners.ts          # GET /api/partner/:slug (public, embeds content map)
│   │   ├── leads.ts             # CRUD + status/notes/bot-pause + interest tracking + manual contacts
│   │   ├── push.ts              # VAPID public key + subscribe/unsubscribe
│   │   ├── visits.ts            # POST page-visit logging with hashed IPs
│   │   ├── site-content.ts      # Whitelisted key/value editor (headlines, pixels, testimonials, A/B variants)
│   │   ├── uploads.ts           # multer + Supabase Storage REST upload
│   │   ├── billing.ts           # Stripe checkout/portal/webhook
│   │   ├── admin.ts             # Cross-partner stats + partner CRUD
│   │   ├── coach.ts             # Shadow Partner: today's action + AI drafts
│   │   └── bot-webhook.ts       # Resend inbound (Svix-verified raw body)
│   ├── bot/
│   │   ├── clients.ts           # Anthropic + Resend lazy-init, BOT_FROM_DOMAIN
│   │   ├── prompts.ts           # PERSONA_PROMPT + REPLY_PROMPT + banned phrases
│   │   ├── email.ts             # sendBotEmail (looks like partner) + sendPartnerNotification
│   │   └── scheduler.ts         # In-memory setTimeout scheduler, 5-touch warm sequence, catchup, inbound reply handler
│   └── coach/
│       ├── signals.ts           # high_intent / follow_up_gap / fresh_lead / activation_rescue / default
│       ├── actions.ts           # actionFor(signal) → recommended action
│       └── openai.ts            # generateDrafts() with tone-aware system prompt, JSON-mode output
│
├── client/
│   ├── index.html               # Theme color + manifest link + Google Fonts preload
│   └── src/
│       ├── main.tsx             # ReactDOM.createRoot + initPwa
│       ├── App.tsx              # Wouter routes
│       ├── index.css            # Tailwind v4 @theme + custom .bfa-card / .bfa-btn primitives
│       ├── vite-env.d.ts        # vite/client + vite-plugin-pwa types
│       ├── data/
│       │   └── trainingContent.ts   # ALL training copy as TrainingModule[]
│       ├── lib/
│       │   ├── api.ts           # fetch wrapper, ApiError, JWT bearer auto-attach
│       │   ├── auth.tsx         # AuthProvider + useAuth (JWT in localStorage)
│       │   ├── funnelContext.tsx# Squeeze → presentation gating (leadId + email + slug)
│       │   ├── queryClient.ts   # TanStack Query defaults
│       │   ├── pwa.ts           # beforeinstallprompt, standalone detection, push subscribe
│       │   ├── photoUpload.ts   # Canvas resize to 1024px, multipart POST to /api/uploads/photo
│       │   ├── tracking.ts      # Meta Pixel / TikTok / GA4 lazy script injection + event helpers
│       │   ├── testimonials.ts  # Parse/serialize partner-custom testimonials JSON
│       │   ├── headlineVariants.ts  # Parse + deterministic-per-visitor pick
│       │   ├── youtube.ts       # parseYouTubeId() (used for headline variants UI only — video override removed for compliance)
│       │   └── utils.ts         # cn() — clsx + twMerge
│       ├── hooks/
│       │   └── useExitIntent.ts # Desktop mouseleave + mobile rapid scroll-up, sessionStorage de-dupe
│       ├── components/
│       │   ├── brand-mark.tsx
│       │   ├── ui/              # shadcn primitives (button, input, label, dialog, select, textarea, badge)
│       │   ├── layout/
│       │   │   └── auth-shell.tsx   # Top nav + mobile bottom tab bar (Dashboard/Training/Settings/Admin)
│       │   ├── funnel/
│       │   │   ├── lead-capture-modal.tsx     # Step-1 modal (name + email)
│       │   │   ├── exit-intent-modal.tsx      # Email-only "save it for later"
│       │   │   ├── meet-your-guide.tsx        # Partner photo + bio card on squeeze
│       │   │   └── testimonials.tsx           # 3-up testimonials (defaults or partner overrides)
│       │   ├── dashboard/
│       │   │   ├── add-contact-modal.tsx      # Manual lead create (botPaused=true)
│       │   │   └── today-move.tsx             # Shadow Partner "Today's ONE move" card
│       │   └── training/
│       │       ├── training-blocks.tsx        # BlockRenderer for 12 block kinds
│       │       └── training-nav.tsx           # Sticky side nav + reading-progress bar
│       └── pages/
│           ├── home.tsx                 # Marketing splash at /
│           ├── login.tsx, register.tsx, not-found.tsx
│           ├── dashboard.tsx            # Hub: stats, profile-incomplete nag, sub banner, Today's Move, lead pipeline
│           ├── lead-detail.tsx          # Lead view + pre-call intel (interest + timeline)
│           ├── settings.tsx             # Profile (photo upload), Billing, Links, A/B headlines, Testimonials, Tracking pixels, SEO, Coaching, Device, Security
│           ├── admin.tsx                # Cross-partner stats + partner management dialog
│           ├── training.tsx             # Hub: recommended module + journey timeline + reference cards
│           ├── training-level.tsx       # Per-module page: hero + sticky step nav + graduation + next-module CTA
│           ├── partner-landing.tsx      # Squeeze /[slug]
│           ├── partner-presentation.tsx # Step 2 /[slug]/presentation
│           └── partner-breakdown.tsx    # Step 3 /[slug]/breakdown + SubmittedView post-conversion
│
├── public/
│   ├── favicon.svg, icon.svg
│   ├── manifest.webmanifest     # Generated by vite-plugin-pwa
│   └── offline.html             # Hard-offline fallback (only fires when network is truly down)
│
├── drizzle/
│   ├── 0000_init.sql            # Initial 13-table schema
│   ├── 0001_add_lead_interest.sql
│   ├── 0002_add_lead_timeline.sql
│   └── meta/                    # drizzle-kit journal
│
├── dist/                        # Build output (gitignored)
├── drizzle.config.ts            # drizzle-kit config (points at shared/schema.ts)
├── vite.config.ts               # Vite + Tailwind + PWA config
├── components.json              # shadcn config (New York style)
├── postcss.config.js
├── tsconfig.json, server/tsconfig.json
├── package.json
├── .env.example
└── PLANNED.md                   # This file
```

---

## Database schema (13 tables, 5 enums)

All defined in `shared/schema.ts` via Drizzle. SQL migrations in `drizzle/`.

### Enums
- `event_type` — `login | page_view | training_view | link_click | prospect_added | message_sent | customer_added | checkout_started | checkout_completed`
- `tone_profile` — `friendly | direct | professional | faith_based`
- `alert_type` — `low_activity | activation_risk | follow_up_gap`
- `alert_status` — `open | resolved`
- `reminder_type` — `push | email | both`

### Tables

**`partners`** — partner accounts
- `id, email (unique), password, name, slug (unique)`
- `enrollmentLink, phone, bio, photoUrl, facebookUrl, instagramUrl, tiktokUrl`
- `seoTitle, seoDescription, seoKeywords`
- `stripeCustomerId, stripeSubscriptionId, subscriptionStatus` (default `inactive`)
- `emailNotifications, isAdmin`
- `toneProfile, coachingMinimal, coachingPausedUntil, rescueModeUntil`
- `lastAiCallDate, dailyAiCalls, dailyRegenerations` — rate-limit counters
- `createdAt`

**`leads`** — funnel prospects
- `id, partnerId (FK cascade), name, email`
- `phone, currentWork, futureVision, bestTime` — collected in step 3
- `status` — `new | qualified | engaged | handoff | customer | lost`
- `notes, botPaused`
- `interest` — `products | income | null` (post-submit page selection)
- `timeline` — `now | soon | researching | null` (step 3 question)
- `colorCode` — `green | red | yellow | blue | null` (Color Code router pick from step 2, validated via zod against `COLOR_CODES`, stored as `text` to mirror the `interest`/`timeline` pattern)
- `whatPulledIn` — optional free-text from the booking form
- `detailsSubmittedAt` — timestamptz, NULL until the first `PATCH /:id/details`. **This is the base time for the warm email sequence**, not `createdAt`. Stamped once on first submit; re-submits do not shift it.
- `createdAt`
- Indexed on `(partnerId)`, `(partnerId, createdAt)`

**`siteContent`** — partner-customizable copy/config
- Whitelisted keys only:
  - `headline`, `subheadline`, `headline_variants` (A/B JSON array)
  - `testimonials` (JSON array)
  - `meta_pixel_id`, `tiktok_pixel_id`, `ga_measurement_id`
- ❌ `teaser_video_id` and `full_video_id` were removed for compliance — videos are platform-controlled only
- Server filters blocked keys from public partner response (defense in depth)

**`settings`** — global key/value (admin-managed)

**`pushSubscriptions`** — Web Push (VAPID) subscriptions per partner

**`pageVisits`** — landing/presentation/breakdown/main/dashboard views with hashed IP

**`events`** — Shadow Partner activity tracking (enum-typed)

**`aiRecommendations`** — daily cached coach recommendation
- Unique on `(partnerId, date)`
- `nextAction` jsonb, `messageDrafts` jsonb, `reasoning` jsonb, `completed`

**`rescuePlans`** — 72-hour self-rescue (built but UI not yet exposed)

**`trackedLinks`** — UUID PK, partner-owned tracked redirects (built but UI not yet exposed)

**`botEmails`** — every outbound bot email
- `touchNumber` (1-5 for warm sequence, 99 for replies)
- `leadType` — `warm | cold | reply`
- `status` — `sent | error:<reason>`

**`leadReplies`** — inbound replies from leads via Resend webhook

**`reminders`** — partner reminders (push/email/both)

---

## API surface

All routes prefixed `/api`. Auth = JWT in `Authorization: Bearer` header (also accepts cookie `bfa_token`).

### Public
- `GET /api/health` — health probe
- `GET /api/partner/:slug` — public partner data + filtered content map (videos stripped)
- `POST /api/leads` — step-1 lead create (rate-limited 12/min). **Schedules the stall track** (T+1h + T+48h) via `startStallTrack`. Returns `{ id }` only — schema-drift resilient.
- `PATCH /api/leads/:id/details` — step-3 form submit. **First submit only**: stamps `detailsSubmittedAt`, cancels any pending stall track, kicks off the warm sequence based off that timestamp, and fires the partner notification. Re-submits are bot no-ops.
- `PATCH /api/leads/:id/interest` — public, captures products/income selection on post-submit page
- `PATCH /api/leads/:id/color` — public, captures Color Code router pick from step 2 (`green | red | yellow | blue`). Last-write-wins overwrite.
- `POST /api/page-visits` — log a visit with hashed IP
- `POST /api/bot/inbound-email` — Resend webhook (Svix-verified raw body)
- `POST /api/billing/webhook` — Stripe webhook (raw body)

### Auth
- `POST /api/auth/register` — partner signup (no Stripe gate)
- `POST /api/auth/login` — returns JWT + session partner
- `GET /api/auth/me` — current partner
- `PUT /api/auth/profile` — update profile fields (Zod-validated, partial)
- `PUT /api/auth/password` — change password (current + new)

### Authenticated (partner)
- `GET /api/leads` — own pipeline
- `GET /api/leads/:id` — single lead
- `PATCH /api/leads/:id/status` — `new|qualified|engaged|handoff|customer|lost`
- `PATCH /api/leads/:id/notes`
- `POST /api/leads/:id/bot-pause` / `/bot-resume`
- `GET /api/leads/:id/bot-emails`
- `GET /api/leads/:id/replies`
- `DELETE /api/leads/:id`
- `POST /api/leads/bulk-delete`
- `POST /api/leads/contacts` — manual contact (creates lead with `botPaused=true`)

- `GET /api/site-content` — partner's content map
- `PUT /api/site-content` — upsert one key/value (whitelisted key only)
- `DELETE /api/site-content/:key`

- `GET /api/uploads/config` — `{ uploadsEnabled }`
- `POST /api/uploads/photo` — multipart, max 8MB, JPG/PNG/WEBP/GIF, returns Supabase Storage public URL

- `GET /api/billing/status` — configured + status + has customer/sub
- `POST /api/billing/checkout` — lazy-creates Stripe customer, returns Checkout URL
- `POST /api/billing/portal` — returns Customer Portal URL

- `POST /api/push/subscribe` — register Web Push subscription
- `POST /api/push/unsubscribe`
- `GET /api/push/public-key` — VAPID public key

- `GET /api/coach/today` — cached daily recommendation (computes via signals if none)
- `POST /api/coach/complete` — mark today's move done
- `POST /api/coach/generate-draft` — gpt-4.1-mini SMS+DM drafts (rate-limited: 2 calls/day)

### Admin (`isAdmin = true`)
- `GET /api/admin/stats` — partner / active sub / lead / 7-day lead counts
- `GET /api/admin/partners` — list with lead counts (last 500)
- `GET /api/admin/leads` — cross-partner lead list (last 500)
- `PUT /api/admin/partners/:id/subscription` — override status
- `POST /api/admin/partners/:id/reset-password`
- `POST /api/admin/partners/:id/update-email`
- `DELETE /api/admin/partners/:id` (blocks self-delete)

---

## Routes / pages (Wouter)

Order matters in `App.tsx` — specific routes before `/:slug` catch-all.

### Public marketing + auth
- `/` — home/marketing splash
- `/login`, `/register`, `*` (404)

### Authenticated (AuthShell)
- `/dashboard` — hub with subscription banner, profile-incomplete nag, Today's Move card, copy-link card, pipeline stats, lead pipeline with search/filter
- `/dashboard/leads/:id` — lead detail with pre-call intel, notes, status, bot pause/resume, delete
- `/settings` — all partner config sections
- `/training` — training hub with auto-recommended module
- `/training/:levelId` — per-module deep dive
- `/admin` — cross-partner admin (gated to `isAdmin`)

### Partner public funnel
- `/:slug` — squeeze + first 5-min video unlocks inline after capture; auto-scrolls to `#meet-your-guide` after the booking form submit
- `/:slug/presentation` — **legacy redirect** to `/:slug/breakdown` (was step 2; first video now plays inline on the landing page)
- `/:slug/breakdown` — Color Code question modal (page-level Dialog over blurred backdrop), color-matched video, booking form

### Special
- `/t/:token` — tracked link redirect (server-side, route reserved for M2 tracking implementation)

---

## Funnel mechanics

### Three-step flow

**Step 1 — `/:slug` squeeze + first video inline**
- No nav. Hero with brand pop, headline (A/B variant if set), video preview thumbnail (gold play overlay)
- Modal capture: name + email → `POST /api/leads` → returns `{ id }`. Modal button reads "Watch the 5-minute video."
- Stores `{ leadId, email, partnerSlug, colorCode }` in localStorage key `bfa_funnel` (in-memory mirror via FunnelProvider). `colorCode` resets to null on a new email so a returning prospect re-picks.
- On success the modal closes and **the locked thumbnail is replaced inline by the autoplaying iframe on the same page** — no navigation. The original behavior (navigate to `/:slug/presentation`) confused prospects who tapped the play button.
- Fires `Lead` event to Meta Pixel / TikTok / GA4
- Below the hero: 3 testimonials, the **MeetYourGuide** card with `id="meet-your-guide"` and `scroll-mt-24` (the submit-success destination), and a second CTA.
- After the form submit on step 3, the prospect lands on `/:slug#meet-your-guide`. The landing page runs an explicit `scrollIntoView` once partner data loads because wouter's SPA hash navigation isn't reliable when the target sits below async content.
- **Exit intent**: 7s arm delay then mouseleave (desktop) or rapid scroll-up (mobile) opens a softer "save it for later" modal (email-only); once per session per slug.

**Step 2 — `/:slug/presentation`**
- **Removed as a real page.** Now a one-shot redirect to `/:slug/breakdown` so cached tabs and old bookmarks still land somewhere sensible. The first 5-min video moved to the landing page (above). The color question moved to the breakdown page (below).

**Step 3 — `/:slug/breakdown`**
- Gated by funnel context (redirects to `/:slug` if no `leadId`).
- **Color Code question modal** (page-level Dialog using the existing Radix primitive). Opens automatically when `funnel.colorCode` is null, cannot be dismissed (no close button, escape disabled, click-outside disabled). The Radix overlay's `backdrop-blur-md` blurs the rest of the breakdown page behind it.
- Modal copy: eyebrow chip "One quick question", heading "What sounds **most like you**?" (key phrase in gold), four bubble buttons sized as fat oval pills using the primary gold gradient (`var(--gold-soft)` → `var(--gold-deep)`). **No color theming on the buttons** — the prospect sees a question, not a personality picker. The color tag writes silently via `PATCH /api/leads/:id/color`.
- Color → video lookup via `COLOR_VIDEO_IDS` map. All four colors currently point at the platform default `YvEULrrTdCw` (placeholder until Phase E records the four real videos).
- Iframe only mounts after a color is picked so YouTube doesn't pre-buffer audio behind the modal.
- Booking form (post-video): styled with `bfa-card-strong bfa-glow` and `FORM_FIELD` / `FORM_LABEL` local overrides for full-opacity inputs, gold-tinted borders, brighter labels and placeholders. Heading "Schedule a call with [first name]." with the first name in gold.
- Fields: phone, currentWork, futureVision, bestTime, **timeline** (now / soon / researching), and **`whatPulledIn`** (new optional textarea) → `PATCH /api/leads/:id/details`.
- On first submit only: stamps `detailsSubmittedAt`, cancels the stall track, kicks the warm sequence, fires the partner notification. Re-submits are bot no-ops.
- Fires `CompleteRegistration`.
- **Post-submit**: navigates to `/:slug#meet-your-guide` to land the prospect on the partner's About content. `funnel.clear()` is deliberately NOT called so the landing page recognizes them as already submitted (video stays unlocked, no re-prompt for email).

### Brand voice and content rules
- Income claims forbidden in copy
- Test-don't-guess framing on products side
- BalanceTest as differentiator (dried-blood-spot, 120-day cadence)
- No em dashes anywhere in training files (style choice)

---

## Email bot (`server/bot/`)

### Activation
- Bot routes through `botCanSend()` — true only if `ANTHROPIC_API_KEY` AND `RESEND_API_KEY` set
- All bot operations no-op gracefully when keys are missing

### Two tracks: stall (email-only) and warm (booked)

Per the one-hour barrier (COLOR-CODE-PLAN.md §9A). A lead is only ever on one track at a time.

**Stall track (email-only leads, 2 touches)**

| Touch | Minutes from `createdAt` | Human |
|---|---|---|
| 1 | 60 | T+1h |
| 2 | 2,880 | T+48h |

- Triggered from `POST /api/leads` via `startStallTrack(leadId)` (fire-and-forget).
- Each touch no-ops at fire time if `lead.detailsSubmittedAt` is set (they've since booked).
- The moment they book, `cancelStallTrack(leadId)` runs inside `startWarmSequence` and clears any pending stall timers.
- Scheduler keys: `${leadId}:stall:1`, `${leadId}:stall:2`.
- `botEmails` rows for these touches have `leadType = "stall"`.

**Warm sequence (booked leads, 5 touches, minutes from `detailsSubmittedAt`)**

| Touch | Minutes | Human |
|---|---|---|
| 1 | 15 | ~15 min |
| 2 | 1,710 | ~Day 2 |
| 3 | 4,440 | ~Day 3-4 |
| 4 | 10,200 | ~Day 7 |
| 5 | 20,280 | ~Day 14 |

- Triggered from `PATCH /api/leads/:id/details` (first submit only).
- **Base time is `lead.detailsSubmittedAt`, not `createdAt`.** Earlier behavior used `createdAt`, which made touch 1 fire immediately on submit whenever the prospect took more than 15 minutes between squeeze and book — that was the live double-send bug.
- Warm touch 1 prompt branches: if a `leadType="stall"` row already exists for this lead, the email opens by acknowledging the return instead of reintroducing, so it doesn't read like a cold restart.
- In-memory `setTimeout` scheduler, keyed by `${leadId}:warm:${touch}` (separate namespace from stall) so re-schedules are idempotent.
- Idempotency guard on send (checks `botEmails` table before insert, scoped by `leadType="warm"`).

### Generation
- **Model**: `claude-sonnet-4-6`
- **System prompt** (`server/bot/prompts.ts`): partner persona in first person, tone-profile-aware (friendly/direct/professional/faith_based), banned phrases (`"journey"`, `"amazing"`, `"game-changer"`, `"I wanted to reach out"`, etc.), plain text only, no em dashes, no bullets, single ask per email, first-name signoff
- Per-touch user prompt with lead context (name, currentWork, futureVision, bestTime, interest path, timeline)

### Email delivery
- **From**: `<partner-slug>@<BOT_FROM_DOMAIN>` with partner name as display name
- **Reply-To**: `<BOT_FROM_EMAIL>` (default `bot@<BOT_FROM_DOMAIN>`) — Resend routes inbound here
- Domain must be verified in Resend with SPF/DKIM

### Inbound (`POST /api/bot/inbound-email`)
- Raw-body Express handler mounted before `express.json()`
- Svix HMAC-SHA256 signature verification against `RESEND_SIGNING_KEY`
- Parses `email.received` events, looks up lead by from-email
- Persists to `lead_replies`
- Immediately emails the partner the preview
- Schedules 2-8min delayed Claude reply (feels human)
- Reply persisted as `touchNumber=99` in `bot_emails`
- **Handoff detection**: if reply contains `[HANDOFF_REQUESTED]` sentinel → bot paused, status = `handoff`, partner gets full transcript email

### Catchup engine
- Runs 5s after `app.listen()` with 45s stagger between past-due touches across both tracks.
- Branches per lead: `detailsSubmittedAt` set → warm track scheduled from that timestamp; null → stall track scheduled from `createdAt`. Idempotency by `leadType` so neither track re-sends what already shipped.

---

## Shadow Partner coaching (`server/coach/`)

### Signal engine
| Signal | Priority | Trigger |
|---|---|---|
| `high_intent` | 100 + reply count | Lead replied in last 7 days, not customer/lost |
| `follow_up_gap` | 80 + days | Qualified/engaged lead, no in/out activity 3-21 days |
| `fresh_lead` | 60 + hours-fresh | Net-new lead in last 24h, still `new` status |
| `activation_rescue` | 40 | Partner has zero leads |
| `default` | 0 | Always present so card never empties |

### Action recommendation
- Each signal kind maps to a coaching action (`actions.ts`)
- Includes title, body, channel (sms/dm/share/self), leadId/leadName for direct routing, rationale
- Cached daily per partner in `aiRecommendations` table (unique on `(partnerId, date)`)
- No AI call on page load — heuristics only

### AI drafts (`server/coach/openai.ts`)
- **Model**: `gpt-4.1-mini`
- JSON-mode output: `{ sms: string, dm: string }` (SMS <160 chars, DM 2-3 sentences)
- Tone-profile-aware, same banned-phrase list as the bot
- Rate-limited: 2 calls/day per partner via `partners.lastAiCallDate` + `dailyAiCalls`
- Quiet no-op when `OPENAI_API_KEY` missing

### Client (`client/src/components/dashboard/today-move.tsx`)
- "Today's ONE move" card at top of dashboard
- Color-toned border by signal kind (emerald/amber/gold/violet/neutral)
- "Draft message" button only when `aiAvailable=true`
- SMS + DM cards with copy buttons after generation
- Mark-done flow

---

## Training program (`/training`)

### Hub (`/training`)
- Auto-recommends module based on `partner.createdAt`:
  - `<7d` → Foundation
  - `<60d` → Level 1
  - `<120d` → Level 2
  - `<365d` → Level 3
  - older → Level 4
- Featured card with big gold serial number, badge, title, promise, "Begin" CTA
- 5-card journey timeline (Foundation + Levels 1-4) connected by gold hairline on desktop
- In-memory focus override (no storage per spec rule)
- Reference cards: Toolkit / Foundation re-link / Closing

### Per-level page (`/training/:levelId`)
- Sticky step nav on left (IntersectionObserver-driven active state)
- Reading progress bar fixed at top
- Hero with module number, badge, title, subtitle, promise, intro
- Step blocks (12 block kinds rendered by `BlockRenderer`)
- Graduation checklist for Levels 1-3
- "Continue to Level N" CTA card at the end
- Prev/next module crumbs

### Content modules
Source of truth: `client/src/data/trainingContent.ts` (single file, ~600 lines).

| Module | Steps | Notes |
|---|---|---|
| **Foundation** (Identity & Belief) | 8 | Canvas Principle, imposter, 5-belief stack, source of belief, language swap, 20-year vision exercise (step 6), 6 Questions reflecting on the vision (step 7), good/bad days |
| **Level 1** (Brand-New Partner, 120 days) | 7 + graduation | Why → List → Approach → Launch → Products → Fast Start Plan → Color Code |
| **Level 2** (Fast Started, Duplication) | 7 + graduation | Rhythm table, consistency, problem-solving, ECB/RCB/Team Commission tiles, Customer Career ladder, activator vs motivator, 4-part new-partner sequence |
| **Level 3** (Builder → Leader) | 6 + graduation | Lead with authority, curate circle, Color Code as leadership tool, 5-part recruiting engine, adapt, **Partner Career ranks table (in Credits to promote, not PP — PP shown as commission with USD conversion)** |
| **Level 4** (Leadership & Legacy) | 4 | All-in, life balanced/not balanced, Leaders Council, be the example |
| **Toolkit** | 3 | Script library (Grand Opening + Green/Red/Yellow/Blue + motivate-a-Red), Color wallet card, Comp Plan Map with glossary |
| **Closing** | 1 | Final Mindset Checklist |

### Block kinds (rendered by `BlockRenderer`)
`paragraph`, `bullets`, `pullquote`, `do_dont`, `exercise`, `checklist`, `tile_grid`, `story_card`, `script_card`, `color_card`, `comp_table`, `glossary`

### Design tokens
- **Colors** (from `client/src/index.css`):
  - `--navy` `#0b1f33` (bg)
  - `--gold` `#c9a84c` (brand accent)
  - `--teal` `#0fb5a9` (signal/success)
  - Color-Code content shades: green `#3fb87b`, red `#e85a4f`, yellow `#e8c054`, blue `#5ba8d6`
- **Fonts**: Libre Baskerville (display), Plus Jakarta Sans (sans)

### Compliance notes for training
- All Pay Point and rank figures are structural per the comp plan, not earnings guarantees
- 1 PP ≈ €1 ≈ ~$1.10 USD (rate floats, called out in glossary)
- Income disclaimer carried verbatim in the footer
- No personal performance data embedded
- Zero em dashes in any training file (style rule)

---

## Auth + session model

- **JWT** in `Authorization: Bearer <token>` (also accepts cookie `bfa_token`)
- Token signed with `JWT_SECRET`, default 30-day TTL
- Token stored in `localStorage` key `bfa_token` (client-side)
- `authenticate` middleware fetches the partner record and attaches to `req.partner` + `req.auth`
- `requireAdmin` checks `partner.isAdmin = true`
- Admin seeded on every boot: `admin@example.com` / `admin2026` (created if missing, isAdmin auto-promoted if present but not admin)

---

## Compliance & business rules

1. **Videos are platform-controlled** — partners cannot set teaser_video_id or full_video_id. Defense in depth across whitelist + server response filter + funnel reads + UI. Existing dormant rows are inert.
2. **No earnings claims** in copy, scripts, or AI prompts.
3. **No personal performance data** embedded in training.
4. **First-person partner voice** in bot emails — never third-person ("Chris will reach out" → "I'll reach out"). Reply prompt enforces with sentinel handoff.
5. **Handoff = bot pauses** for that lead, partner gets full transcript email.
6. **Leads scoped to their partner** — server queries always filter by `req.partner.id`.
7. **Rate limits**:
   - Auth routes: 30 req / 15 min
   - Lead create: 12 req / min
   - AI coach drafts: 2 / day per partner
8. **Subscription is soft-gated**: dashboard shows banner if status ≠ active/trialing, but routes don't block (early-stage forgiving UX). Admin bypasses banner.
9. **PWA + offline**: SPA navigations fall back to `/index.html` so Wouter routes work; `/offline.html` only fires on actual network failure (NetworkFirst with 5s timeout + precacheFallback).
10. **Mobile**: `touch-action: pan-y` on html + `overflow-x: hidden` on body/root to kill horizontal swipe whitespace.

---

## Environment variables

### Required for the app to run
- `DATABASE_URL` — Supabase Session pooler URI (port 5432) with project-ref-qualified user
- `JWT_SECRET` — long random string
- `PORT` — Railway sets this automatically

### Required for production-ready brand and uploads
- `SUPABASE_URL` — `https://nwvvblwjeqkfsjqitscx.supabase.co`
- `SUPABASE_SERVICE_KEY` — service_role secret (NOT the anon key)
- `SUPABASE_PHOTO_BUCKET` — defaults to `partner-photos`
- `PUBLIC_BASE_URL` — defaults to request host; set for stable Stripe redirects

### Billing
- `STRIPE_SECRET_KEY` — `sk_test_…` or `sk_live_…`
- `STRIPE_PRICE_ID` — `price_…` for the $14.95/mo recurring
- `STRIPE_WEBHOOK_SECRET` — `whsec_…` from `/api/billing/webhook` endpoint config

### Bot
- `ANTHROPIC_API_KEY` — `sk-ant-…`
- `RESEND_API_KEY` — `re_…`
- `RESEND_SIGNING_KEY` — Svix webhook secret (only for inbound)
- `RESEND_RECEIVING_API_KEY` — reserved (not yet used)
- `BOT_FROM_DOMAIN` — defaults to `buildfromanywhere.com` (must be verified in Resend)
- `BOT_FROM_EMAIL` — defaults to `bot@<BOT_FROM_DOMAIN>`

### Coach
- `OPENAI_API_KEY` — `sk-…`

### Web Push (optional)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — `npx web-push generate-vapid-keys`
- `VAPID_SUBJECT` — `mailto:…`
- `VITE_VAPID_PUBLIC_KEY` — same as public key; **must be set at build time** because Vite inlines `VITE_*`

### Misc
- `IP_HASH_SALT` — defaults to `"bfa"` (used to hash visitor IPs in `pageVisits`)

---

## Local dev

```bash
# 1. Install
npm install

# 2. Copy env
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET at minimum

# 3. Run schema migrations (one-time)
npx drizzle-kit push                  # or paste drizzle/0000_init.sql + 0001 + 0002 into Supabase SQL editor

# 4. Run dev (server + client concurrently)
npm run dev
# server on :5000, client on :5173 with proxy

# 5. Build
npm run build      # vite build + esbuild bundle
npm start          # NODE_ENV=production node dist/server.js
```

Type-check both halves: `npm run check`.

Generate a new migration after schema changes: `npx drizzle-kit generate --name <name>`.

---

## Common operations

### Add a new training session
Edit `client/src/data/trainingContent.ts`. Append to the appropriate level's `steps` array using the block kinds. No component changes needed.

### Add a new partner-customizable copy field
1. Add the key to the `CONTENT_KEYS` whitelist in `server/routes/site-content.ts`
2. Add a Settings section that PUTs/DELETEs the key
3. Read it on the funnel page via `partner.content?.<key>`

### Add a new lead column
1. Edit `shared/schema.ts`
2. Run `npx drizzle-kit generate --name add_lead_<field>` → review the SQL
3. Paste the ALTER TABLE into Supabase SQL editor (since we don't run drizzle-kit push in CI)
4. Wire it into routes / Zod schemas / forms

### Add a new bot touch
- `WARM_SEQUENCE_MINUTES` in `server/bot/scheduler.ts`
- Add a per-touch user prompt in `server/bot/prompts.ts`
- Increment `WARM_TOUCH_COUNT` is automatic from array length

### Run a manual lead deletion or cleanup
Use Supabase SQL editor. Examples:
```sql
-- Hard scrub video override rows (compliance — already inert via server filter)
DELETE FROM site_content WHERE key IN ('teaser_video_id', 'full_video_id');

-- Reset daily AI coach counters (if you need to bump a partner)
UPDATE partners SET daily_ai_calls = 0, daily_regenerations = 0, last_ai_call_date = NULL WHERE id = ?;
```

---

## Known gaps / future work

- `trackedLinks` table exists; client UI for creating tracked links isn't built
- `rescuePlans` table + RescueModeProvider not yet exposed in UI
- Cold sequence (manual contacts, 4 touches) not yet implemented — only warm sequence is wired
- `siteContent` rows don't expire — old keys can accumulate. Cleanup script could be added
- Inbound bot uses Resend's `email.received` payload directly without fetching the full body via `RESEND_RECEIVING_API_KEY`; that env var is reserved for when richer payload is needed
- No automated test suite — relies on type checking and manual smoke
- Cron-style scheduler is in-memory; if Railway restarts, catchup re-schedules. For multi-instance scaling, move to DB-backed scheduled jobs
- Subscription gating is currently a soft banner only; consider feature-flagging routes once user growth justifies it
- Partner photo uploads to Supabase Storage don't garbage-collect old photos when replaced
- The "Verify ICS calendar download" path is browser-side only; no server reminder yet

---

## Brand & content guidelines (for AI agents)

When writing or editing copy:

- **No em dashes** anywhere (use period + capitalize, comma, or colon)
- **First-person partner voice** for any bot/coach content ("I'll reach out", never third-person)
- **No earnings claims** in training, bot output, or marketing copy
- **Banned phrases** in bot/coach prompts: `journey`, `amazing`, `game-changer`, `I wanted to reach out`, `I hope this email finds you well`, `Just touching base`, `Synergy`
- **Plain text bot emails** — no markdown, no bullet points, no HTML
- **Tone profiles**: friendly / direct / professional / faith_based — all generation passes the partner's tone profile through the prompt
- **Test-don't-guess** is the brand framing for products (BalanceTest dried-blood-spot, 120-day cadence, omega 6:3 ratio 25:1 → <3:1)
- **Three income pillars** for compensation: customer commissions, team building, rank bonuses + trips
- **1 PP ≈ €1 ≈ ~$1.10 USD**; show USD in parentheses next to PP figures for US audience
- **Credits ≠ PP**: Credits = volume requirement to promote ranks; PP = commission earned

---

*Last updated: keep this in sync with code changes.*
