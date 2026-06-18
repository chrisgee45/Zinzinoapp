import { allProducts, formatProduct } from "../server/products/catalog.js";

const all = allProducts();
const withSheet = all.filter(p => p.factSheet);
console.log(`products total: ${all.length}`);
console.log(`with factSheet: ${withSheet.length}`);

// Per-PDF count
const byPdf = new Map<string, number>();
for (const p of withSheet) {
  const k = p.factSheet.split("/").pop()!;
  byPdf.set(k, (byPdf.get(k) ?? 0) + 1);
}
console.log("\nProducts attached per PDF:");
for (const [k, n] of [...byPdf.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${k}`);
}

// Sanity: show a couple of high-traffic products to confirm URLs flipped
console.log("\nSample product factSheet values:");
for (const name of ["BalanceOil+ Kit", "BalanceOil+ Premium Kit", "BalanceOil+ Vegan Kit with Test", "ZinoBiotic+ Kit", "LeanShake Chocolate, portion pack", "Xtend+ Kit", "Xtend Kit", "Skin Serum Kit, 50 ml"]) {
  const p = all.find(p => p.name === name);
  if (!p) { console.log(`  MISS ${name}`); continue; }
  console.log(`  ${name}\n    → ${p.factSheet || "(no sheet)"}`);
}
