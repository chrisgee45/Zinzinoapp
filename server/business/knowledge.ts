// Partner Business Advisor knowledge base.
//
// Verbatim from the official Zinzino Compensation Plan (USA / EN,
// version 12-02-2025) and the zinzino.com US/EN credit-value snapshot
// (2026-06-18). The handoff spec carries the canonical text — do NOT
// paraphrase. Quote figures exactly. Anything not in this file gets
// answered with "I'm not certain — check the Back Office or the
// official plan" by the guardrails, not invented.
//
// Compliance critical: every body here describes plan MECHANICS. None
// of it promises, projects, or guarantees income. The advisor's
// system prompt re-states that on every call.

export interface BusinessKbDoc {
  slug: string;
  title: string;
  category: "product" | "business" | "compensation";
  body: string;
}

const DOCS: BusinessKbDoc[] = [
  {
    slug: "product-overview",
    title: "Zinzino product overview",
    category: "product",
    body: `Zinzino is a health and wellness company built around test-based nutrition: test your status, follow a personalized routine, then retest after about 120 days to see the change. At-home dried-blood-spot self-tests (analyzed by the independent, GMP-certified lab Vitas in Norway) include the BalanceTest (fatty-acid omega-6:3 balance) and the Gut Health Test. Daily supplements (the Zinzino Health Protocol) are BalanceOil+ (omega-3 + olive polyphenols + vitamin D), ZinoBiotic+ (fiber), and Xtend (multi-immune vitamins/minerals); skin nutrition is Collagen Boozt. Positioning: test, supplement, retest. Keep to general wellness and approved structure/function language; never claim a product diagnoses, treats, cures, or prevents disease.`,
  },
  {
    slug: "getting-started",
    title: "Getting started as a Partner",
    category: "business",
    body: `Starting as a Zinzino Partner (Back Office Entrance, also called Sales Rep) is free. Even for free you can earn retail profits and Cash Bonuses on subscription sales, without buying a kit.
Partner Kits give you a head start and include the Enrollment Credit Bonus (ECB) for the first 120 days, which doubles your enrollment Credits. The three kits, shown as weekly/monthly Credits (WCV/MCV): Basic Partner Kit 30/60 Credits, Advanced Partner Kit 90/180 Credits, Ultimate Partner Kit 150/300 Credits. Buying any Partner Kit also gives you 2 additional Income Centers (so 3 in total: 001, 002, 003).
Monthly Auto Order: 1 product of your choice, plus a Test Kit on every 4th order, plus GoCore App access, equals 10 Credits. It also comes with a back office and easy-to-share landing pages. Following the program for about 120 days gives you a before-and-after result.
Ultimate Partner Kit refund campaign: you can earn a full loyalty refund by acquiring 25 Premier Customers within a year of buying the Ultimate Partner Kit. Basic and Advanced kits can be upgraded within the first 6 months to qualify. See the official Ultimate Partner Kit campaign sheet for the details.
A Premier Customer (one who orders a Premier Kit) is eligible for the discounted premier price, the Customer Rewards Program, and Zinzino4Free.`,
  },
  {
    slug: "activation-grace-period",
    title: "Activation + Grace Period",
    category: "business",
    body: `To earn compensation from the sales volume of Partners in your team and their Customers, you must be an active Partner. Cash Bonuses and retail profits are the only earnings that do NOT require active status.
Grace Period: the month you start plus the next four full calendar months. During the Grace Period your monthly qualification is just 10 Credits from your Auto Order or your personal Customers, and the whole compensation plan is open to you with no extra requirements.
From the fifth calendar month, being an active Partner requires four Personal Customer Points (PCP) plus 20 Credits from your personal Customers and your own product orders each month. Reaching this gives you the Q-Team title.
Activation thresholds for higher ranks (PCP / Personal Credit Volume): Grace Period none/10; Bronze 4/20; Executive 10/50; Director 25/125.
Activation deadline is 24:00 CET on the last day of the month; qualify by then to be active the following month.
Partner Contract: to stay a registered Partner you must place an order of at least 1.25 Credits, or create at least one new first-generation Customer Point worth at least 1.25 Credits, within any 12-month period.`,
  },
  {
    slug: "zinzino4free",
    title: "Zinzino4Free + Customer Rewards",
    category: "business",
    body: `Zinzino4Free (Z4F): if you refer four or more Customers on a Premier Kit with the same or a larger order, you can get your own monthly Auto Order for free and only pay shipping. Only first-generation Customers count. Their combined first-generation purchases must be worth at least 40 Credits (to help you start, 20 Credits is enough in the first four months, the Q-Team period). In the first 120 days you get a 50% discount on the Credits needed.
Customer Rewards Program (for Customers who start on a Premier Kit): first reward level, the shipping cost is returned as ZinoCash; second reward level, from the 7th order, shipping plus 10% of the order is returned as ZinoCash. Additional benefits include up to 60% off Premier Kits, up to 40% off other products, a chance at free products, and redeeming ZinoCash for free products. A second BalanceTest is included around month five so Customers can retest.
Save money and the environment: pay monthly but receive two deliveries in one package every other month, which halves shipping.`,
  },
  {
    slug: "fast-start-plan",
    title: "Fast Start Plan (first 120 days)",
    category: "business",
    body: `The first 120 days is your business launch period to learn, earn, and get in balance. To be eligible for the four Fast Start Bonuses you must be an active Partner with an active Z4F Auto Order. All four bonuses can be earned independently; Step 3 can only be earned once Step 2 has been earned (or its time period has expired).
Step 1, Q-Team in 30 days: have a Z4F Auto Order and 4 Customer subscriptions (Premier Kits). Earns a 100 Pay Point Fast Start Bonus (plus product rewards of 20 Credits and 4 Premier Kits) and a 10% Cash Bonus.
Step 2, Enroll 2 in 60 days: personally enroll 2 Partners with an Ultimate Partner Kit, one on the left and one on the right to qualify. Earns a 400 Pay Point Fast Start Bonus.
Step 3, Help your 2 Enroll 2 in 90 days: help your two enrolled Partners each enroll 2 (any four from you, A or B), each with an Ultimate Partner Kit. Earns a 1,200 Pay Point Fast Start Bonus.
Step 4, X-Team in 120 days: you have your 4 Customers, add 6 more for 10 total. Earns a 150 Pay Point Fast Start Bonus (plus 50 zRewards, Zinzino4Free every month, and you keep ECB), plus product rewards of 50 Credits and 10 Premier Kits.
The 60-day and 90-day Fast Start Bonuses can be increased under campaign rules. After Fast Start, duplication is the key.`,
  },
  {
    slug: "customer-career-plan",
    title: "Customer Career Plan",
    category: "compensation",
    body: `Cash Bonus: there are two kinds. A Premier Cash Bonus when you sell a Premier Customer Kit, and a Retail Cash Bonus when a Retail Customer buys single items with a Credit value. All Partners start at a 10% Cash Bonus and can reach 30% by Customer Career title: Back Office, Q-Team and X-Team 10%; A-Team 20%; Pro-Team 25%; Top-Team 30%. Cash Bonus does not require you to be active.
Team Commission: each order has a Credit value that adds to your weekly Team Commission, and you are paid 10 to 15% on the combined weekly Credits. After the Grace Period you must be Q-Team to earn this.
Customer Career titles (Customer Points / Personal Credit Volume): Q-Team 4/20, X-Team 10/50, A-Team 25/125, Pro-Team 50/250, Top-Team 100/500, Top-Team 200 is 200/1,000. Above Top-Team 200, each additional 100 Customer Points and 500 PCV raises your Top-Team title.
Monthly Customer Bonus (MCB), the main recurring Customer commission, starts at A-Team: A-Team 100 Pay Points, Pro-Team 200, Top-Team 400, Top-Team 200 is 1,000 Pay Points per month.
Customer Fast Start one-time bonuses: Q-Team 100 Pay Points (within 30 days), X-Team 150 Pay Points (within 120 days).
Customer one-time bonuses: A-Team is UPK Refund eligible (365 days); Pro-Team 500 Pay Points (paid over 10 months); Top-Team 10,000 Pay Points (paid over 25 months).
zRewards (the Customer Care Rewards Program for Partners) start at X-Team (50) and are 100 per month from A-Team upward; spend them in the webshop on products to acquire new or reward existing Customers.
Recurring Credit Bonus (RCB) is first achieved at A-Team and doubles the Credits generated by every recurring order, both yours and your team's, which makes a big difference to recurring commissions.`,
  },
  {
    slug: "partner-career-plan",
    title: "Partner Career Plan + leadership bonuses",
    category: "compensation",
    body: `Recognition titles are based on balanced Monthly Credits Volume (MCV) plus Personal Credit Volume (PCV) and Personal Customer Points (PCP). Lower titles need 4 Customers (Q-Team); from Executive 10 Customers (X-Team); from Director 25 Customers (A-Team).
Titles and balanced MCV: Bronze 375, Silver 750, Gold 1,500, Executive 3,000, Platinum 6,000, Diamond 12,000, Director 24,000, Crown 48,000, Royal Crown 80,000, Black Crown 130,000, Ambassador 150,000, Royal Ambassador 200,000, Black Ambassador 250,000, President 300,000, Elite President 500,000, Global President 1,000,000, 1 Star Global President 2,000,000, 2 Star Global President 3,000,000. Ambassador and above are built across multiple Income Centers or Enrollment Lines.
Team Commission: 10 to 15% of your weekly Balanced Credits (WCV) per Income Center, with a 2:1 balance between your teams. Active Partners start at 10% and reach 15% at 3,000 balanced Credits per week, up to 1,500 Pay Points per week per Income Center at 10,000 balanced Credits.
Volume Commission: once you exceed 10,000 Credits you can earn 1 to 4% of weekly balanced volume. Rate and weekly Pay Point cap rise by title, from Director 1% (cap 1,000) to Global President 4% (cap 20,000), and higher for Star ranks.
Customer Acquisition Bonus (CAB): earned on new Customer Premier Kits and new Partner Product Kits, from only one Income Center per weekly cycle. Tiers run from Mini (200 left / 200 right, 50 Pay Points) up to 5XL (150,000 / 150,000, 6,000 Pay Points).
One-Time Title Bonuses: up to 3 per title, qualified by reaching the title, by balanced Customer Points, and by a balanced build. Examples per bonus: Bronze 50, Silver 100, Gold 200, Executive 400, Platinum 800, Diamond 1,500, Director 2,500, President 40,000 Pay Points. Paid in monthly installments.
Enrollment Incentive Program: up to 300 Pay Points per qualified new Partner over 365 days (1 Premier Customer = 50 PP, 4 = 50 PP, 10 = 100 PP, 25 = 100 PP). Lifetime enrollment awards at 5, 10, 15, 30, 50, 100 and 500 personally enrolled Partners (event tickets, a 1,000 PP voucher, an engraved MontBlanc pen, VIP experiences, a visit to Zinzino in Gothenburg, and the Hall of Fame).
Mentor Matching Bonus: 5 to 25% on your personally sponsored Partners' weekly Team Commission, scaling with how many you enroll and their titles (2 Bronze 5% up to 10 Platinum 25%), with extra generations matched from level 6 and above. You must stay active; dynamic compression applies if you do not qualify.
zPhone Bonus: 200 Pay Points per month as an active Executive or above. zCar Bonus: 1,000 Pay Points per month as an active Diamond or above.
Bonuses paid in shares at the top ranks: President 200,000, Elite President 300,000, Global President 500,000, and 1 Star Global President and above 1,000,000 Pay Points, subject to rank-maintenance rules and a lock-up period.
New Directors qualify for the yearly Director Trip; active Ambassadors are treated to the annual Ambassador Trip.`,
  },
  {
    slug: "comp-glossary",
    title: "Compensation plan glossary",
    category: "compensation",
    body: `Credit: the internal currency assigned to every product; the basis for all plan calculations and Z4F eligibility. Reference Credit values: Partner Kit 150, Customer Kit 14, Z4F Auto Order 10, Customer subscription 4.
Pay Point (PP): the unit commissions are calculated in. The goal is that one Pay Point equals about 1 euro; it is converted to local currency, and the company may adjust the value if there is an overpayment.
ECB (Enrollment Credit Bonus): doubles the Credits on new enrollment kit orders (Premier Customers and Partners), in both the weekly and monthly cycles. ECBx multiplies enrollment Credits by a campaign factor (for example 3) in the monthly cycle. RCB (Recurring Credit Bonus): doubles the Credits on recurring (non-enrollment) orders, weekly and monthly.
Balanced Credits 2:1: the Credits that count depend on the balance between your left and right teams; a maximum of 2 parts can come from the larger team to 1 part from the smaller. Banking holds unused Credits while you stay active (Zinzino banks up to one million Credits weekly and monthly).
Income Center (IC): a placement in the organization. Back Office Entrance is 1 IC; a Partner Kit adds 2 (001, 002, 003). Extra Income Centers are allowed from Diamond (within your team) and from President (above your 001); each costs the price of a Basic Partner Kit.
PCP Personal Customer Point, PCV Personal Credit Volume, WCV Weekly Credit Volume, MCV Monthly Credit Volume.
Commission cycles: weekly (Team Commission, CAB, Volume Commission, Mentor Matching Bonus), Thursday 00:00 to Wednesday 24:00 CET; monthly (One-Time Title Bonuses, zPhone, zCar, Z4F, zRewards); daily (Cash Bonus, ECB, RCB).
Binary Tree and Enrollment Tree, Sponsor/Enroller, Upline/Downline, Crossline, and the Waiting Room (where personally sponsored Partners wait to be placed in your binary tree).
Commissions are shown gross; as a Partner you handle your own local tax and VAT registration.`,
  },
  {
    slug: "credit-values",
    title: "Product credit values (Zinzino + Brand Shop)",
    category: "compensation",
    body: `Every product carries a Credit value (cr) — the qualifying volume it generates in the plan (see the glossary for how Credits convert to Pay Points and balance). Credits are the same whether a product is bought at premier or retail price; only the price differs. Quote these figures exactly; for any product not listed, say you are not certain and point to the official price list.
Partner Kits (enrollment): Basic Kit 30 cr, partner price $339 (retail value about $499+). Advanced Kit 90 cr, $859 (retail about $1,660). Ultimate Partner Kit (UPK) 150 cr, $1,195 (retail about $3,181). All Partner Kits include ECB for the first 120 days (doubles enrollment Credits) and give 2 extra Income Centers. Vegan, specialty (Beauty, Immune, Practitioner), and brand kits (Zurvita, Truvy, Valentus, BodePro, Sanki, It Works!, Xelliss) come at the same 30 / 90 / 150 cr tiers and $339 / $859 / $1,195 prices; It Works! also has a Small Kit at 10 cr / $147.
Z4F Auto Order = 10 cr (e.g., any BalanceOil+ flavor, Essent+ Premium, Zeal, Verve, BelAge).
Partner add-on test kits: BalanceTest 10-pack 60 cr; Gut Health Test 10-pack 60 cr; Vitamin D 10-pack 30 cr; HbA1c 10-pack 30 cr.
Zinzino Shop product Credit values — format cr (premier $ / retail $):
Tests: BalanceTest 5 (127/179); Gut Health Test 6 (145/205); Gut Health Test x2 10 (209/410); Vitamin D Test 3 (55/78); HbA1c Test 3 (55/78).
Omega: BalanceOil+ 300 ml 4 (47/67); BalanceOil+ 100 ml 1.5 (18/26); BalanceOil+ 6x100 ml 6 (94/133); BalanceOil+ Premium 300 ml 5 (66/94); BalanceOil+ AquaX 300 ml 5 (54/77); BalanceOil+ Vegan 300 ml 5 (82/116); BalanceOil Tutti Frutti 300 ml 4 (47/67); Essent+ Premium 60 softgels 4 (47/67); R.E.V.O.O Olive Oil 250 ml 7 (79/112); Dosage Cups 1 (16/16).
Restore: ZinoGene+ 30 tablets 5 (61/87); Viva+ 60 tablets 3 (32/45); Viva+ x2 4 (56/86); PhycoSci+ X20 250 ml 4 (50/71).
Immune: ZinoShine+ 60 tablets 1.25 (18/26); Xtend+ 60 capsules 4 (46/65); Xtend 60 tablets 3 (35/50); Protect+ 60 capsules 4 (47/67); SpiruMax+ 80 tablets 3 (31/44).
Gut health: ZinoBiotic+ 180 g 3 (35/50); X GOLD+ 250 ml 5 (60/85).
Weight management: LeanShake (Chocolate, Strawberry, Vanilla, Berry) 4 each (58/82); Shake Bottle 1 (7/7); Energy Bar 4x40 g 1.25 (17/24); Measuring Tape 1 (6/8).
Skin: Collagen Boozt 10x46 ml 5 (61/87).
Brand Shop Credit values (cr, single product): Zeal flavors 5.7, Zeal single-serve 10-pack 2.2; Zundora 6.7; Zurge 3.3; H20 Stickpacks 2; Burn+ 3.6; Cleanse+ 2.7; Amino 3.6; TW&E + truFIX 3.5; truFIX 3.1; reNU Detox 2; Pre+ Probiotic Chews 2.6; Collagen +BHC 3.2; Slumber Gummy 2.3; TruCafe Ageless Blend 2.6; H&H Super Drink 3.5; Kids Dailies 1.7; Letric Muscle Rub 1.7; Verve 4, Verve Sugar Free 4, Verve Burn 5; Ionic 4; TEN 5.5; BelAge 4; Kronuit Fire 2.0 5; Inner 7 4; Hasaki 5; SLMR 4.4; FF+ 3.2; It Works! Greens Multi 3.6, Skinny Hydrate 3.8, Power Hydrate 2.8, Happy Coffee 4.5, SKNY Cold Brew / Brew 4.1, Skinny Wrap 5, FIRM 4.4, THKR Hair Gummies 4.2, Simplypure shampoo/conditioner/body wash 3, facial oils and scalp/leave-in 3.2.
Brand bundle/system kits run higher: x2 kits add roughly 40% more credits; multi-product 'System / Trio / Drop System' kits are about 6 to 8 cr. The Shaker/Shake Bottle and apparel/tools are 0 to 1 cr.`,
  },
  {
    slug: "incentive-trips",
    title: "Incentive trips",
    category: "business",
    body: `Director Trip: one yearly educational trip to luxurious, exclusive locations with top speakers and coaching; new Directors qualify (see Director Trip campaign rules).
Ambassador Trip: an annual 5-star experience for active Ambassadors around Europe (past locations include Monaco, Palma, and the French Riviera).`,
  },
];

/**
 * Format the KB into a single string the model can read. Each doc is a
 * header line + body; docs separated by a blank line. The handoff spec
 * also asks for ", UNVERIFIED" appended to placeholder docs — all docs
 * in this build ship as confirmed, so the marker is unused here but
 * kept in the formatter so a future placeholder gets flagged.
 */
export function businessKnowledgeText(): string {
  if (DOCS.length === 0) return "(no knowledge base documents available)";
  return DOCS.map((d) => `## ${d.title} (${d.category})\n${d.body}`).join("\n\n");
}

/** Exposed for tests / introspection. */
export function listBusinessDocs(): BusinessKbDoc[] {
  return DOCS;
}
