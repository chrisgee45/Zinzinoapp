// One-shot sanity check for the product catalog parser.
//   npx tsx scripts/check-product-parse.ts
// Prints the count + a few sample formatted products so we can eyeball
// that brand/price/overview/benefits all landed correctly.

import { allProducts, findProduct, searchProducts, formatProduct, catalogBlock } from "../server/products/catalog.js";

const products = allProducts();
console.log(`Parsed ${products.length} products.`);

const brandCounts = new Map<string, number>();
for (const p of products) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
console.log("Brand counts:", Object.fromEntries(brandCounts));

const samples = ["Amino Kit", "BalanceOil+ Kit", "LeanShake", "Burn+ Kit", "ZinoBiotic"];
for (const name of samples) {
  console.log("\n────────────────────────────────");
  const p = findProduct(name);
  if (!p) {
    console.log(`MISS: ${name}`);
    continue;
  }
  console.log(formatProduct(p));
}

console.log("\n── search 'omega 3 vegan' ──");
const omegaHits = searchProducts("omega 3 vegan", 3);
for (const p of omegaHits) console.log(`${p.brand} :: ${p.name}`);

console.log("\n── search 'gut health' ──");
const gutHits = searchProducts("gut health", 3);
for (const p of gutHits) console.log(`${p.brand} :: ${p.name}`);

console.log("\n── catalogBlock sample size ──");
console.log(`${catalogBlock(omegaHits).length} chars`);
