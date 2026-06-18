import { creditFor } from "../server/products/commission.js";

const cases: Array<[string, string | null, number, string]> = [
  // Tests
  ["BalanceTest", null, 500, "5 cv standalone test"],
  ["Gut Health Test x2", null, 1000, "10 cv x2 pack"],
  ["Gut Health Test", null, 600, "6 cv single test"],
  ["Vitamin D Test", null, 300, "3 cv"],
  ["HbA1c Test", null, 300, "3 cv"],

  // BalanceOil family
  ["BalanceOil+ Kit", "300 ml", 400, "BalanceOil+ 300ml base"],
  ["BalanceOil+", "100 ml", 150, "BalanceOil+ 100ml smaller"],
  ["BalanceOil+", "6x100 ml", 600, "BalanceOil+ 6-pack"],
  ["BalanceOil+ Premium Kit", "300 ml", 500, "Premium variant"],
  ["BalanceOil+ AquaX without Test", null, 500, "AquaX variant"],
  ["BalanceOil+ Vegan Kit with Test", null, 500, "Vegan variant"],
  ["BalanceOil Tutti Frutti, 300 ml", null, 400, "Tutti Frutti"],

  // Other Zinzino
  ["Essent+ Premium", null, 400, "Essent+ Premium"],
  ["R.E.V.O.O Kit", null, 700, "REVOO"],
  ["ZinoGene+", null, 500, "ZinoGene+"],
  ["Viva+", null, 300, "Viva+ single"],
  ["Viva+ x2 Kit", null, 400, "Viva+ x2"],
  ["PhycoSci+ X20", null, 400, "PhycoSci"],
  ["ZinoShine+", null, 125, "ZinoShine+"],
  ["Xtend+ Kit", null, 400, "Xtend+"],
  ["Xtend Kit", null, 300, "Xtend (base)"],
  ["Protect+", null, 400, "Protect+"],
  ["SpiruMax+ Kit", null, 300, "SpiruMax"],
  ["ZinoBiotic+ Kit", null, 300, "ZinoBiotic+"],
  ["X Gold+ Kit", null, 500, "X-GOLD"],

  // LeanShake
  ["LeanShake Chocolate, portion pack", null, 400, "LeanShake Choc"],
  ["LeanShake Berry, portion pack", null, 400, "LeanShake Berry"],

  // Skin / collagen
  ["Collagen Boozt", null, 500, "Collagen Boozt"],

  // Brand Shop spot-checks
  ["Zeal Kit", null, 570, "Zeal base"],
  ["Zeal x2 Kit", null, 800, "Zeal x2"],
  ["Zundora Kit", null, 670, "Zundora"],
  ["Burn+ Kit", null, 360, "Burn+"],
  ["Verve Burn x2 Kit", null, 750, "Verve Burn x2 (must not match Verve base)"],
  ["Verve Kit", null, 400, "Verve base"],
  ["Skinny Wrap Kit", null, 500, "Skinny Wrap"],
  ["TFXX Kit", null, 410, "TFXX"],
  ["30-Day Drop System Kit", null, 800, "Big drop system kit"],
  ["Root Revival Kit", null, 400, "Root Revival"],

  // Misses (should return 0)
  ["Some Made Up Product XYZ", null, 0, "Unknown product"],
];

let fails = 0;
for (const [name, variant, want, label] of cases) {
  const got = creditFor(name, variant);
  const ok = got === want;
  if (!ok) fails++;
  const formatted = `${(got / 100).toFixed(2).padStart(6)} cv`;
  const expected = `${(want / 100).toFixed(2)} cv`;
  console.log(`${ok ? "ok " : "FAIL"}  ${formatted}  ${name}${variant ? ` [${variant}]` : ""} — ${label}${ok ? "" : `  (expected ${expected})`}`);
}
console.log("\n" + (fails === 0 ? "All cases passed ✓" : `${fails} failure(s)`));
if (fails > 0) process.exit(1);
