# Build From Anywhere — Color Code Funnel Build Plan

Companion to `PLANNED.md`. This is the build plan for the next upgrade: turning the
existing 3-step squeeze funnel into a **Color Code personality router** that tags every
lead by color (Green / Red / Yellow / Blue) and carries that color all the way through
the CRM and the AI email bot. It also covers the go-to-market rollout (launch party,
content sprint, team relaunch).

Source material: the recorded brainstorm, `colorcodetraining.pdf` (Adventure Out Wellness
Color Code recruiting training), and `CompensationPlan_USA_eng.pdf` (Zinzino USA comp plan).

Brand style is preserved throughout: no em dashes, no earnings claims, first-person partner voice.

---

## 1. The one-breath idea

This is a **partner recruiting funnel only** (not a consumer/customer funnel, that lives elsewhere).
Every person entering it is a prospective partner. The job of the funnel is not to filter buyers
from partners. It is to **read the prospect's color in one click**, then serve them the exact
video, the exact words, and the exact follow-up their personality is built to say yes to.

"You don't have a closing problem. You have a translation problem." The color code is the translator,
and we are wiring it into the software end to end.

---

## 2. Current funnel vs. target funnel

| Stage | Current (built today) | Target (this plan) |
|---|---|---|
| Step 1 `/:slug` | Squeeze: name + email modal | Same |
| Step 2 `/:slug/presentation` | One 5-min teaser video, then a single "Get the full breakdown" button | First 5-min video, then **a 4-button Color Code selector** in place of the single button |
| Color routing | None | Button click writes `colorCode` to the lead and routes to the matching video |
| Step 3 `/:slug/breakdown` | One platform breakdown video + gated application form | **Color-matched video** (one of 4 platform videos), then "Schedule a call with [partner]" reveals the form |
| Application form | phone, currentWork, futureVision, bestTime, timeline | Same, plus a "what pulled you in" capture |
| Lead record | interest (products/income), timeline | Adds `colorCode` (green/red/yellow/blue), captured before the second video |
| CRM view | Status pipeline | Lead shows a **color badge**; partner can correct the color |
| AI email bot | Tone-profile aware (partner voice) | Tone-profile aware **and color aware** (translates per the lead's color) |
| Email cadence | Starts at step 1 **and** restarts at step 3 (double-sends) | **One-hour barrier**: stall nudge for email-only leads vs. warm campaign for booked leads, never both |
| Coach drafts | Tone-profile aware | Color aware too |

Nothing built today is thrown away. The presentation and breakdown pages are extended,
not replaced.

---

## 3. Target funnel flow (step by step)

1. **Traffic in.** Prospect sees a TikTok, a paid ad, or comes in as a referred lead, and clicks through to `buildfromanywhere.com/[slug]`.
2. **Step 1 squeeze (`/:slug`).** They enter name + email to unlock the first video. `POST /api/leads` creates the lead. (Unchanged.)
3. **Step 2 first video (`/:slug/presentation`).** They watch the first 5-min video (platform default, partners cannot override). This video sets up the opportunity at a high level and is color-neutral.
4. **Color selector.** At the end of video one, instead of a single "Get the full breakdown" button, they see one question and **four buttons**. Whichever they tap is their self-declared color. The click fires `PATCH /api/leads/:id/color` and routes them onward.
5. **Step 3 color-matched video (`/:slug/breakdown`).** The system serves the video that matches their color (one of four platform videos). This video is about the business and becoming a partner, scripted in that color's language.
6. **Schedule the call.** After the color video, the CTA reads "Schedule a call with [partner name]" and reveals the **application form** (longer form: phone, what you do now, what you want, best time, timeline, and what pulled you in from the video).
7. **Into the lead system.** `PATCH /api/leads/:id/details` saves the form, the lead is now **color-tagged in the CRM**, the partner gets a new-lead notification, and the color-aware warm bot sequence begins.

---

## 4. The four color buttons (final copy)

One framing line above the buttons. Suggested: **"Which of these sounds most like you?"**
(Purely personality. No money/product filtering, because everyone here is a partner prospect.)

| Color | Button copy (final, from the brainstorm) | Routes to |
|---|---|---|
| **Green** (Analyst) | "Show me the data and proof" | Green video |
| **Red** (Driver) | "Just tell me what to do and how to win" | Red video |
| **Yellow** (Helper) | "How do I help people and build real relationships?" | Yellow video |
| **Blue** (Socializer) | "Build it the right way and have fun doing it" | Blue video |

Design notes:

- Use the existing Color Code content shades from `index.css`: green `#3fb87b`, red `#e85a4f`, yellow `#e8c054`, blue `#5ba8d6`.
- Keep each button to one short line so the read is instant. Each should make the right person think "yeah, that's me."
- These are deliberately driver-based, not interest-based, so they sort cleanly into the four scripts.

---

## 5. The four color videos (content requirement)

This is the content side of the build ("the scripts and the videos"). Four platform videos, one per color,
all about the business and partnering, each written from that color's script.

| Color | Magic word | What the video must lead with | What it must avoid |
|---|---|---|---|
| Green | proof | The BalanceTest, the data, before/after Omega ratio, the structure of the first 120 days, "you take the test, not my word" | Hype, pressure, "just trust me" |
| Red | win | A target, the rank ladder, the challenge framing, speed, "treat it like a real business" | Slow tours, over-explaining, anything that reads as managing them |
| Yellow | help | Helping real people feel better, walking alongside a friend, making the decision small and safe | Money, ranks, income figures (these repel a Yellow) |
| Blue | fun | Energy, people, the room, action, short and exciting | Long detail, PDFs, comp-plan walkthroughs |

Script source: these map directly to the existing **Toolkit script library** in `trainingContent.ts`
(Green / Red / Yellow / Blue scripts already exist). Reuse and adapt those for the video scripts so
the funnel and the training speak the same language.

Compliance for the Red video especially: income references must reflect the comp plan **structure only**
and never promise earnings. Keep the verbatim income disclaimer in the funnel footer.

---

## 6. Data model changes (`shared/schema.ts` + migration `0003`)

1. **New enum** `color_code`: `green | red | yellow | blue`.
2. **New column** `leads.colorCode` (nullable `color_code`). Nullable because it is set after step 2, not at lead creation.
3. **Optional column** `leads.whatPulledIn` (text, nullable) to store the "what pulled you in from the video" answer, if you want it separate from `futureVision`.
4. Generate the migration with `npx drizzle-kit generate --name add_lead_color_code`, review the SQL, then paste the `ALTER TABLE` into the Supabase SQL editor (per the project's no-push-in-CI convention).

No new table is needed. Color lives on the lead, exactly like `interest` and `timeline` do today.

---

## 7. API changes

1. **New public endpoint** `PATCH /api/leads/:id/color` — mirrors the existing `PATCH /api/leads/:id/interest` pattern: public, rate-limited, validates the color against the enum, writes `leads.colorCode`. Fired by the button click in step 2.
2. **Partner override** on `PATCH /api/leads/:id/status` route family (or a small dedicated authenticated patch) so a partner can **correct a lead's color** from the CRM if the prospect self-sorted wrong.
3. **Platform color videos**: add four platform-controlled video IDs (one per color) alongside the existing platform defaults (`l6bIKsVRsz0` teaser, `YvEULrrTdCw` breakdown). Keep them platform-controlled, **not** partner-overridable, to stay inside compliance rule 1 (videos are platform-controlled). Surface them in the public `GET /api/partner/:slug` response the same way current videos are, with the same server-side filter protecting against partner override.
4. **Tracking event**: fire a custom pixel event on color selection (Meta / TikTok / GA4 via the existing `tracking.ts` helpers) so you can measure color split and per-color conversion.

---

## 8. Frontend changes

1. **`funnelContext.tsx`**: add `colorCode` to the stored funnel context (`bfa_funnel` localStorage + in-memory mirror) so the breakdown page knows which video to show after a refresh.
2. **`partner-presentation.tsx`** (step 2): after the first video, render the four color buttons (new small component, e.g. `funnel/color-selector.tsx`). On click: `PATCH /api/leads/:id/color`, store color in funnel context, fire the tracking event, navigate to `/:slug/breakdown`.
3. **`partner-breakdown.tsx`** (step 3): read `colorCode` from funnel context, pick the matching platform video, and label the gate CTA "Schedule a call with [partner.name]". Keep the existing gated-form reveal and `PATCH /api/leads/:id/details` submit.
4. **CRM color badge**: in `dashboard.tsx` (pipeline rows) and `lead-detail.tsx`, show a color badge using the four content shades. In `lead-detail.tsx`, add a small control to change the color (calls the partner override from section 7.2).
5. **Pre-call intel**: in `lead-detail.tsx`, surface the color's "magic word + one move" (from the wallet card) so the partner walks into the call already knowing how to talk to this person.

---

## 9. Color-aware AI bot and coach

This is the payoff the brainstorm got most excited about: the color follows the lead into every message.

1. **Bot prompts (`server/bot/prompts.ts`)**: extend `PERSONA_PROMPT` and `REPLY_PROMPT` with a color-translation layer keyed off `lead.colorCode`. Compose it with the existing partner `toneProfile`:
   - Partner `toneProfile` (friendly / direct / professional / faith_based) = the partner's natural voice.
   - Lead `colorCode` = how to frame and translate for this specific prospect.
   - They stack. Example: a faith_based partner writing to a Red still leads with the challenge and the win, in their own voice.
2. **Per-color instruction** (drawn from the wallet card):
   - Green: lead with proof and structure, give homework and a deadline, then go quiet. No hype.
   - Red: compliment, compliment, then a challenge. Short. Point at the target.
   - Yellow: make it about helping people, make the next step tiny and safe, never lead with money.
   - Blue: short, fun, pointed at the next action or event. No long messages.
3. **Coach drafts (`server/coach/openai.ts`)**: pass `lead.colorCode` into the SMS/DM draft prompt so the suggested messages are already in the right color, same banned-phrase list applies.
4. **Banned phrases and plain-text rules** stay exactly as they are today.

---

## 9A. Email cadence barrier (the one-hour rule)

**Problem we are fixing.** Today a prospect who enters name + email on the teaser page gets pulled
into a follow-up campaign, and then completing the schedule-a-call form starts the campaign again as
if they were brand new. That double-sends and floods people. We are adding a barrier so the bot
understands the difference between "landed and watched" and "actually booked."

Two separate tracks. A lead is only ever on one at a time.

**Track 1 — Stall nudge (email-only lead).**

- Trigger: `POST /api/leads` (step 1, name + email).
- The bot does **not** start the warm campaign and sends nothing immediately.
- It schedules a single stall nudge for **T + 1 hour**, keyed `${leadId}:stall`.
- If at T + 1 hour the lead still has not submitted the schedule-a-call form, the bot sends one
  appropriate email: it acknowledges they landed and watched the first video but did not book yet, and
  invites them back to schedule. Soft, single ask.
- If they picked a color at the step-2 selector before bailing, this nudge is color-toned. If they left
  before picking a color, it uses the partner's neutral tone voice.

**Track 2 — Warm campaign (booked lead).**

- Trigger: `PATCH /api/leads/:id/details` (step 3, the schedule-a-call form with best time to contact).
- On submit, the bot first **cancels** any pending stall nudge (`clearTimeout` on `${leadId}:stall`), then
  starts the existing 5-touch warm sequence keyed from the submit time.
- The warm sequence starts **exactly once** per lead (idempotency guard), so completing the form can
  never restart a campaign that is already running.

**Happy path** (the whole funnel takes minutes): the prospect books within the hour, the stall nudge is
canceled before it ever fires, and they receive only the warm campaign. One clean track, no duplicates.

**Edge cases.**

- Never books: only the stall nudge fires (one email). A second stall touch on day 2 is optional, but the
  default is one to honor "don't flood."
- Books after the hour (stall already sent): the warm campaign starts, and warm touch 1 must acknowledge
  the booking instead of reintroducing, so it does not read like a cold restart.
- Server restart: the catchup engine re-evaluates. For an email-only lead created under an hour ago with
  no details, re-schedule the stall nudge. For booked leads, re-schedule missed warm touches as it does
  today. Never fire warm for an email-only lead.

**Implementation notes (against the current architecture).**

- "Booked" signal = the lead has submitted step-3 details. Reuse `leads.phone` / `bestTime` presence,
  which is already how warm-eligibility is determined today. Optionally add a `detailsSubmittedAt`
  timestamp for clarity.
- Record the stall send in `botEmails` with `leadType = stall` and `touchNumber = 0`, so the existing
  idempotency guard (checks `botEmails` before insert) prevents duplicate stall emails. This needs `stall`
  added to the `leadType` set.
- New scheduler key `${leadId}:stall`. Cancel it inside the details-submit handler before scheduling warm
  touches.
- New stall prompt in `server/bot/prompts.ts` (color-aware where color is known). Add a branch to the warm
  touch-1 prompt: if a stall email already exists for this lead, open by acknowledging the booking.

**Verify first.** `PLANNED.md` says the warm sequence is already triggered only on details submit, and
catchup only schedules leads with `phone` set, which means step 1 should not start a campaign today. Since
the live system clearly does send at step 1, there is a stray trigger somewhere (most likely an email fired
on `POST /api/leads`, or a catchup path that does not check for details). **Find and remove that stray
step-1 send first**, then layer the stall track on top. The double-send cannot be fully fixed until that
stray send is gone.

---

## 10. Compliance guardrails (carry forward, do not relax)

1. Color videos are **platform-controlled** like all other videos. Defense in depth: whitelist, server response filter, funnel reads, UI.
2. **No earnings claims** in any color video, button, bot output, or coach draft. The Red path is the highest risk here.
3. Income references reflect comp-plan **structure only**, with the verbatim disclaimer in the footer.
4. **First-person partner voice** in all bot and coach output.
5. **No em dashes** anywhere.
6. Leads stay scoped to their partner on every query.

---

## 11. Build sequence (phased, smallest shippable steps first)

**Phase A — Data and capture (backend)**

1. Add `color_code` enum + `leads.colorCode` (+ optional `whatPulledIn`) to `shared/schema.ts`, generate and apply migration `0003`.
2. Add `PATCH /api/leads/:id/color` (public) and the partner color-override patch.
3. Add the four platform color video IDs and expose them in `GET /api/partner/:slug` with the existing filter.

**Phase B — Funnel routing (frontend)**

4. Add `colorCode` to `funnelContext`.
5. Build the color selector on `partner-presentation.tsx` (component + tracking event).
6. Make `partner-breakdown.tsx` serve the color-matched video and the "Schedule a call with [partner]" gate.

**Phase C — CRM**

7. Color badge on dashboard pipeline and lead detail.
8. Partner color override control + "magic word / one move" pre-call intel on lead detail.

**Phase D — AI**

9. Color-translation layer in bot prompts (compose with tone profile).
10. Color-aware coach drafts.
11. Implement the one-hour cadence barrier (section 9A): stall track on lead creation, cancel-on-book, warm campaign only on details submit, and remove the stray step-1 send. This is also a live bug fix, so it can be pulled earlier if the double-send is hurting people now.

**Phase E — Content (runs in parallel with A through D)**

12. Finalize the four color video scripts from the Toolkit script library.
13. Record and upload the four color videos. Confirm the first color-neutral video stays as the platform default.

Phases A and B together produce the visible new funnel. C and D are the compounding value. E gates the real launch because the videos must exist before the relaunch party.

---

## 12. Open decisions to confirm

1. **"What pulled you in" field**: separate new column, or fold into the existing `futureVision`? (Plan assumes a separate optional column, easy to drop.)
2. **Color override visibility**: should the partner see the prospect's self-selected color, or only an internal flag? (Plan assumes the partner sees it and can correct it.)
3. **Re-routing**: if a lead comes back and picks a different color, do we overwrite or keep the first? (Suggest: overwrite, last choice wins, since it is self-declared.)
4. **First video**: confirm it stays one shared color-neutral video for everyone (plan assumes yes).
5. **Rep name on the CTA**: pull from `partner.name` (already available), confirm that is the rep they mean.
6. **Stall nudge length**: one email at the one-hour mark, or a short two-touch stall sequence? (Plan defaults to one, to honor "don't flood.")
7. **The one-hour window**: confirm 60 minutes is the right wait before the stall nudge, or tune it (most prospects finish the funnel in minutes, so 60 minutes is a safe "they left" signal).

---

## 13. Rollout plan (go-to-market)

From the brainstorm, the sequence is build first, then two parties with a content sprint in between.

1. **Finish and refine the site.** Get the color-code funnel built and the four videos live. This is the gate. Nothing else starts until the funnel works end to end.
2. **Core launch party (small, at the house).** Bring in the closest people (Autumn, Carr, Austin, and the inner circle). Walk them through the entire funnel: traffic in, squeeze, first video, color selector, color video, schedule-a-call, the CRM tagging, and the color-aware bot. The goal is for them to understand Build From Anywhere as a system.
3. **Content sprint.** Immediately after the walk-through, everyone makes social media videos (TikTok, etc.) that drive into the funnel. Strike while the energy is high.
4. **Team relaunch party (bigger).** Once the funnel is proven and the core team is fluent, run the larger relaunch for the existing team so the whole org understands the new system and starts driving traffic.

Suggested readiness checklist before the core launch party:

- [ ] Funnel works end to end on mobile for all four colors
- [ ] Color tag appears correctly in the CRM
- [ ] Bot sends a correctly color-toned first touch in a test lead
- [ ] A test lead that enters email but does not book gets exactly one stall email at about one hour, and no campaign
- [ ] A test lead that books gets the warm campaign only, with no duplicate "restart" email
- [ ] Four color videos uploaded and playing
- [ ] Income disclaimer present, no earnings claims anywhere
- [ ] Each core team member has their `[slug]` live and their profile photo/bio set

---

## 14. Appendix — Color cheat sheet (from `colorcodetraining.pdf`)

| Color | The tell (60-sec read) | Magic word | The one move | Funnel button | Words they love |
|---|---|---|---|---|---|
| **Green** Analyst | "How does it work? Where's the proof?" Calm, careful, reserved. | proof | Send the data, give a deadline, then go quiet. | "Show me the data and proof" | facts, logic, proof, data, results, research |
| **Red** Driver | "How much can I make?" Talks over you, decisive, impatient, wants control. | win | Compliment, compliment, then challenge them. | "Just tell me what to do and how to win" | money, power, leadership, competitive, #1, win, own it |
| **Yellow** Helper | "Who does this help?" Warm, kind, "let me think about it" forever. | help | Make it about people, and make the decision for them. | "How do I help people and build real relationships?" | help, support, care, family, together, feel better |
| **Blue** Socializer | Talks fast, jumps topics, "this sounds so fun!" Allergic to detail. | fun | Skip the detail, get them to the room, close fast. | "Build it the right way and have fun doing it" | fun, exciting, people, party, adventure, let's go, energy |

---

*Keep this plan in sync with `PLANNED.md` as the color-code feature ships.*
