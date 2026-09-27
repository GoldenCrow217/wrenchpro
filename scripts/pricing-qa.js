const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_PARTS_MARKUP_TIERS,
  normalizeMarkupTiers,
  markupForCost,
  roundCurrency,
  calculateEstimateTotals,
  calculateJobTotals,
} = require('../server/pricing');
const { normalizedItemType, normalizeLineItems, lineItemTotals } = require('../server/line-items');

function testMarkupSchedule() {
  const cases = [
    [0.5, 125], [1, 125], [1.01, 75], [5, 75], [5.01, 60], [10, 60],
    [10.01, 45], [25, 45], [25.01, 32.5], [150, 32.5], [150.01, 30],
    [300, 30], [300.01, 25], [500, 25], [500.01, 18], [1000, 18],
    [1000.01, 17.5], [5000, 17.5], [5000.01, 15],
  ];
  cases.forEach(([cost, expected]) => assert.strictEqual(markupForCost(cost), expected));
  assert.strictEqual(roundCurrency(25.5 * 1.2), 30.6);
  assert.strictEqual(roundCurrency(100 * 1.4), 140);
  assert.strictEqual(roundCurrency(1 * 2.25), 2.25);
}

function testTierValidation() {
  assert.deepStrictEqual(normalizeMarkupTiers(''), DEFAULT_PARTS_MARKUP_TIERS.map(t => ({ ...t })));
  assert.throws(() => normalizeMarkupTiers('[{"up_to":1,"markup":10}]'), /at least/);
  assert.throws(() => normalizeMarkupTiers([{ up_to: 5, markup: 10 }, { up_to: 2, markup: 10 }, { up_to: null, markup: 5 }]), /increasing/);
  assert.throws(() => normalizeMarkupTiers([{ up_to: 1, markup: -1 }, { up_to: null, markup: 5 }]), /non-negative/);
  assert.throws(() => normalizeMarkupTiers([{ up_to: 1, markup: 10 }, { up_to: 5, markup: 5 }]), /Above/);
  const custom = normalizeMarkupTiers([{ up_to: 20, markup: 50 }, { up_to: 100, markup: 25 }, { up_to: null, markup: 10 }]);
  assert.strictEqual(markupForCost(50, custom), 25, 'custom tiers must participate in price selection');
}

function testTierEditingControls() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /onclick="addPartsMarkupTier\(\)"/, 'markup settings must expose an add-tier control');
  assert.match(html, /function removePartsMarkupTier\(index\)/, 'markup settings must support removing regular tiers');
  assert.match(html, /Keep at least one price tier plus the Above tier/, 'the required catch-all schedule must be protected');
  assert.match(html, /stat-label">Total cost</, 'inventory KPI must show total cost');
  assert.match(html, /stat-label">Total retail</, 'inventory KPI must show total retail');
  assert.ok(!html.includes('stat-label">Inventory value'), 'ambiguous inventory-value KPI must be removed');
}

function testPartsOnlyTax() {
  const items = [
    { type: 'labor', amount: 100 },
    { type: 'diagnostic', amount: 20 },
    { type: 'parts', amount: 50 },
    { type: 'fee', amount: 10 },
  ];
  assert.deepStrictEqual(calculateEstimateTotals(items, 0, 10), {
    subtotal: 180, discount: 0, taxableParts: 50, taxableAfterDiscount: 50, tax: 5, total: 185,
  });
  assert.deepStrictEqual(calculateEstimateTotals(items, 36, 10), {
    subtotal: 180, discount: 36, taxableParts: 50, taxableAfterDiscount: 40, tax: 4, total: 148,
  });
  assert.strictEqual(calculateEstimateTotals([{ type: 'labor', amount: 100 }], 0, 8.25).tax, 0);
  assert.strictEqual(calculateEstimateTotals([{ type: 'parts', amount: 30.6 }], 0, 8.25).total, 33.12);
  assert.deepStrictEqual(calculateJobTotals(100, 50, 25, 30, 10), {
    labor: 100, parts: 50, subtotal: 150, discount: 30, netLabor: 80, netParts: 40, tax: 4, travelFee: 25, total: 149,
  });
  assert.strictEqual(calculateJobTotals(100, 50, 0, 999, 10).total, 0, 'discounts above the subtotal must not create negative totals or tax');
}

function testExplicitDiscountLines() {
  const items = normalizeLineItems([
    { type: 'labor', description: 'Brake service', qty: 1, rate: 100 },
    { type: 'parts', description: 'Brake pads', qty: 1, rate: 50 },
    { type: 'discount', description: 'Brake service coupon', qty: 1, rate: 20 },
  ]);
  assert.strictEqual(normalizedItemType('discount'), 'discount');
  assert.deepStrictEqual(lineItemTotals(items), { labor: 100, parts: 50, discount: 20, laborHours: 1, laborRate: 100 });
  assert.deepStrictEqual(calculateEstimateTotals(items, 999, 10), {
    subtotal: 150, discount: 20, taxableParts: 50, taxableAfterDiscount: 43.33, tax: 4.33, total: 134.33,
  }, 'an explicit discount line must replace, not stack with, the legacy order-wide discount');

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(!html.includes('id="jf-discount"'), 'repair orders must not expose the legacy order-wide discount input');
  assert.ok(!html.includes('id="est-discount"'), 'estimates must not expose the legacy order-wide discount input');
  assert.match(html, /'sublet','discount'/, 'line-item selectors must offer an explicit discount type');
  assert.match(html, /Discount applies to/, 'discount lines must prompt the user to identify the eligible work');
}

// ADR-0005: the browser must use server/pricing.js, never its own copy of the math.
function testSingleSourcePricing() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const sharedTag = html.indexOf('<script src="/shared/pricing.js"></script>');
  const mainScript = html.search(/\r?\n<script>\r?\n/);
  assert.ok(sharedTag >= 0 && mainScript > sharedTag, 'the UI must load the shared pricing module before its own script');
  assert.match(html, /function calculateEstimateTotals\(items,discount,taxRate\)\{\r?\n  return WrenchProPricing\.calculateEstimateTotals\(/, 'estimate totals must delegate to the shared module');
  assert.match(html, /function jobPricingTotals\([^)]*\)\{\r?\n  return WrenchProPricing\.calculateJobTotals\(/, 'repair-order totals must delegate to the shared module');
  assert.match(html, /WrenchProPricing\.markupForCost\(/, 'parts markup must delegate to the shared module');
  assert.match(html, /const DEFAULT_PARTS_MARKUP_TIERS=WrenchProPricing\.DEFAULT_PARTS_MARKUP_TIERS;/, 'default markup tiers must come from the shared module');
  assert.ok(!html.includes('Number.EPSILON'), 'the UI must use WrenchProPricing.roundCurrency instead of re-implementing currency rounding');

  // The same file must also work as a plain browser script (no require/module).
  const vm = require('vm');
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'pricing.js'), 'utf8');
  const browser = {};
  vm.runInNewContext(source, browser);
  // Compare plain values: objects from the sandbox have a different prototype.
  const plain = value => JSON.parse(JSON.stringify(value));
  assert.deepStrictEqual(
    plain(browser.WrenchProPricing.calculateJobTotals(100, 50, 25, 30, 10)),
    plain(calculateJobTotals(100, 50, 25, 30, 10)),
    'the browser build of pricing.js must compute exactly what the server computes',
  );
}

function testSettingsPropagationWiring() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const settingsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'settings.js'), 'utf8');
  assert.match(html, /function propagateSettingsChange\(previousSettings=\{\}\)/, 'saved settings must propagate to dependent views and open forms');
  assert.match(html, /state\.settings\.oil_warn_miles \?\? 1500/, 'a saved zero-mile warning threshold must not fall back to 1500');
  assert.match(html, /String\(state\.settings\.currency_symbol\|\|'\$'\)\.slice\(0,3\)/, 'custom saved currency symbols must be used by money formatting');
  assert.match(html, /await refreshResource\('\/api\/plans','plans'\)/, 'payment plans must refresh when grace-period or late-fee settings change');
  assert.match(html, /customer\?\.customer_type==='Fleet'.*state\.settings\.fleet_rate/, 'fleet customers must use the configured fleet labor rate');
  assert.match(html, /function addEstItem\(type='labor',desc='',qty=1,rate=null\)/, 'new estimate lines must distinguish configured defaults from manual zero-dollar rates');
  assert.strictEqual(normalizedItemType('emergency'), 'emergency', 'emergency labor must be an allowed line-item type');
  assert.deepStrictEqual(lineItemTotals(normalizeLineItems([{ type: 'emergency', qty: 2, rate: 150 }])), { labor: 300, parts: 0, discount: 0, laborHours: 2, laborRate: 150 });
  assert.match(html, /type==='emergency'\)return Number\(state\.settings\.emergency_rate\)/, 'emergency labor lines must use the configured after-hours rate');
  assert.match(settingsRoute, /return res\.json\(globalSettings\(\)\)/, 'settings save must return canonical global settings');
  assert.match(settingsRoute, /res\.json\(shopSettings\(shopId\)\)/, 'settings save must return canonical shop settings');
}

testMarkupSchedule();
testTierValidation();
testTierEditingControls();
testPartsOnlyTax();
testExplicitDiscountLines();
testSettingsPropagationWiring();
testSingleSourcePricing();
console.log('Pricing QA passed: markup tiers, cent rounding, validation, parts-only tax, explicit discount lines, and one shared implementation for server and UI.');
