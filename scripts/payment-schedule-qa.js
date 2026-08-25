const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
assert.match(html, /id="pl-custom-payment-amount"/, 'custom regular-payment amount control is missing');
assert.match(html, /The number of payments is calculated automatically/, 'automatic schedule guidance is missing');

const start = html.indexOf('const MAX_CUSTOM_PLAN_PAYMENTS=240;');
const end = html.indexOf('\nfunction renderCustomPlanAmounts()', start);
assert(start >= 0 && end > start, 'custom payment schedule calculator is missing');
const context = {};
vm.runInNewContext(`${html.slice(start, end)};globalThis.calculate=customPaymentAmounts;`, context);

assert.deepStrictEqual(Array.from(context.calculate(1000, 300)), [300, 300, 300, 100]);
assert.deepStrictEqual(Array.from(context.calculate(25.50, 20)), [20, 5.5]);
assert.deepStrictEqual(Array.from(context.calculate(100, 150)), [100]);
assert.deepStrictEqual(Array.from(context.calculate(100, 33.33)), [33.33, 33.33, 33.33, 0.01]);
assert.strictEqual(context.calculate(1000, 1).length, 0, 'schedules above the safety limit must be rejected');
assert.strictEqual(context.calculate(100, 0).length, 0, 'zero payment amount must be rejected');
assert.strictEqual(context.calculate(100, -10).length, 0, 'negative payment amount must be rejected');

console.log('Payment schedule QA passed: custom amounts, cent rounding, final-payment adjustment, and safety limit.');
