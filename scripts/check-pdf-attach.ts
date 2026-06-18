import { allProducts } from "../server/products/catalog.js";
const all = allProducts();
console.log(`products total: ${all.length}`);
console.log(`with factSheet: ${all.filter(p => p.factSheet).length}`);

for (const needle of ["REVOO", "X-GOLD", "X-Gold", "Viva-Questionnaire"]) {
  const hits = all.filter(p => p.factSheet?.includes(needle));
  console.log(`\n${needle} → ${hits.length} product(s):`);
  for (const p of hits) console.log(`  - ${p.name}`);
}

const vivaQ = all.filter(p => p.name.toLowerCase().includes("viva"));
console.log(`\nViva* products in catalog (${vivaQ.length}):`);
for (const p of vivaQ.slice(0, 8)) console.log(`  - ${p.name}\n      sheet: ${p.factSheet || "(none)"}`);
