# Stack & Security Boilerplate

The opinionated default stack we build client projects on. Drop this into a
new Claude Project as a knowledge file and any AI agent will know how to
extend an existing project or scaffold a new one correctly.

This is **prescriptive**, not aspirational. Don't swap pieces unless there's
a specific client constraint that requires it.

---

## TL;DR — the stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Vite 6 + React 18 + TypeScript 5** | Fast HMR, small prod bundles, mature ecosystem |
| Styling | **Tailwind CSS v4** (CSS-first @theme) | No JS config file, design tokens in CSS, fast |
| UI primitives | **shadcn/ui (New York style)** | Owned, themable, accessibility built in |
| Client routing | **Wouter** | 1.5 KB, hooks-based, simpler than React Router |
| Server state | **TanStack Query v5** | Cache, invalidation, optimistic updates done right |
| Icons | **lucide-react** | Tree-shakeable, MIT, consistent style |
| Backend | **Node 20 ESM + Express 4** | Boring, fast, every dep works |
| Build (server) | **esbuild** → single `dist/server.js` | One file, no node_modules walking at runtime |
| Build (client) | **vite build** → `dist/client/` | Standard |
| Dev runner | **tsx watch** | TS execution + reload without bundling |
| DB | **PostgreSQL on Supabase** (Session pooler) | Generous free tier, RLS, Storage, no infra |
| ORM | **Drizzle** + `drizzle-zod` | Type-safe, schema-first, sane migrations |
| DB driver | **node-postgres (pg)** | Battle-tested, works with Supabase pooler |
| Auth | **JWT (jsonwebtoken)** + **bcryptjs** | Stateless, simple, no session store needed |
| Payments | **Stripe** (Checkout + Customer Portal + webhook) | Industry standard, low friction |
| Email | **Resend** (outbound + inbound via Svix-verified webhook) | Modern API, good deliverability |
| Storage | **Supabase Storage** (REST API, no SDK) | Same provider as DB, public buckets for assets |
| AI (content) | **Anthropic Claude** (`claude-sonnet-4-6`) | Best for long-form first-person writing |
| AI (short drafts) | **OpenAI** (`gpt-4.1-mini`) | Cheap + fast for SMS/DM, JSON mode |
| File uploads | **multer** (memory storage) + client-side canvas resize | No native deps, small files only hit server |
| Validation | **Zod** | Single schema for runtime + types |
| Rate limiting | **express-rate-limit** | In-memory, swap for Redis if multi-instance |
| PWA | **vite-plugin-pwa** (generateSW, autoUpdate) | Workbox under the hood, install + offline + push |
| Deployment | **Railway** (autodeploy on branch push) | One service, env-var-driven, integrates Postgres |
| CI | **None initially** — type-check on push via Railway build | Add Github Actions only when team grows |

### Hard rules

- **ESM everywhere** — `"type": "module"` in package.json, `.js` extensions on internal imports in server code
- **No raw SQL** with user input — always Drizzle (parameterized)
- **No SDK if a REST call works** — keeps bundle and surface area small (Supabase Storage, Stripe webhook signature, Svix verification, etc.)
- **Service-role keys never leave the server** — client gets short-lived JWTs only
- **Webhooks always verify signatures** before processing
- **Every external API client lazy-inits** and returns `null` if env vars missing; routes return 503 with a clear message instead of crashing
- **Type-check both client and server** before every push: `npm run check`

---

## File structure (always)

```
.
├── shared/
│   └── schema.ts                # Drizzle schema + Zod validators (source of truth for types)
├── server/
│   ├── index.ts                 # Express bootstrap, route mounting, boot hooks
│   ├── db.ts                    # pg Pool + Drizzle, auto-enables SSL for managed PG
│   ├── seed.ts                  # Optional: seed admin user on boot
│   ├── tsconfig.json            # noEmit:true (build via esbuild, not tsc)
│   ├── lib/                     # External client wrappers (stripe.ts, etc.)
│   ├── middleware/              # auth.ts, etc.
│   ├── routes/                  # Per-resource: auth.ts, users.ts, billing.ts, uploads.ts, …
│   └── (feature dirs)/          # bot/, coach/, ingest/ — keep multi-file features grouped
├── client/
│   ├── index.html               # Theme color, manifest link, Google Fonts preload
│   └── src/
│       ├── main.tsx             # createRoot + initPwa
│       ├── App.tsx              # Wouter routes
│       ├── index.css            # Tailwind v4 @theme, brand tokens, component primitives
│       ├── vite-env.d.ts        # vite/client + vite-plugin-pwa types
│       ├── lib/                 # api.ts, auth.tsx, queryClient.ts, utils.ts (cn)
│       ├── hooks/
│       ├── components/
│       │   ├── ui/              # shadcn primitives (button, input, label, dialog, etc.)
│       │   ├── layout/          # AuthShell with top + mobile bottom nav
│       │   └── (feature)/       # Group by feature once >3 components
│       ├── data/                # Static content (training, copy, etc.)
│       └── pages/               # One file per route
├── public/
│   ├── favicon.svg, icon.svg
│   ├── manifest.webmanifest     # Generated by vite-plugin-pwa
│   └── offline.html             # Hard-offline fallback
├── drizzle/                     # Generated migrations (commit them)
├── dist/                        # Build output (gitignored)
├── package.json                 # "type": "module", "engines.node": ">=20"
├── tsconfig.json                # Client + shared
├── server/tsconfig.json         # Server (noEmit: true)
├── vite.config.ts               # Vite + Tailwind + PWA
├── drizzle.config.ts
├── components.json              # shadcn config
├── postcss.config.js            # @tailwindcss/postcss + autoprefixer
├── .env.example                 # Document every env var
├── README.md
└── STACK.md                     # This file (renamed per project)
```

Key conventions:

- **`shared/`** holds the schema + Zod validators that BOTH client and server import. Path alias: `@shared/*` on both sides.
- **Server uses `.js` extensions on imports** even though source is `.ts` (Node ESM requirement after build).
- **Client uses `@/*` path alias** (resolves to `client/src/*`).
- **One file per route** in `pages/`. Don't split a page into 8 files until it's >500 LOC.

---

## Build & deploy commands

```bash
# Dev (both server + client concurrently with hot reload)
npm run dev          # tsx watch + vite

# Type check both halves
npm run check

# Production build
npm run build        # vite build → dist/client/, esbuild → dist/server.js

# Production start
npm start            # NODE_ENV=production node dist/server.js
```

Server build (esbuild) command we standardize on:
```
esbuild server/index.ts --bundle --platform=node --target=node20 --format=esm \
  --outfile=dist/server.js --packages=external \
  --banner:js="import{createRequire}from'node:module';const require=createRequire(import.meta.url);"
```

The banner is required so CJS-only deps (like `pg`) work in our ESM output.

---

## Database conventions

### Source of truth

**`shared/schema.ts` is the only place tables and types are defined.**
Drizzle generates SQL migrations from it. Never hand-edit migrations after
generation — change the schema, regenerate.

### Migration workflow

```bash
# After editing shared/schema.ts:
npx drizzle-kit generate --name <descriptive_name>

# In dev — apply to local Supabase:
npx drizzle-kit push       # only for dev, or first-time setup

# In prod — generated SQL goes into Supabase SQL editor manually
# (we don't run drizzle-kit push in CI/CD)
```

Commit the generated `drizzle/000N_*.sql` files. They're a paper trail.

### Connection string

Always use the **Session pooler** (port 5432) URI, never the direct
connection. The direct connection (`db.{ref}.supabase.co`) is IPv6-only on
free tier and Railway can't reach it.

Correct format:
```
postgresql://postgres.{project_ref}:{password}@aws-X-{region}.pooler.supabase.com:5432/postgres
```

`postgres.{project_ref}` is required — the username includes the ref. Don't
strip it.

### SSL

We auto-enable SSL in `server/db.ts` when the connection string doesn't pin
`sslmode` and the host isn't localhost. Managed Postgres always requires it.

```ts
const needsSsl =
  !!connectionString &&
  !/sslmode=/.test(connectionString) &&
  !/localhost|127\.0\.0\.1/.test(connectionString);

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
```

### Naming

- Tables: `snake_case`, plural (`users`, `orders`)
- Columns: `snake_case`
- TypeScript identifiers: `camelCase` (Drizzle does the mapping)
- Primary key: `id serial` (or `uuid` if exposed publicly)
- Foreign keys: cascade on delete unless there's a reason not to
- Timestamps: `created_at timestamp with time zone` default now()

### Indexes — always add

- Every foreign key
- Every column you filter or order by in a list view
- Compound on `(parent_id, created_at)` for paginated child lists

---

## Supabase setup checklist (new project)

1. **Create project** at supabase.com — pick a region close to Railway
2. **Set strong DB password** (record it in 1Password)
3. **Get Session pooler URI** — Connect → Session pooler → URI tab
4. **Replace `[YOUR-PASSWORD]`** with the real password (no brackets!)
5. **Apply schema** — paste the generated `drizzle/0000_init.sql` into SQL editor
6. **Enable RLS** on every table (see RLS section below)
7. **Create Storage bucket(s)** — public for user-uploaded assets, private for everything else
8. **Generate service role key** — Settings → API → `service_role` secret
9. **Add Storage RLS policies** if the bucket is private

---

## Row Level Security (RLS) — required defaults

We use **service-role** connections from our server, which **bypasses RLS**.
But we still enable RLS on every table because:

1. **Defense in depth** — if anything ever connects with the `anon` key (a misconfigured client lib, a mistake), it should fail closed.
2. **Auditability** — explicit policies make security intent obvious.
3. **Future flexibility** — if we ever do direct-from-client queries (Supabase auth + supabase-js), we don't have to retrofit.

### The rule

```sql
-- For every table:
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Then either:
--   (a) Add explicit policies for anon/authenticated roles, OR
--   (b) Add no policies, which fails closed for anon/authenticated.
-- service_role bypasses RLS regardless.
```

### Standard policy patterns

**Owned-by-user table** (most common):
```sql
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notes"
  ON notes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users insert own notes"
  ON notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own notes"
  ON notes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notes"
  ON notes FOR DELETE
  USING (user_id = auth.uid());
```

**Public-read, owner-write table** (partner profiles, public posts):
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "owners update profiles"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Server-only table** (sensitive data: audit logs, internal bot state):
```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No policies at all. Only service_role can access.
```

### When the server uses JWT (our usual case)

Our server runs JWT-based auth and queries with the `postgres` user (service
role). `auth.uid()` in policies returns null in this context, so policies
that depend on it deny by default — that's correct: we never want clients
talking to the DB directly anyway. The server-side `req.partner.id` check is
the real gate; RLS is the safety net.

### Storage RLS

Storage objects also need policies. For a public bucket:

```sql
-- Anyone can read
CREATE POLICY "public read partner-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'partner-photos');

-- Authenticated users can upload to their own folder
CREATE POLICY "users upload own partner-photo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'partner-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

For our server-driven upload (service_role), neither policy matters — the
service role bypasses. But add them anyway for defense in depth.

---

## Auth model — JWT (default)

We use JWTs, not Supabase Auth, in most client projects. Reasons:

- No vendor lock to Supabase Auth
- Simpler permission model
- Our server is the only thing that talks to the DB

### Implementation pattern

- **bcryptjs** for password hashing, cost factor **12**
- **JWT** signed with `JWT_SECRET` (32+ char random), default **30-day TTL**
- Token stored in **`localStorage` key `bfa_token`** (or per-project name)
- Token sent as **`Authorization: Bearer <token>`** OR cookie `<prefix>_token`
- Middleware: `authenticate` fetches the user record and attaches to `req.partner` / `req.user`
- `requireAdmin` middleware for admin-only routes
- Optional `optionalAuth` middleware that attaches if token present but doesn't 401 if not

### Why localStorage and not httpOnly cookies

- We control the client (no third-party JS reading tokens via XSS we don't cause)
- SPA + API on same origin, no CSRF concerns
- Trivial to attach to fetch + simpler logout
- Acceptable trade-off for early-stage SaaS

If a client has stricter requirements (compliance, third-party scripts on the
SPA), swap to httpOnly cookies — middleware already supports both.

### Seeding admin

Always seed a default admin on boot (only creates if missing). Avoids "I
can't log in" lockout on fresh deploys.

---

## API conventions

### Surface

- All routes prefixed `/api`
- JSON in, JSON out (multipart only for uploads)
- Per-resource route files (`server/routes/users.ts`, `server/routes/orders.ts`)

### Request validation

Always Zod, never manual:

```ts
const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  name: z.string().trim().min(2).max(80),
});

router.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  // ...
});
```

### Status codes (use exactly these)

- `200` OK with body
- `201` Created (POST that creates a resource)
- `204` No Content (DELETE)
- `400` Invalid input (Zod failure)
- `401` Not authenticated
- `403` Authenticated but not authorized
- `404` Resource not found (or non-public partner)
- `409` Conflict (unique constraint, slug taken)
- `429` Rate limit hit
- `500` Server error (caught + logged)
- `502` Upstream failure (Stripe / Resend / Supabase down)
- `503` Feature not configured (missing env vars)

### Errors

Always `{ error: string }`. Include `issues` for Zod failures.

```ts
res.status(409).json({ error: "An account with that email already exists" });
```

### Rate limits

```ts
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 12 });

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/leads", writeLimiter, leadRoutes);
```

Don't rate-limit reads except in specific abuse cases.

---

## Webhooks — always verify signatures

Webhook routes must be mounted **before** `express.json()` so the raw body is
preserved for signature verification.

```ts
// In server/index.ts:
app.set("trust proxy", 1);

// Webhooks MUST be mounted before express.json() so they can read the raw body.
app.post("/api/billing/webhook", ...stripeWebhookHandler);
app.post("/api/inbound-email", ...inboundEmailHandler);

app.use(express.json({ limit: "100kb" }));
// ... rest of routes
```

### Stripe

`stripe.webhooks.constructEvent(rawBody, signature, secret)` — use the SDK
helper; don't roll your own HMAC.

### Svix (Resend, etc.)

```ts
const signedPayload = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
const secret = SIGNING_KEY.startsWith("whsec_")
  ? SIGNING_KEY.slice("whsec_".length)
  : SIGNING_KEY;
const secretBytes = Buffer.from(secret, "base64");
const expected = crypto.createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

const sigs = signatureHeader.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
const ok = sigs.some((s) =>
  crypto.timingSafeEqual(Buffer.from(s, "base64"), Buffer.from(expected, "base64")),
);
```

---

## Security defaults (every project)

1. **bcryptjs cost 12** for password hashing
2. **Rate limit auth + write routes**
3. **Webhook signature verification** for every webhook (Stripe + Svix-based)
4. **CORS** allowed only for known origins (in dev: localhost; in prod: the deployed domain)
5. **Hash IPs** before storing in analytics tables (sha256 + salt)
6. **Whitelisted key/value editors** (never accept arbitrary keys in a generic content store)
7. **Photo upload validation**: max size (8MB server-side, also resize client-side to ~1024px before upload), allowed mimes only (jpeg/png/webp/gif), random filename via `nanoid`
8. **SQL via Drizzle only** — no raw queries with user input
9. **Secrets never logged** — no `console.log(env.API_KEY)` in any code path
10. **`process.on("unhandledRejection")` + `uncaughtException`** swallow + log so the server doesn't restart on a single transient DB hiccup
11. **HTTPS-only in production** — `app.set("trust proxy", 1)` so rate limiters see the real IP behind Railway's proxy
12. **JWT secret in env**, never hard-coded; 32+ characters
13. **Service-role keys** only set on the server, never inlined into client builds
14. **`VITE_*` env vars** are public — they end up in the client bundle. Never put secrets there
15. **Auto-resize uploads client-side** so a 10MB iPhone photo lands at ~200KB before hitting the server — saves egress costs

---

## Frontend conventions

### Routing (Wouter)

- One page per route in `client/src/pages/`
- Specific routes BEFORE catch-alls in `App.tsx`
- Auth-gated pages use `useEffect` + `setLocation("/login")` on missing partner; show spinner during load to avoid hooks-rule violations
- Layout via `AuthShell` for authenticated routes (top nav + mobile bottom tabs)

### Hooks rule (the most common bug)

**All hooks at the top, before any early returns.** When a useMemo or useEffect
needs data that might not be loaded, read it through optional chains so the
hook is safe to call before data exists.

```tsx
// WRONG — hook count differs between loading and loaded renders
function Page() {
  const query = useQuery(...);
  if (query.isPending) return <Spinner />;
  const partner = query.data;
  const derived = useMemo(() => compute(partner.foo), [partner.foo]);  // 💥 React error #310
  return <View />;
}

// RIGHT — hook always runs, reads through optional chain
function Page() {
  const query = useQuery(...);
  const derived = useMemo(() => compute(query.data?.foo), [query.data?.foo]);
  if (query.isPending) return <Spinner />;
  return <View />;
}
```

### Forms

- Local `useState` for fields (don't reach for react-hook-form unless you need its features)
- Zod validate on submit
- Loading state during request
- Catch `ApiError`, surface `.message`; fallback to generic message
- After mutation, invalidate the relevant `useQuery` keys

### Auth context

Always `useAuth()` hook for the current partner + login/logout/register
helpers. Never read `localStorage` directly from a component.

### TanStack Query

- queryKey arrays, not strings
- `enabled: !!dependency` for queries that depend on something
- `retry: 0` for queries that have legitimate 404s (you know they may not exist)
- Invalidate the cache, don't `refetch()`, after a mutation

### Mobile

```css
html {
  background-color: #brand;       /* never let body bleed white */
  touch-action: pan-y;            /* kills horizontal swipe */
}
body, #root {
  max-width: 100vw;
  overflow-x: hidden;
}
```

Mobile drawer / bottom-tab nav in AuthShell. Test at 375px every time.

---

## Tailwind v4 + shadcn

### Tailwind v4 setup

- CSS-first via `@theme` in `index.css`
- `@tailwindcss/vite` plugin (don't use the PostCSS plugin for new projects unless you need it)
- Custom design tokens via CSS variables — partners/clients can override per-project

```css
@import "tailwindcss";
@plugin "tailwindcss-animate";

:root {
  --background: 215 60% 12%;
  --foreground: 210 30% 96%;
  /* ... */
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  /* ... */
}
```

### shadcn (New York style)

`components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "css": "client/src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Add components on demand (`npx shadcn add button`). Don't pre-install the kitchen sink.

---

## PWA pattern

### vite-plugin-pwa config

```ts
VitePWA({
  registerType: "autoUpdate",
  strategies: "generateSW",
  includeAssets: ["favicon.svg", "icon.svg", "offline.html"],
  manifest: {
    name: "App Name",
    short_name: "App",
    theme_color: "#brand",
    background_color: "#brand",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    scope: "/",
    icons: [...],
  },
  workbox: {
    // SPA: navigations fall back to index.html so client-side router takes over
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api/, /^\/offline\.html$/, /^\/manifest\.webmanifest$/, /^\/sw\.js$/],
    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
    runtimeCaching: [
      {
        // Hard offline fallback — only fires when network actually drops
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "navigations",
          networkTimeoutSeconds: 5,
          precacheFallback: { fallbackURL: "/offline.html" },
        },
      },
    ],
  },
}),
```

**Critical**: navigateFallback must be `/index.html`, NOT `/offline.html`.
Offline.html is reserved for actual network failures.

### Install + push helpers

`client/src/lib/pwa.ts` standardizes:
- `initPwa()` — listen for beforeinstallprompt
- `isStandalone()` — true if running as installed PWA
- `promptInstall()` — fire the deferred prompt
- `subscribeToPush()` / `unsubscribeFromPush()` — VAPID web push

---

## External integration patterns

### Stripe

```ts
// server/lib/stripe.ts
const SECRET = process.env.STRIPE_SECRET_KEY;
export const stripe = SECRET
  ? new Stripe(SECRET, { apiVersion: "2024-12-18.acacia" })
  : null;
```

- `POST /api/billing/checkout` — lazy-creates Customer, returns Checkout URL
- `POST /api/billing/portal` — returns Customer Portal URL
- `POST /api/billing/webhook` — raw body, signature verified, syncs `subscription_status` on user
- Subscribe to: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`

### Resend (email)

```ts
// server/bot/clients.ts (or wherever)
export const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;
```

Outbound from `slug@verified.domain` with display name. Reply-To set to a
catch-all so inbound routes back to your webhook.

Inbound webhook = raw body + Svix HMAC verification. Look up the lead/user
by from-email, persist the reply, optionally send back through your bot.

Verify your domain in Resend with SPF/DKIM/DMARC before going live.

### Anthropic Claude (content)

```ts
export const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

// Use claude-sonnet-4-6 for the best price/quality on long-form
const res = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 600,
  system: personaSystemPrompt(user),
  messages: [{ role: "user", content: userPrompt }],
});
```

System prompt = persona + voice + banned phrases. Keep it concrete:

```
You are {name}, writing in first person.
Voice: {tone description from user.tone_profile}.
Hard rules:
- Plain text. No markdown, no bullet points, no em dashes.
- Short sentences. Single ask per email.
- Never use these phrases: "journey", "amazing", "game-changer", "I wanted to reach out".
- Sign with just: {first name}
```

### OpenAI (short drafts)

```ts
export const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// Use gpt-4.1-mini for cheap fast structured drafts
const completion = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  messages: [
    { role: "system", content: system },
    { role: "user", content: user },
  ],
  response_format: { type: "json_object" },
  max_tokens: 400,
  temperature: 0.7,
});
```

Always use JSON mode when you need structured output. Validate the shape
with Zod after parsing.

### Supabase Storage (REST, no SDK)

```ts
const path = `${userId}/${nanoid()}.${ext}`;
const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    "Content-Type": file.mimetype,
    "x-upsert": "true",
  },
  body: file.buffer,
});
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
```

Resize client-side first via canvas to control upload size. Validate mime
and size on the server with multer.

---

## Environment variables — template

Document **every** env var in `.env.example`. Categorize:

```bash
# --- Required ---
DATABASE_URL=postgres://...                    # Supabase Session pooler URI
JWT_SECRET=                                    # 32+ char random; openssl rand -base64 48
PORT=                                          # Railway sets this automatically

# --- Supabase Storage (photo uploads) ---
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_KEY=                          # service_role secret, NOT anon
SUPABASE_PHOTO_BUCKET=user-photos              # defaults to user-photos

# --- Stripe (billing) ---
STRIPE_SECRET_KEY=sk_test_...                  # sk_test_ or sk_live_
STRIPE_PRICE_ID=price_...                      # Recurring price ID
STRIPE_WEBHOOK_SECRET=whsec_...                # From Stripe webhook config
PUBLIC_BASE_URL=                               # Defaults to request host; pin for stable redirects

# --- Email bot (Resend) ---
RESEND_API_KEY=re_...
RESEND_SIGNING_KEY=whsec_...                   # Svix secret for inbound webhook
BOT_FROM_DOMAIN=app.example.com                # Must be verified in Resend
BOT_FROM_EMAIL=bot@app.example.com             # Defaults to bot@<BOT_FROM_DOMAIN>

# --- AI (Anthropic + OpenAI) ---
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# --- Web Push (optional) ---
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=                             # npx web-push generate-vapid-keys
VAPID_SUBJECT=mailto:admin@example.com
VITE_VAPID_PUBLIC_KEY=                         # Same as public; MUST be set at build time

# --- Misc ---
IP_HASH_SALT=                                  # Used to hash visitor IPs
```

**Rule**: `VITE_*` vars are public (they get inlined into the client bundle).
Never put secrets in a `VITE_*` var. Same value gets duplicated as
`VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY` because one is server-side
runtime, one is client-side build-time.

---

## Deployment (Railway)

1. **Create Railway project**, connect GitHub repo
2. **Pick the working branch** for deploys (often `main`, but per-project)
3. **Add env vars** in Railway dashboard (paste from `.env.example`, fill values)
4. Railway auto-detects Node via package.json — confirms `build` + `start` scripts
5. **Add a custom domain** in Railway → Settings → Networking → Generate Domain or Custom Domain
6. **Update Stripe webhook URL** to the Railway domain
7. **Update Resend inbound webhook URL** if used
8. **Verify** with `/api/health` endpoint
9. **First-time DB**: paste `drizzle/0000_init.sql` into Supabase SQL editor, then enable RLS

### Railway gotchas

- Engine pinning matters: `"engines": { "node": ">=20" }` in package.json
- Don't run `drizzle-kit push` in build step — apply migrations manually via Supabase SQL editor
- `process.env.PORT` is auto-set; the server must read it (`Number(process.env.PORT ?? 5000)`)
- `app.set("trust proxy", 1)` is required so rate limiters see real client IPs through Railway's reverse proxy
- The server bundle must be `format=esm` because `package.json` has `"type": "module"`

---

## Brand & content style (defaults — override per client)

- **No em dashes anywhere** (period + capitalize, comma, or colon)
- **First-person voice** for any AI-generated user-facing content
- **No earnings, efficacy, or medical claims** in product copy or AI prompts
- **Plain-text emails** by default; HTML only when the client explicitly needs it
- **Banned phrases** for any AI-generated content: `journey`, `amazing`, `game-changer`, `I wanted to reach out`, `I hope this email finds you well`, `Just touching base`, `Synergy`
- **Compliance-locked** copy (videos, claims, comp plan figures) lives in code or admin-only stores, never in a generic content editor

---

## Common gotchas (collected from real bugs)

1. **Hooks after early returns** → React error #310. Always hoist hooks above any conditional return.
2. **Service worker serving stale offline.html for SPA routes** → set `navigateFallback: "/index.html"`, not `/offline.html`.
3. **Horizontal swipe whitespace on mobile** → `touch-action: pan-y` on html + `overflow-x: hidden` on body/root + paint html with brand color so nothing white can bleed.
4. **Supabase auth failing with IPv6 error** → wrong connection string; switch to Session pooler URI.
5. **Supabase password rejected** → either the `[YOUR-PASSWORD]` brackets weren't removed, or the username is missing the `.{project_ref}` suffix.
6. **Stripe webhook signature mismatch** → raw body parser must be mounted BEFORE `express.json()` for that route.
7. **PWA install icon broken** → manifest references PNG files that don't exist. Use SVG icons, OR commit actual PNGs.
8. **Railway 502 after deploy** → server crashing on boot. Check logs for missing env var, bad DATABASE_URL, or `process.env.PORT` not being read.
9. **vite-env.d.ts missing typing for VITE_* vars** → add `interface ImportMetaEnv` declaration in `client/src/vite-env.d.ts`.
10. **Stale service worker after a deploy** → unregister in DevTools → Application → Service Workers, clear site data, hard refresh. Don't trust autoUpdate to always catch.

---

## When to break the defaults

- **Use httpOnly cookies instead of localStorage** when there are third-party scripts on the SPA you don't control, or compliance requires it
- **Use Supabase Auth instead of JWT** if the client wants email magic links + social login without you building it
- **Use Redis for rate limiting** when scaling to multiple Railway replicas (in-memory rate limit isn't shared)
- **Use a job queue (BullMQ on Redis)** when scheduled work outgrows in-memory `setTimeout` (after ~hundreds of concurrent timers)
- **Use Cloudflare R2 or AWS S3** if Supabase Storage limits become a constraint
- **Use Postgres pgvector + RAG** when the client wants AI features grounded in their own corpus (notes, docs, history)
- **Split client/server into two repos** only when teams diverge; until then, monorepo is faster

---

## Checklist before first deploy

- [ ] All env vars filled in Railway dashboard
- [ ] DATABASE_URL uses Session pooler (port 5432), brackets removed from password
- [ ] JWT_SECRET is 32+ random chars
- [ ] `drizzle/0000_init.sql` pasted into Supabase SQL editor
- [ ] RLS enabled on every table (even if no policies — fails closed for anon/authenticated)
- [ ] Storage bucket created with correct public/private setting
- [ ] Storage RLS policies in place (or document why bypassed)
- [ ] Stripe webhook endpoint added, signing secret in env
- [ ] Resend domain verified with SPF/DKIM
- [ ] Resend inbound webhook URL set if using inbound
- [ ] `/api/health` returns 200
- [ ] Login + register work end-to-end
- [ ] PWA installs on mobile + offline shell renders
- [ ] No `console.log(env.SECRET_*)` anywhere
- [ ] Type-check passes: `npm run check`
- [ ] Manual smoke test of every page on 375px mobile + desktop

---

*Add this file to every Claude Project for client work. Keep it in sync —
when you discover a new gotcha or pattern, write it here.*
