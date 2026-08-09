const assert = require('assert');
const {
  DEFAULT_PARTS_MARKUP_TIERS,
  normalizeMarkupTiers,
  markupForCost,
  roundCurrency,
  calculateEstimateTotals,
} = require('../server/pricing');

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
}

testMarkupSchedule();
testTierValidation();
testPartsOnlyTax();
console.log('Pricing QA passed: markup tiers, cent rounding, validation, and parts-only tax.');
