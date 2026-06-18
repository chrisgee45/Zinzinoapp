import { allProducts, searchProducts } from "../server/products/catalog.js";

const all = allProducts();

// Zinzino-original products: should ALL read brand=Zinzino regardless
// of which catalog section they're listed in.
const zinzinoTests = [
  "BalanceOil+ Vegan",
  "BalanceOil+ Vegan without Test",
  "BalanceOil+ Premium",
  "BalanceOil+, 300 ml",
  "BalanceTest",
  "ZinoBiotic+",
  "Xtend+",
  "Viva+",
  "PhycoSci+ X20",
  "LeanShake Chocolate, portion pack",
];

// Acquired-brand products: should KEEP their actual brand tag.
const brandShopTests = [
  ["Zeal Kit", /Zurvita|Zeal/i],
  ["Verve Kit", /Vemma|Verve|Bode/i],
  ["Burn+ Kit", /Zurvita|Truvy/i],
  ["TFXX Kit", /It Works/i],
];

let fails = 0;

console.log("=== Zinzino-canonical products must read brand=Zinzino ===");
for (const name of zinzinoTests) {
  const matches = all.filter(p => p.name.toLowerCase().includes(name.toLowerCase()));
  if (matches.length === 0) {
    console.log(`SKIP  ${name}  (no catalog entries match)`);
    continue;
  }
  for (const p of matches.slice(0, 3)) {
    const ok = p.brand === "Zinzino";
    if (!ok) fails++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${p.name}  →  brand=${p.brand}`);
  }
}

console.log("\n=== Genuinely third-party brands keep their tag ===");
for (const [name, expectRe] of brandShopTests as [string, RegExp][]) {
  const p = all.find(p => p.name === name);
  if (!p) { console.log(`SKIP  ${name}  (not in catalog)`); continue; }
  const ok = expectRe.test(p.brand);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${p.name}  →  brand=${p.brand}`);
}

console.log("\n=== No literal duplicates in search results ===");
const results = searchProducts("BalanceOil", 20);
const seenNames = new Map<string, number>();
for (const r of results) {
  const k = r.name.toLowerCase();
  seenNames.set(k, (seenNames.get(k) ?? 0) + 1);
}
const dupes = [...seenNames.entries()].filter(([, n]) => n > 1);
if (dupes.length === 0) {
  console.log(`ok  search('BalanceOil') returned ${results.length} unique results`);
} else {
  console.log(`FAIL  duplicates found:`);
  for (const [k, n] of dupes) console.log(`  ${k}  ×${n}`);
  fails++;
}

console.log("\n=== Sample BalanceOil results (what the user sees) ===");
for (const r of results.slice(0, 8)) {
  console.log(`  ${r.name}  [${r.brand}]`);
}

if (fails > 0) {
  console.error(`\n${fails} failure(s)`);
  process.exit(1);
}
console.log("\nAll checks passed ✓");
