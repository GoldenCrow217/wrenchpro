const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean);
scripts.forEach((source, index) => new vm.Script(source, { filename: `public/index.inline-${index}.js` }));

const loadAllCalls = [...html.matchAll(/\bloadAll\s*\(/g)];
assert.strictEqual(loadAllCalls.length, 3, 'loadAll must remain limited to its declaration, startup, and focus refresh');
assert.match(html, /function upsertStateRecord\(/);
assert.match(html, /function removeStateRecord\(/);
assert.match(html, /async function runMutation\(/);
assert.match(html, /const activeMutations = new Set\(\)/);

const handlers = [
  'saveVehicle', 'saveJob', 'saveAppt', 'saveLead', 'savePart', 'saveEstimate',
  'saveExpense', 'saveWarranty', 'saveEmployee', 'savePayment', 'savePlan',
  'saveInspection', 'saveCatalogItem', 'saveTimeEntry',
];
for (const name of handlers) {
  const start = html.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = html.indexOf('\nasync function ', start + 1);
  const body = html.slice(start, next < 0 ? html.length : next);
  assert.ok(body.includes('runMutation(') || name === 'saveQuickEntry', `${name} must use the guarded mutation workflow`);
  assert.ok(!body.includes('loadAll('), `${name} must not call loadAll`);
}

for (const id of ['save-job-btn','save-vehicle-btn','save-payment-btn','save-plan-btn','save-expense-btn','save-appt-btn','save-employee-btn','save-estimate-btn','save-inspection-btn','save-part-btn','save-catalog-btn','save-lead-btn','save-time-btn','save-warranty-btn']) {
  assert.match(html, new RegExp(`id="${id}"[^>]*type="button"`), `${id} must be an explicit button`);
}

const plansRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'plans.js'), 'utf8');
assert.match(plansRoute, /plan\.installments\s*=\s*db\.prepare/);
assert.match(plansRoute, /res\.json\(plan\)/);

const helperStart = html.indexOf('function upsertStateRecord(');
const helperEnd = html.indexOf('\nfunction addDays(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'mutation helper source must be extractable');
const helperSource = html.slice(helperStart, helperEnd);

async function testRuntimeGuards() {
  const button = { tagName: 'BUTTON', textContent: 'Save', dataset: {}, disabled: false };
  const messages = [];
  const closed = [];
  const context = {
    state: { records: [], customers: [], vehicles: [], employees: [] },
    activeMutations: new Set(),
    document: { activeElement: button, getElementById: () => button },
    toast: (message, duration) => messages.push({ message, duration }),
    closeM: id => closed.push(id),
    console: { error: () => {} },
    setTimeout,
  };
  vm.runInNewContext(`${helperSource};globalThis.qa={runMutation,upsertStateRecord};`, context);

  let requests = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const first = context.qa.runMutation('duplicate', {
    action: 'Saving test record', close: 'modal', success: 'Saved',
    request: async () => { requests += 1; await pending; return { id: 1, name: 'One' }; },
    apply: record => context.qa.upsertStateRecord('records', record),
  });
  const duplicate = await context.qa.runMutation('duplicate', { request: async () => { requests += 1; } });
  assert.strictEqual(duplicate, null);
  assert.strictEqual(requests, 1, 'duplicate clicks must execute one request');
  assert.strictEqual(button.disabled, true);
  release();
  await first;
  assert.strictEqual(button.disabled, false);
  assert.strictEqual(context.state.records.length, 1);
  assert.deepStrictEqual(closed, ['modal']);

  const before = JSON.stringify(context.state.records);
  const failed = await context.qa.runMutation('failure', {
    action: 'Saving test record', close: 'failure-modal', success: 'Saved',
    request: async () => { throw new Error('simulated network failure'); },
    apply: record => context.qa.upsertStateRecord('records', record),
  });
  assert.strictEqual(failed, null);
  assert.strictEqual(JSON.stringify(context.state.records), before, 'failed mutations must not change state');
  assert.ok(!closed.includes('failure-modal'), 'failed mutations must keep the modal open');
  assert.strictEqual(messages.at(-1).duration, 8000, 'failure message must remain visible for eight seconds');
}

testRuntimeGuards()
  .then(() => console.log('Mutation reliability QA passed'))
  .catch(error => { console.error(error); process.exitCode = 1; });
