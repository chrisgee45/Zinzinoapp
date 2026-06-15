/**
 * "The Build From Anywhere System", training content for Adventure Out Wellness.
 *
 * All copy lives here so new conference sessions can be added by appending to
 * `trainingContent`. Page components are purely presentational and render off
 * this structure. Source-of-truth: the Zinzino USA Compensation Plan + the
 * Schrandt / Goldberg / Saelle / Baskin / Ocean session notes + Big Al / Tom
 * Schreiter color personalities. No personal performance data is embedded.
 */

export type TrainingLevelId =
  | "foundation"
  | "level-1"
  | "level-2"
  | "level-3"
  | "level-4"
  | "toolkit"
  | "closing";

export type ColorCode = "green" | "red" | "yellow" | "blue";

export type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "pullquote"; quote: string; attribution?: string }
  | { kind: "do_dont"; doTitle?: string; dontTitle?: string; do: string[]; dont: string[] }
  | { kind: "exercise"; title: string; body: string; sample?: string }
  // Editable workbook block — partner types into a textarea, value is
  // persisted to siteContent under `storageKey`. Sample stays visible as a
  // reference. Print + Save-as-PDF + Send-upline (stub) actions render
  // alongside the textarea.
  | { kind: "editable_exercise"; title: string; body: string; sample?: string; storageKey: "vision_text" | "why_text"; printTitle: string }
  // 100-name workbook block. Renders a paginated form (10 rows per page x 10
  // pages = 100 rows). Persisted to siteContent under 'prospect_list' as a
  // JSON array. 'Import to CRM' button posts to /api/leads/import-list.
  | { kind: "hundreds_list_form" }
  | { kind: "checklist"; title?: string; items: string[] }
  | { kind: "tile_grid"; tiles: { eyebrow?: string; title: string; body?: string }[] }
  | { kind: "story_card"; title?: string; body: string; attribution?: string }
  | { kind: "script_card"; label: string; body: string; for?: ColorCode | "warm_market" }
  | { kind: "color_card"; cards: { color: ColorCode; trait: string; tell: string }[] }
  | {
      kind: "comp_table";
      caption?: string;
      headers: string[];
      rows: string[][];
      footnote?: string;
    }
  | { kind: "glossary"; entries: { term: string; def: string }[] };

export interface TrainingStep {
  id: string;
  number?: number;
  eyebrow?: string;
  title: string;
  blocks: Block[];
}

export interface TrainingModule {
  id: TrainingLevelId;
  badge: string;
  title: string;
  subtitle: string;
  promise?: string;
  intro?: string;
  steps: TrainingStep[];
  graduation?: { title: string; items: string[] };
}

/* ─────────────────────────── FOUNDATION ─────────────────────────── */

const foundation: TrainingModule = {
  id: "foundation",
  badge: "The Foundation",
  title: "Identity & Belief",
  subtitle: "Before tactics. Before scripts. This is who you decide you are.",
  intro:
    "Every level after this is a build on what you decide here. Don't skip it, even seasoned recruiters revisit the Foundation when momentum stalls. The work is internal, then everything external gets easier.",
  steps: [
    {
      id: "foundation-canvas",
      number: 1,
      eyebrow: "Identity",
      title: "The Canvas Principle",
      blocks: [
        {
          kind: "paragraph",
          text: "Who are you? Life is a canvas. Your words are the brush. Your business doesn't reflect what you can do. It reflects who you believe you are. You are who you say you are.",
        },
        {
          kind: "pullquote",
          quote: "The power of life and death is in the tongue.",
        },
        {
          kind: "paragraph",
          text: "What you say about yourself, over and over again, becomes the picture you live inside. Speak your future like it's already done.",
        },
      ],
    },
    {
      id: "foundation-imposter",
      number: 2,
      eyebrow: "Belief",
      title: "Overcome the imposter voice",
      blocks: [
        {
          kind: "paragraph",
          text: "Somewhere on the way in, a voice shows up and tells you, 'you don't deserve a seat at this table.' Answer it directly: yes you do.",
        },
        {
          kind: "pullquote",
          quote:
            "Every problem has a solution. Every question has an answer.",
        },
        {
          kind: "paragraph",
          text: "When the voice gets loud, you're closer to the seat than you think. Keep walking toward the table.",
        },
      ],
    },
    {
      id: "foundation-belief-five",
      number: 3,
      eyebrow: "Belief stack",
      title: "Believe in five things, in this order",
      blocks: [
        {
          kind: "tile_grid",
          tiles: [
            { eyebrow: "#1", title: "God", body: "First. Everything else builds on this." },
            { eyebrow: "#2", title: "You", body: "If you don't bet on yourself, no one else will either." },
            { eyebrow: "#3", title: "Your team", body: "The people walking with you are the proof you'll need on hard days." },
            { eyebrow: "#4", title: "Zinzino", body: "The vehicle. The products. The compensation plan. Real, paid, repeatable." },
            { eyebrow: "#5", title: "Network marketing", body: "If you don't believe this industry is the best path for ordinary people, no one will follow you into it." },
          ],
        },
      ],
    },
    {
      id: "foundation-source",
      number: 4,
      eyebrow: "Source",
      title: "Where your belief comes from",
      blocks: [
        {
          kind: "paragraph",
          text: "Belief is downstream of two things: your why and your conviction in the industry. The why is yours alone. The industry conviction is the one most partners under-invest in.",
        },
        {
          kind: "pullquote",
          quote:
            "If you don't believe this industry is the best path for ordinary people to grow, no one will follow you into it.",
        },
      ],
    },
    {
      id: "foundation-self-talk",
      number: 5,
      eyebrow: "Language",
      title: "Stop the self-fulfilling prophecy",
      blocks: [
        {
          kind: "paragraph",
          text: "The sentences you say about yourself become true. Catch them. Swap them.",
        },
        {
          kind: "do_dont",
          doTitle: "Speak this",
          dontTitle: "Kill these phrases",
          do: [
            "I'm becoming a great recruiter.",
            "People are drawn to what I'm building.",
            "I'm exactly the right person for this.",
            "I get better every single week.",
          ],
          dont: [
            "I'm not a good recruiter.",
            "I don't know anyone who'd be into this.",
            "I'm bad at sales.",
            "I'm just not consistent.",
          ],
        },
      ],
    },
    {
      id: "foundation-vision",
      number: 6,
      eyebrow: "Exercise",
      title: "Write your 20-year vision",
      blocks: [
        {
          kind: "editable_exercise",
          title: "Twenty-year vision: no limitations",
          body: "Write it in present tense, as if it's already true. Don't edit yourself. If your hand shakes a little, you're doing it right. Include income, family, health, the rooms you walk into, the rooms you walk OUT of, who you become.",
          sample:
            "I earn more than I ever imagined was possible for someone like me. My partner and I travel three months a year, backpacks, hiking boots, no agenda. We're showing our grandkids what living actually looks like, not what surviving looked like. I speak on stages with tens of thousands of people in the room. And I'm the same person backstage that I am with my family at the dinner table.",
          storageKey: "vision_text",
          printTitle: "My 20-Year Vision",
        },
      ],
    },
    {
      id: "foundation-six-questions",
      number: 7,
      eyebrow: "Identity audit",
      title: "The 6 Questions",
      blocks: [
        {
          kind: "paragraph",
          text: "Now stand at the end of your 20-year vision and look back. Imagine you achieved every line of what you just wrote. Rate each question 1 to 10 from that vantage point. The goal is 10. If anything's below an 8, that's your work for this season.",
        },
        {
          kind: "checklist",
          items: [
            "If I achieve this vision, how proud would my parents be?",
            "If I achieve this vision, how proud would my kids be?",
            "If I achieve this vision, how proud would my closest friends be?",
            "If I achieve this vision, how successful would I feel?",
            "If I achieve this vision, how proud would I be of who I became to get here?",
            "When I look at all of that, that's who I am. Do I believe it?",
          ],
        },
      ],
    },
    {
      id: "foundation-good-days",
      number: 8,
      eyebrow: "Mindset",
      title: "Good days and bad days",
      blocks: [
        {
          kind: "pullquote",
          quote:
            "On good days most people can create. On bad days most people create another bad day. Create on the bad days too.",
        },
        {
          kind: "paragraph",
          text: "This is the whole game. Everyone shows up on the easy days. The career is built on the hard ones.",
        },
      ],
    },
  ],
};

/* ─────────────────────────── LEVEL 1 ─────────────────────────── */

const level1: TrainingModule = {
  id: "level-1",
  badge: "Level 1",
  title: "The Brand-New Partner",
  subtitle: "First 120 Days",
  promise:
    "Acquire customers. Recruit partners. Duplicate. This is your launch window, to learn, to earn, and to get in balance.",
  intro:
    "The first 120 days set the pattern for the next 5 years. The shape is simple: get clear on your why → write the list → learn the approach → run the launch → use the products → execute the 120-day plan → learn to read people.",
  steps: [
    {
      id: "l1-why",
      number: 1,
      eyebrow: "Get clear",
      title: "Your why for this season",
      blocks: [
        {
          kind: "paragraph",
          text: "You wrote your 20-year vision in the Foundation. This is different. Your business 'why' for THIS season is the specific, present-day reason you're building this thing now. What needs to be different in 6 months? What conversation are you tired of having with your spouse? Whose life looks different if you actually pull this off?",
        },
        {
          kind: "paragraph",
          text: "Make it short. Make it specific. Make it something you'd say out loud to a friend without softening it.",
        },
        {
          kind: "pullquote",
          quote: "When the why is strong enough, the how shows up.",
        },
        {
          kind: "editable_exercise",
          title: "Your why in one paragraph, present tense",
          body: "Write one paragraph that names the change you're after, the person it's for, and what's at stake if you don't do this. Keep it under 100 words. Read it out loud every Monday morning for the next 12 weeks.",
          sample:
            "I'm building this so I can be home when my kids get off the bus instead of behind a desk until 6. I want my wife to know we have actual breathing room, not just barely-enough. If I don't do this, we keep making it work, but we never grow. Five years from now I want her to look back at this season and say, 'that's when everything changed.'",
          storageKey: "why_text",
          printTitle: "My Why",
        },
        {
          kind: "story_card",
          title: "Why this comes first",
          body: "Posture, scripts, lists, plans. They all flow downstream of conviction. The partners who keep moving when it's hard are the ones whose why outweighs the reasons to stop. Write yours before you write a single name on your list.",
        },
      ],
    },
    {
      id: "l1-list",
      number: 2,
      eyebrow: "Top of funnel",
      title: "Build the list",
      blocks: [
        {
          kind: "paragraph",
          text: "Your list is your business. Not metaphorically, literally. The size of your list, multiplied by the consistency of your outreach, divided by your follow-up gap, equals your income. Most partners die at 'I don't know who to write down.' Write everyone.",
        },
        {
          kind: "bullets",
          items: [
            "Open your phone contacts. Every name. Don't pre-judge.",
            "Scroll Instagram and Facebook, add the people who like your posts, old coworkers, school friends, anyone you used to keep up with.",
            "Add the people you bumped into at a wedding two summers ago. They count.",
            "Add the people you THINK won't be interested. You're not deciding for them, you're inviting them to decide.",
          ],
        },
        {
          kind: "story_card",
          title: "Why this matters",
          body: "Of the next 100 conversations you have, you don't know which 3 will change your life. So you don't get to skip 97 to find 3. The list is how you stop guessing.",
        },
        {
          kind: "pullquote",
          quote:
            "Above 100 names, the business starts to pull you. Under 50, it feels like pushing a boulder uphill.",
        },
        {
          kind: "hundreds_list_form",
        },
      ],
    },
    {
      id: "l1-approach",
      number: 3,
      eyebrow: "Words & energy",
      title: "The approach",
      blocks: [
        {
          kind: "paragraph",
          text: "How you approach people decides whether they listen. Posture first: what you have is #1. People follow strength, not apology. Don't shrink when you tell someone what you're doing. Don't water it down. Don't lead with 'this might not be your thing, but…'",
        },
        {
          kind: "pullquote",
          quote:
            "If you wouldn't apologize for taking a great new job, don't apologize for partnering with the company that's funding your freedom.",
        },
        {
          kind: "paragraph",
          text: "Your job is to get the message in front of people, every week, without flinching. You're not pitching. You're telling the story of what's happening in your life. If posting feels slow, adjust your content. Don't stop. Stopping is the only way to actually lose.",
        },
        {
          kind: "do_dont",
          doTitle: "Pro outreach",
          dontTitle: "Amateur outreach",
          do: [
            "\"Hey [name], I found something. I'm all in, and I'd love to talk to you about it.\"",
            "Voice notes. They hear your heart, your tone, your conviction.",
            "Short self-recorded Zoom videos, face on camera, no production.",
            "Reference something real about THEM in the first line.",
          ],
          dont: [
            "Copy-paste \"Hey girl! Hey bro!\" templates.",
            "Multi-paragraph DMs that read like an essay.",
            "Spinning up complicated tech in week one.",
            "Pitching before you've built any goodwill.",
          ],
        },
        {
          kind: "story_card",
          title: "Storytelling beats pitching",
          body: "A pitch makes the listener defensive. A story makes them curious. 'My energy hasn't been this steady in five years' lands. 'You should try this MLM' doesn't. Tell what's happening in your life. Let them ask.",
        },
      ],
    },
    {
      id: "l1-launch",
      number: 4,
      eyebrow: "The event",
      title: "The Launch Party / Zoom",
      blocks: [
        {
          kind: "paragraph",
          text: "Your Grand Opening is the moment your business becomes real to your network. It's a public announcement, an intentional event, and a forcing function for you to actually invite. Don't skip this. Even if only 3 people show up, those three conversations matter.",
        },
        {
          kind: "script_card",
          label: "Grand Opening: warm market",
          for: "warm_market",
          body: "Friends and family, I'm having a grand opening of my new business and I want you there. It's about anti-aging and gut inflammation. But more importantly, I want your support. Can I count on you to be on a Zoom next week at 7pm?",
        },
        {
          kind: "paragraph",
          text: "Send that script (copy it verbatim, then personalize the first line per person) to 20-40 people in the 7 days leading up to the event. Expect 25–40% to say they'll come. Expect 50–70% of those to actually show. That's normal. The work is the invitation, not the attendance.",
        },
        {
          kind: "tile_grid",
          tiles: [
            {
              eyebrow: "Before",
              title: "Set the room",
              body: "Pick the time (weeknight, 7pm local). Send invites 5–7 days out. Reminder 24 hours out. Reminder day-of. Get an upline leader to co-host.",
            },
            {
              eyebrow: "During",
              title: "Run the show",
              body: "Open warm: thank everyone for coming, share your why. Hand off to your upline for the presentation. Come back at the end to ask for the next step.",
            },
            {
              eyebrow: "After",
              title: "Close the loop",
              body: "Same night: 'Thanks for coming. What stood out?' Within 24 hours: book follow-ups. Within 48 hours: those who couldn't make it get the recording.",
            },
          ],
        },
        {
          kind: "story_card",
          title: "The launch effect",
          body: "Even partners who don't enroll a single person at their Grand Opening report it changed their business. Why? Because once it's public, you can't go back to silent. You declared something, and the declaration starts pulling you forward.",
        },
      ],
    },
    {
      id: "l1-products",
      number: 5,
      eyebrow: "Get your own result",
      title: "Start with the products",
      blocks: [
        {
          kind: "paragraph",
          text: "Turn ECB on for your first 120 days. It doubles your enrollment-order credits during that window. Take the BalanceTest the day you start. Take the products consistently for 120 days. Re-test.",
        },
        {
          kind: "paragraph",
          text: "Your before/after numbers become your most honest piece of marketing. You can't fake them. Nobody can argue with them.",
        },
        {
          kind: "story_card",
          title: "Why this matters more than any script",
          body: "Every conversation you have for the next year either leans on your own result or it doesn't. The partners who lean on their result are calm. The ones who haven't taken the test sound like they're selling.",
        },
      ],
    },
    {
      id: "l1-fast-start",
      number: 6,
      eyebrow: "Plan",
      title: "Run the Fast Start Plan",
      blocks: [
        {
          kind: "paragraph",
          text: "Four steps, 120 days. Each builds on the last. Hit the dates, not the perfection.",
        },
        {
          kind: "comp_table",
          caption: "The Fast Start Plan: 120 days",
          headers: ["Step", "Window", "What you do", "What it earns you"],
          rows: [
            ["Step 1", "First 30 days", "Get to Q-Team: Z4F (4 customers = free auto order) + 4 Premier customer subscriptions", "Q-Team status, free auto order"],
            ["Step 2", "First 60 days", "Enroll 2 partners, one on the LEFT, one on the RIGHT", "Balanced legs unlocked"],
            ["Step 3", "First 90 days", "Help your 2 partners each enroll 2 of their own", "Duplication signal, your team is now self-replicating"],
            ["Step 4", "First 120 days", "Go X-Team, 10 customers across your structure", "Recurring volume foundation locked in"],
          ],
          footnote:
            "Z4F = 4 customers earns you a free Auto Order. The 2-leg balance requirement (one left, one right) is what activates Team Commission payouts.",
        },
      ],
    },
    {
      id: "l1-color-code",
      number: 7,
      eyebrow: "Read people",
      title: "Learn the Color Code",
      blocks: [
        {
          kind: "paragraph",
          text: "Everyone you talk to leans toward one of four colors. If you can hear which one they are in the first minute, you stop wasting both your time and theirs. The wallet card lives in the Toolkit. Read it. Memorize it.",
        },
        {
          kind: "color_card",
          cards: [
            { color: "green", trait: "Analyst: wants proof", tell: "Asks for data, studies, before/afters. Slow yes, but they stay forever." },
            { color: "red", trait: "Driver: wants to win", tell: "Direct, blunt, time-protective. They want to know if this is worth their effort, fast." },
            { color: "yellow", trait: "Helper: wants to care", tell: "Asks about people first. Will say yes for someone else before they say yes for themselves." },
            { color: "blue", trait: "Socializer: wants fun", tell: "Energy, room, vibe. They sell themselves the second they're around your team." },
          ],
        },
      ],
    },
  ],
  graduation: {
    title: "Level 1 graduation checklist",
    items: [
      "My business why is written, under 100 words, and I've read it out loud this week.",
      "100-name list built, not pre-filtered, not pre-judged. Just names.",
      "At least 50 pro-style messages sent, voice notes or short videos preferred.",
      "Grand Opening event held, even if only 3 people came.",
      "ECB turned on; BalanceTest taken; products in daily use.",
      "Q-Team status reached (Z4F + 4 Premier customer subscriptions).",
      "First 2 partners enrolled, one left, one right.",
      "Color Code memorized, I can name a friend's color in under a minute.",
    ],
  },
};

/* ─────────────────────────── LEVEL 2 ─────────────────────────── */

const level2: TrainingModule = {
  id: "level-2",
  badge: "Level 2",
  title: "Fast Started",
  subtitle: "Duplication is the key",
  promise:
    "You've launched. You've earned the right to lead. Now you stop selling and start building the people who'll do this without you.",
  intro:
    "Level 2 is where most partners plateau. The fix isn't to work harder, it's to install a rhythm, raise expectations of yourself, and start building builders.",
  steps: [
    {
      id: "l2-rhythm",
      number: 1,
      eyebrow: "Cadence",
      title: "Install your rhythm",
      blocks: [
        {
          kind: "paragraph",
          text: "Part-time or full-time, the rhythm is non-negotiable. Block it, defend it, run it like a job.",
        },
        {
          kind: "comp_table",
          caption: "Part-time minimum rhythm",
          headers: ["Activity", "Cadence", "Approx. hours/week"],
          rows: [
            ["Total hours blocked", "Weekly", "10–15 hours"],
            ["One-on-ones with prospects", "2–3 per week", "~3 hours"],
            ["Zoom launches", "1–2 per week", "2–4 hours"],
            ["New people contacted", "Weekly", "10 minimum"],
          ],
        },
      ],
    },
    {
      id: "l2-mindset",
      number: 2,
      eyebrow: "Mindset",
      title: "Consistency mindset",
      blocks: [
        {
          kind: "pullquote",
          quote:
            "Consistency: you only fail if you quit. Expectations: set them high of yourself. Have fun.",
        },
        {
          kind: "paragraph",
          text: "Most partners quit one week before their breakthrough. Make a rule with yourself: you don't get to quit on a bad day. Quit only on a great one, and you'll find you don't quit at all.",
        },
      ],
    },
    {
      id: "l2-problems",
      number: 3,
      eyebrow: "Income lens",
      title: "Get paid for solving problems",
      blocks: [
        {
          kind: "pullquote",
          quote: "You're paid when you're good at solving problems.",
        },
        {
          kind: "paragraph",
          text: "Match real problems to real solutions. Inflammation. Brain fog. Side income. Time freedom. Don't sell a product, solve a problem they already named to you. If they didn't name it, you don't know enough yet. Ask better questions.",
        },
      ],
    },
    {
      id: "l2-recurring",
      number: 4,
      eyebrow: "Comp plan",
      title: "How recurring income switches on",
      blocks: [
        {
          kind: "paragraph",
          text: "Two bonuses do most of the heavy lifting in the early years. Understand the difference and you'll know exactly when your income is about to jump.",
        },
        {
          kind: "tile_grid",
          tiles: [
            {
              eyebrow: "ECB",
              title: "Enrollment Credit Bonus",
              body: "Doubles enrollment-order credits. Active during Fast Start window. Kept as long as you stay X-Team.",
            },
            {
              eyebrow: "RCB",
              title: "Recurring Credit Bonus",
              body: "Doubles ALL recurring order credits, the biggest single jump most partners ever feel. First triggers at A-Team.",
            },
            {
              eyebrow: "Team Commission",
              title: "10–15% weekly",
              body: "Paid weekly on balanced legs. The 2:1 left/right rule applies. This is what becomes the predictable paycheck.",
            },
          ],
        },
      ],
    },
    {
      id: "l2-customer-career",
      number: 5,
      eyebrow: "Track",
      title: "The Customer Career ladder",
      blocks: [
        {
          kind: "paragraph",
          text: "Customer rank is what determines whether your monthly check is small or significant. Each step unlocks more compensation on the same activity.",
        },
        {
          kind: "comp_table",
          caption: "Customer Career: rank, requirements, what unlocks",
          headers: ["Rank", "Customer points", "PCV", "What unlocks"],
          rows: [
            ["Q-Team", "4 CP", "20 PCV", "Free Auto Order via Z4F"],
            ["X-Team", "10 CP", "50 PCV", "ECB kept active, recurring foundation"],
            ["A-Team", "25 CP", "125 PCV", "RCB activates + 20% Cash Bonus + Matching Cash Bonus"],
            ["Pro-Team", "50 CP", "250 PCV", "25% Cash Bonus"],
            ["Top-Team", "100 CP", "500 PCV", "30% Cash Bonus"],
          ],
          footnote:
            "CP = Customer Points. PCV = Personal Customer Volume. The biggest early jump is X-Team → A-Team because RCB activates.",
        },
      ],
    },
    {
      id: "l2-activator",
      number: 6,
      eyebrow: "Posture",
      title: "Activator, not motivator",
      blocks: [
        {
          kind: "pullquote",
          quote: "Internally motivated. Heavily disciplined.",
          attribution: "Baskin",
        },
        {
          kind: "paragraph",
          text: "Your job is to activate action, not to hype feelings. Hyped feelings dissolve overnight. Activated action compounds. Take 100% responsibility for yourself and partial responsibility for the people you personally recruit.",
        },
      ],
    },
    {
      id: "l2-build-builders",
      number: 7,
      eyebrow: "The system",
      title: "Build builders: the duplication system",
      blocks: [
        {
          kind: "paragraph",
          text: "Leaders aren't found. They're built. There's a four-part sequence every new partner needs to run through with you. Run it well and they duplicate. Run it poorly and they go quiet.",
        },
        {
          kind: "tile_grid",
          tiles: [
            {
              eyebrow: "1",
              title: "24-hour onboarding",
              body: "Back office walkthrough, chats added, website live. Instant confidence, they feel like they belong by day two.",
            },
            {
              eyebrow: "2",
              title: "The launch",
              body: "Identify their low-hanging fruit. Help them run a public launch event or post. They need momentum in week one.",
            },
            {
              eyebrow: "3",
              title: "Active weekly mentorship",
              body: "Reach out at least once a week. Find the roadblock before they hide it. The first quit comes from silence, not failure.",
            },
            {
              eyebrow: "4",
              title: "Think one layer deeper",
              body: "Don't just teach them. Teach them to teach THEIR partners to invite. That's where duplication actually lives.",
            },
          ],
        },
      ],
    },
  ],
  graduation: {
    title: "Level 2 graduation checklist",
    items: [
      "Weekly rhythm is on a calendar, and I've kept it for 4 consecutive weeks.",
      "Reached A-Team, RCB has activated.",
      "I've personally launched at least 2 partners through the 4-part sequence.",
      "I've had at least one team member duplicate me by running the sequence with THEIR partner.",
      "I can explain ECB, RCB, and Team Commission in plain English in under 60 seconds.",
      "I've stopped hyping and started activating, I can name the difference.",
    ],
  },
};

/* ─────────────────────────── LEVEL 3 ─────────────────────────── */

const level3: TrainingModule = {
  id: "level-3",
  badge: "Level 3",
  title: "The Next Level",
  subtitle: "Builder → Leader",
  promise:
    "You've duplicated. Now you become the person whose presence in the room changes the energy of the room.",
  intro:
    "Level 3 is the shift from 'I can build this' to 'I lead the people who build this.' It's mostly identity work, executed with discipline.",
  steps: [
    {
      id: "l3-authority",
      number: 1,
      eyebrow: "Lead",
      title: "Lead with authority",
      blocks: [
        {
          kind: "pullquote",
          quote: "Fake it until you feel it.",
        },
        {
          kind: "paragraph",
          text: "The role shifts from marketer to leader. Show up as if you've already won. The reality catches up faster than you think. People can feel whether you've decided you're the leader yet, long before your numbers prove it.",
        },
      ],
    },
    {
      id: "l3-circle",
      number: 2,
      eyebrow: "Environment",
      title: "Curate your circle",
      blocks: [
        {
          kind: "pullquote",
          quote: "Who you surround yourself with matters. You become your circle.",
          attribution: "Saelle",
        },
        {
          kind: "paragraph",
          text: "Surround yourself with leaders. Not casually, deliberately. The five people you spend the most voice time with set the ceiling of what you'll believe is possible. Choose like your future depends on it. Because it does.",
        },
      ],
    },
    {
      id: "l3-communication",
      number: 3,
      eyebrow: "Skill",
      title: "Master communication",
      blocks: [
        {
          kind: "pullquote",
          quote:
            "The quality of your life will be correlated by the way you communicate.",
        },
        {
          kind: "paragraph",
          text: "At Level 3, the Color Code stops being a recruiting trick and becomes a leadership tool. You're using it to lead conversations with team members, to motivate people who've stalled, to ask the right kind of question to the right kind of person.",
        },
        {
          kind: "story_card",
          title: "Illustration: motivating a stalled Red",
          body: "A Red who's gone quiet doesn't want a hug. They want a challenge. The 3-step is: compliment, compliment, challenge. 'You've clearly built things before, I can hear it. Honestly, you'd probably out-recruit half my team in a month. Here's my challenge: enroll two partners in your first 30 days, one on each leg. Most people can't. Can you?'",
        },
      ],
    },
    {
      id: "l3-engine",
      number: 4,
      eyebrow: "The 5-part recruiting engine",
      title: "Run it. Teach it. Watch it duplicate.",
      blocks: [
        {
          kind: "paragraph",
          text: "Five moving parts. Run them yourself, then teach them in a way that lets your team run them without you in the room.",
        },
        {
          kind: "tile_grid",
          tiles: [
            { eyebrow: "1", title: "Identity", body: "Who they're talking to. Who YOU are when you walk in." },
            { eyebrow: "2", title: "Funnel", body: "Top-of-funnel volume + consistent message, the lifeblood of recruiting." },
            { eyebrow: "3", title: "Authority", body: "Your results, your team's results, your conviction, proof that talks back." },
            { eyebrow: "4", title: "Comms", body: "Match the message to the color in front of you." },
            { eyebrow: "5", title: "Close", body: "The ask that lands without pressure, the natural next step of the conversation." },
          ],
        },
      ],
    },
    {
      id: "l3-adapt",
      number: 5,
      eyebrow: "Reality",
      title: "Adapt: change is coming",
      blocks: [
        {
          kind: "pullquote",
          quote:
            "Someone else will recruit the people you don't.",
        },
        {
          kind: "paragraph",
          text: "Stay focused on results, not on what's changing around you. Tools change. Algorithms change. Platforms come and go. The mechanics of trust, problem-solving, and consistent follow-through don't.",
        },
      ],
    },
    {
      id: "l3-partner-career",
      number: 6,
      eyebrow: "Rank ladder",
      title: "Climb the Partner Career ranks",
      blocks: [
        {
          kind: "comp_table",
          caption: "Partner Career: rank, Credits required to promote, what unlocks",
          headers: ["Rank", "Credits to promote", "What unlocks"],
          rows: [
            ["Bronze", "375 Credits", "Foundation rank, Team Commission flowing"],
            ["Silver", "750 Credits", "Compounding team volume, culture starts to scale"],
            ["Gold", "1,500 Credits", "Mentor Matching Bonus deepens"],
            ["Executive", "3,000 Credits", "zPhone benefit + 200 PP/mo (~$220 USD/mo)"],
            ["Platinum", "6,000 Credits", "Sustained leader rank, structural depth"],
            ["Diamond", "12,000 Credits", "zCar benefit + 1,000 PP/mo (~$1,100 USD/mo)"],
          ],
          footnote:
            "Credits are the volume requirement, what you build to promote. Pay Points (PP) are the commission you earn, 1 PP = €1, which is roughly $1.10 USD (rate floats). Balanced 2:1 rule applies on the way up. Mentor Matching Bonus pays 5–25% on the Team Commission of partners you personally enroll. Enrollment Incentive Program pays up to 300 PP (~$330 USD) per developed new partner.",
        },
      ],
    },
  ],
  graduation: {
    title: "Level 3 graduation checklist",
    items: [
      "I lead with authority, my posture changed before my income did.",
      "My inner circle is intentional. I know the 5 people whose voice shapes my standards.",
      "I run the 5-part recruiting engine without thinking about it.",
      "At least one of my partners runs the 5-part recruiting engine without thinking about it either.",
      "I've reached Bronze or higher and can describe the next two rank requirements without looking.",
      "I can adapt without panic when a tool, platform, or trend changes.",
    ],
  },
};

/* ─────────────────────────── LEVEL 4 ─────────────────────────── */

const level4: TrainingModule = {
  id: "level-4",
  badge: "Level 4",
  title: "Leadership & Legacy",
  subtitle: "From leader to legacy-builder",
  promise:
    "The work stops being about you. It becomes about who you raise up and what they're still doing 20 years from now.",
  intro:
    "At Level 4 the metrics shift. Pay Points still matter. But the real measurement is duplication, culture, and the leaders you produce who produce other leaders.",
  steps: [
    {
      id: "l4-all-in",
      number: 1,
      eyebrow: "Sold out",
      title: "Go all in",
      blocks: [
        {
          kind: "pullquote",
          quote:
            "Totally sold out. 100% belief. 99% is no different than 0.",
          attribution: "Baskin",
        },
        {
          kind: "paragraph",
          text: "People need you. Don't hold what we have from the world. Persist without exception. The world doesn't owe you a response, but it does respond to consistent, sold-out, unwilling-to-quit conviction.",
        },
      ],
    },
    {
      id: "l4-balance",
      number: 2,
      eyebrow: "Pacing",
      title: "Keep life balanced. Not a balanced life",
      blocks: [
        {
          kind: "paragraph",
          text: "There is no such thing as a perfectly balanced life. There are seasons of push and seasons of recovery. Run them on purpose, not by accident. Internally motivated. Heavily disciplined.",
        },
        {
          kind: "story_card",
          title: "How seasons actually work",
          body: "A push season looks like 10pm Zoom launches and 5am school drop-offs. A recovery season looks like long walks, full presence with your spouse, and the phone in the other room. The mistake is trying to live in either one forever.",
        },
      ],
    },
    {
      id: "l4-table",
      number: 3,
      eyebrow: "The Leaders Council",
      title: "Lead at the table",
      blocks: [
        {
          kind: "paragraph",
          text: "Top leaders meet with corporate every week, they guide events, pricing, direction. Callback to the Foundation: you deserve a seat at this table. Yes you do.",
        },
        {
          kind: "pullquote",
          quote:
            "You deserve a seat at this table. Yes you do.",
        },
      ],
    },
    {
      id: "l4-example",
      number: 4,
      eyebrow: "Culture",
      title: "Be the example that duplicates",
      blocks: [
        {
          kind: "pullquote",
          quote:
            "Take 100% responsibility for yourself. Show up like you should show up.",
        },
        {
          kind: "paragraph",
          text: "Culture is the only thing that scales. Systems break. Tools change. People come and go. The example you set, what you tolerate, what you celebrate, what you push back on, that's what compounds into a legacy.",
        },
      ],
    },
  ],
};

/* ─────────────────────────── TOOLKIT ─────────────────────────── */

const toolkit: TrainingModule = {
  id: "toolkit",
  badge: "Toolkit",
  title: "Scripts, Color Code & Comp Plan Map",
  subtitle: "The reference appendix you'll come back to weekly",
  steps: [
    {
      id: "toolkit-scripts",
      eyebrow: "Script library",
      title: "Openers for every color",
      blocks: [
        {
          kind: "paragraph",
          text: "Memorize the rhythm, not the words. Once the rhythm lives in your bones, you can be yourself inside it.",
        },
        {
          kind: "script_card",
          label: "Grand Opening: warm market",
          for: "warm_market",
          body: "Friends and family, I'm having a grand opening of my new business and I want you there. It's about anti-aging and gut inflammation. But more importantly, I want your support. Can I count on you to be on a Zoom next week at 7pm?",
        },
        {
          kind: "script_card",
          label: "Opener: Green (proof)",
          for: "green",
          body: "Before I tell you anything, are you actually looking to start something right now, or are you still in the information-collection stage? It's built on a blood test that shows your exact Omega ratio before and after. You don't take my word for it; the numbers either moved or they didn't. If you love data and proof, you'll love this.",
        },
        {
          kind: "script_card",
          label: "Opener: Red (win)",
          for: "red",
          body: "I'll be quick because I know you're busy. Roughly 15 million networkers have done this before you. Want to know a few secrets they found along the way? If you're the type who loves to make big money and run your own show, you'll love this, that's you, or it isn't.",
        },
        {
          kind: "script_card",
          label: "Opener: Yellow (help)",
          for: "yellow",
          body: "Forget the business side for a second, I thought of you because you're one of the most caring people I know. This is really about helping people get healthier. We start them with a simple at-home test, and most are shocked by their results. You'd just be helping people feel better and walking alongside them.",
        },
        {
          kind: "script_card",
          label: "Opener: Blue (fun)",
          for: "blue",
          body: "Okay, you're going to love this, we've got an opportunity meeting coming up and it is SO fun. You'll meet a ton of new people, amazing energy, and you get to talk to everyone, which is basically your superpower. I want you there. Can you come Thursday?",
        },
        {
          kind: "script_card",
          label: "Motivate a stalled Red: 3-step",
          for: "red",
          body: "You've clearly built things before, I can hear it. Honestly, you'd probably out-recruit half my team in a month. So here's my challenge: enroll two partners in your first 30 days, one on each leg. Most people can't. Can you?",
        },
      ],
    },
    {
      id: "toolkit-color-card",
      eyebrow: "Color Code wallet card",
      title: "Read anyone in under a minute",
      blocks: [
        {
          kind: "color_card",
          cards: [
            { color: "green", trait: "Green = Proof", tell: "Slow. Analytical. Wants data, studies, before/after numbers." },
            { color: "red", trait: "Red = Win", tell: "Fast. Direct. Loves to compete. Don't waste their time." },
            { color: "yellow", trait: "Yellow = Help", tell: "Caring. People-first. Will say yes for someone else before themselves." },
            { color: "blue", trait: "Blue = Fun", tell: "Energy. Stories. Loves the room. Gets sold by environment, not data." },
          ],
        },
      ],
    },
    {
      id: "toolkit-comp-map",
      eyebrow: "Comp Plan Map",
      title: "Plain-language reference",
      blocks: [
        {
          kind: "paragraph",
          text: "Memorize the glossary first. Then the five income streams. Then the activation rule. Everything else in the plan builds on these.",
        },
        {
          kind: "glossary",
          entries: [
            { term: "Credits", def: "The volume requirement to promote ranks. Earned on orders. NOT the same as commission, Credits = what you build, PP = what you earn." },
            { term: "PP", def: "Pay Points, Zinzino's commission currency. 1 PP = €1, which is roughly $1.10 USD (rate floats with EUR/USD). All commission figures in the plan are quoted in PP." },
            { term: "PCV", def: "Personal Customer Volume, the volume from your personally-enrolled customers." },
            { term: "PCP", def: "Personal Customer Points, your customer count metric." },
            { term: "ECB", def: "Enrollment Credit Bonus, doubles enrollment-order credits during the Fast Start window, kept while X-Team is active." },
            { term: "RCB", def: "Recurring Credit Bonus, doubles ALL recurring order credits. First activates at A-Team. Biggest early income jump." },
            { term: "Z4F", def: "Zinzino 4 Free, 4 customers earns you a free Auto Order." },
            { term: "CAB", def: "Customer Acquisition Bonus, paid on new personal customer activity." },
            { term: "Balanced 2:1", def: "Your weaker leg's volume × 2 ≥ your stronger leg's volume, required for Team Commission to flow." },
          ],
        },
        {
          kind: "tile_grid",
          tiles: [
            { eyebrow: "Stream 1", title: "Retail / Customer Profit", body: "Direct margin on customer orders." },
            { eyebrow: "Stream 2", title: "Cash Bonus", body: "20–30% bonus paid on personal customer volume by rank." },
            { eyebrow: "Stream 3", title: "Team Commission", body: "10–15% weekly on balanced legs." },
            { eyebrow: "Stream 4", title: "Mentor Matching Bonus", body: "5–25% on personally-enrolled partners' Team Commission." },
            { eyebrow: "Stream 5", title: "Rank & Incentive", body: "zPhone, zCar, Leaders Council, Enrollment Incentive Program (up to 300 PP per developed new partner)." },
          ],
        },
        {
          kind: "story_card",
          title: "The activation rule (memorize this)",
          body: "Grace Period = your start month + 4 months at 10 credits each. From month 5 onward, the rule is 4 PCP + 20 credits = Q-Team. Miss this and you fall out of pay status. Hit this every month and you stay paid.",
        },
      ],
    },
  ],
};

/* ─────────────────────────── CLOSING ─────────────────────────── */

const closing: TrainingModule = {
  id: "closing",
  badge: "Closing",
  title: "The Inner Fire",
  subtitle: "Leave with an inner fire that doesn't burn out",
  steps: [
    {
      id: "closing-mindset",
      eyebrow: "The final mindset checklist",
      title: "Four things to carry into Level 1",
      blocks: [
        {
          kind: "checklist",
          title: "The Final Mindset Checklist",
          items: [
            "Set aggressive expectations of yourself, e.g. one enrollment per day.",
            "Consistency beats feelings. Show up on the days you don't feel like it.",
            "You only fail if you quit. Quit on great days, never on bad ones, and you won't quit at all.",
            "Embrace the learning phase. You're allowed to be 'bad' while you learn. That's the price of becoming someone who's later 'great.'",
          ],
        },
        {
          kind: "pullquote",
          quote:
            "Don't hold what we have from the world.",
        },
        {
          kind: "paragraph",
          text: "Now go to Level 1. Take the first step.",
        },
      ],
    },
  ],
};

/* ─────────────────────────── EXPORT ─────────────────────────── */

export const trainingContent: TrainingModule[] = [
  foundation,
  level1,
  level2,
  level3,
  level4,
  toolkit,
  closing,
];

export const heroPromise =
  "A tiered, story-driven path from brand-new partner to team leader, built on the conference notes that built our top earners, grounded in the Zinzino USA Compensation Plan.";

export const heroSubtitle =
  "Foundation → Level 1 → Level 2 → Level 3 → Level 4. Walk them in order. Graduate each before the next.";

export const incomeDisclaimer =
  "Built from conference notes (the Schrandt, Goldberg, Saelle, Baskin and Ocean sessions, and the Big Al / Tom Schreiter color personalities) and grounded in the Zinzino USA Compensation Plan. All Pay Point and rank figures reflect the structure of the Compensation Plan only and are not a guarantee of earnings. Success with Zinzino results from genuine product sales and consistent effort, actual results depend on the work, skill, and consistency of each partner. For exact current figures, always defer to the official Zinzino Back Office and the latest published Compensation Plan.";
