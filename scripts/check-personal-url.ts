import { partnerIdFromEnrollmentLink, personalizeProductUrl } from "../server/lib/partnerUrls.js";
import { allProducts } from "../server/products/catalog.js";

const cases = [
  { in: "https://www.zinzino.com/2019713973/us/en-us/", expected: "2019713973" },
  { in: "https://www.zinzino.com/2019713973/US/en-us", expected: "2019713973" },
  { in: "https://www.zinzino.com/shop/2019713973/US/en-gb/enrollmentshop/partner-offers", expected: "2019713973" },
  { in: "https://www.zinzino.com/en-US/", expected: null },
  { in: "", expected: null },
  { in: null, expected: null },
  { in: "not a url", expected: null },
  { in: "https://example.com/2019713973/", expected: null },
];

let fails = 0;
for (const c of cases) {
  const got = partnerIdFromEnrollmentLink(c.in as string | null);
  const ok = got === c.expected;
  if (!ok) fails++;
  console.log(`${ok ? "ok " : "FAIL"}  partnerId(${JSON.stringify(c.in)}) = ${JSON.stringify(got)} ${ok ? "" : `(expected ${JSON.stringify(c.expected)})`}`);
}

console.log("\nURL rewrites:");
const partnerId = "2019713973";
const samples = [
  "https://www.zinzino.com/shop/site/US/en-us/products/premier-kits/910743",
  "https://www.zinzino.com/shop/site/EU/en-gb/products/premier-kits/123",
  "https://www.zinzino.com/shop/2019713973/US/en-us/products/x",
  "https://example.com/something",
  "",
];
for (const s of samples) {
  console.log(`  ${s || "(empty)"}\n    → ${personalizeProductUrl(s, partnerId) || "(empty)"}`);
}

console.log("\nSample catalog products → personalized URL:");
const all = allProducts();
const picks = ["BalanceOil+ Kit", "ZinoBiotic+ Kit", "LeanShake Chocolate, portion pack", "X Gold+ Kit", "R.E.V.O.O Kit"];
for (const name of picks) {
  const p = all.find((p) => p.name === name);
  if (!p) { console.log(`  MISS ${name}`); continue; }
  const rewritten = personalizeProductUrl(p.url, partnerId);
  const changed = rewritten !== p.url ? "✓ rewritten" : "(unchanged)";
  console.log(`  ${name}  ${changed}\n    catalog: ${p.url}\n    partner: ${rewritten}`);
}

if (fails > 0) {
  console.error(`\n${fails} extraction test(s) failed`);
  process.exit(1);
}
