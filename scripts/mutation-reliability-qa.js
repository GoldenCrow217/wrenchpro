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
assert.ok(!html.includes("if(e.target===o) o.classList.remove('open')"), 'clicking a modal backdrop must not close data-entry windows');
assert.match(html, /id="m-job-catalog"/, 'job catalog selection must use an in-app picker');
assert.match(html, /function addSelectedJobCatalogItem\(\)/, 'job catalog picker must add the selected line item');
const catalogHandlerStart = html.indexOf('function addJobItemFromCatalog()');
const catalogHandlerEnd = html.indexOf('\nfunction addSelectedJobCatalogItem()', catalogHandlerStart);
assert.ok(catalogHandlerStart >= 0 && catalogHandlerEnd > catalogHandlerStart, 'job catalog handler source must be extractable');
assert.ok(!html.slice(catalogHandlerStart, catalogHandlerEnd).includes('prompt('), 'job catalog selection must not depend on unsupported window.prompt');
assert.match(html, /function addJobItem\(type='labor'\)/, 'new repair-order labor items must default to the labor type before selecting a rate');
assert.match(html, /type==='labor' \? \(state\.settings\.default_labor_rate\|\|0\)/, 'new repair-order labor items must use the configured default labor rate');
const addJobItemStart = html.indexOf("function addJobItem(type='labor')");
const addJobItemEnd = html.indexOf('\nfunction addJobItemFromCatalog()', addJobItemStart);
assert.ok(addJobItemStart >= 0 && addJobItemEnd > addJobItemStart, 'job item handler source must be extractable');
const jobItemContext = { state: { settings: { default_labor_rate: 125, diagnostic_rate: 150 } } };
vm.runInNewContext(`var jobItems=[];function renderJobItems(){};${html.slice(addJobItemStart, addJobItemEnd)};addJobItem();globalThis.result=jobItems[0];`, jobItemContext);
assert.strictEqual(jobItemContext.result.type, 'labor');
assert.strictEqual(jobItemContext.result.rate, 125, 'new repair-order labor items must pull the saved default labor rate');
const nextRoStart = html.indexOf('function nextRepairOrderNumber(');
const nextRoEnd = html.indexOf('\nfunction _calcJob()', nextRoStart);
assert.ok(nextRoStart >= 0 && nextRoEnd > nextRoStart, 'repair-order number helper source must be extractable');
const repairOrderContext = {};
vm.runInNewContext(`${html.slice(nextRoStart, nextRoEnd)};globalThis.qa={nextRepairOrderNumber,normalizeRepairOrderNumber};`, repairOrderContext);
assert.strictEqual(repairOrderContext.qa.nextRepairOrderNumber([]), 'RO-1001', 'the first suggested repair-order number must be RO-1001');
assert.strictEqual(repairOrderContext.qa.nextRepairOrderNumber([{ id: 1, repair_order_number: 'RO-1009' }]), 'RO-1010', 'repair-order numbering must increment the highest RO number');
assert.strictEqual(repairOrderContext.qa.nextRepairOrderNumber([{ id: 4, repair_order_number: 'CUSTOM-2000' }, { id: 3, repair_order_number: 'RO-1041' }]), 'RO-1042', 'repair-order numbering must ignore non-RO prefixes');
assert.strictEqual(repairOrderContext.qa.normalizeRepairOrderNumber('42'), 'RO-0042', 'numeric user input must receive the fixed RO prefix and four-digit padding');
assert.strictEqual(repairOrderContext.qa.normalizeRepairOrderNumber('ro-1200'), 'RO-1200', 'full repair-order input must be normalized');
assert.strictEqual(repairOrderContext.qa.normalizeRepairOrderNumber('WP-42'), null, 'other repair-order prefixes must be rejected');
assert.match(html, /id="jf-ro"(?![^>]*(?:readonly|disabled))/, 'repair-order number input must remain editable');
assert.match(html, /getElementById\('jf-ro'\)\.value=nextRepairOrderNumber\(\)/, 'new jobs must receive the next suggested repair-order number');
assert.match(html, /const invoiceNum = `INV-\$\{String\(safeId\(j\.id\)\)\.padStart\(4,'0'\)\}`/, 'invoice numbers must use the INV-#### format');
assert.match(html, /id="jf-travel-fee"[^>]*step="10"/, 'job travel-fee spinner must use ten-dollar increments');
assert.match(html, /onclick="handleCustVehicleAction\(\)"[^>]*id="cf-veh-btn"/, 'customer vehicle action must support adding a vehicle after customer creation');
assert.match(html, /function handleCustVehicleAction\(\)[\s\S]*?openVehModal\(customerId,null\)/, 'editing a customer must provide a direct add-vehicle path');
assert.ok(!html.includes("document.getElementById('cf-veh-toggle').style.display='none'; // hide vehicle adder on edit"), 'customer editing must not hide the add-vehicle action');
assert.match(html, /Optional — you can add a vehicle later\./, 'new-customer form must explain that vehicle information is optional');
const estimatesRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'estimates.js'), 'utf8');
assert.match(estimatesRoute, /const num = 'EST-'/, 'estimate identifiers must retain the EST- prefix');
assert.match(html, /const wantsConversion=body\.status==='Approved'/, 'saving an approved estimate must trigger repair-order conversion');
assert.match(html, /The estimate was saved as Draft, but no repair order was created/, 'failed automatic conversion must remain retryable without an approved orphan estimate');
assert.match(html, /function openConvertedRepairOrder\(/, 'automatic and manual estimate conversion must share the repair-order opening path');
assert.match(estimatesRoute, /repairOrderNumber = `RO-\$\{String\(highestRepairOrder \+ 1\)\.padStart\(4, '0'\)\}`/, 'estimate conversion must assign the next RO-#### number');
assert.match(estimatesRoute, /INSERT INTO jobs \(customer_id, vehicle_id, employee_id, service, repair_order_number,/, 'converted estimates must persist their repair-order number');

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
