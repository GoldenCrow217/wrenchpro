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
assert.match(html.slice(catalogHandlerStart, catalogHandlerEnd), /state\.inventory/, 'job catalog picker must include Parts & Inventory state');
assert.match(html.slice(catalogHandlerStart, catalogHandlerEnd), /value="inventory:\$\{safeId\(part\.id\)\}"/, 'inventory options must use collision-safe namespaced IDs');
const selectedCatalogStart = catalogHandlerEnd + 1;
const selectedCatalogEnd = html.indexOf('\nasync function openJobModal(', selectedCatalogStart);
assert.ok(selectedCatalogEnd > selectedCatalogStart, 'selected job catalog handler must be extractable');
const selectedCatalogContext = {
  state:{catalog:[],inventory:[{id:7,name:'Brake pads',retail_price:89.95,quantity:2}]},
  jobItems:[],
  document:{getElementById(){return{value:'inventory:7'};}},
  renderJobItems(){},closeM(){},toast(){},
};
vm.runInNewContext(`${html.slice(selectedCatalogStart, selectedCatalogEnd)};addSelectedJobCatalogItem();`, selectedCatalogContext);
assert.strictEqual(selectedCatalogContext.jobItems.length, 1, 'selecting an inventory part must add one job line');
assert.strictEqual(selectedCatalogContext.jobItems[0].inventory_id, 7, 'inventory job lines must retain the stable inventory ID');
assert.strictEqual(selectedCatalogContext.jobItems[0].rate, 89.95, 'inventory job lines must use retail price');
assert.strictEqual(selectedCatalogContext.jobItems[0].taxable, 1, 'inventory job lines must remain taxable');
const catalogServiceStart = html.indexOf('function catalogServiceLine(');
const catalogServiceEnd = html.indexOf('\nfunction addJobItemFromCatalog()', catalogServiceStart);
assert.ok(catalogServiceStart >= 0 && catalogServiceEnd > catalogServiceStart, 'shared catalog service mapping must be extractable');
const catalogServiceContext = {};
vm.runInNewContext(`${html.slice(catalogServiceStart, catalogServiceEnd)};globalThis.catalogServiceLine=catalogServiceLine;`, catalogServiceContext);
assert.strictEqual(JSON.stringify(catalogServiceContext.catalogServiceLine({name:'Oil change',default_hours:1,default_price:49.99,taxable:1})), JSON.stringify({type:'labor',description:'Oil change',qty:1,rate:49.99,amount:49.99,taxable:0}), 'catalog services must preserve the entered name, hour, and price as labor');
assert.strictEqual(catalogServiceContext.catalogServiceLine({name:'Two-hour service',default_hours:2,default_price:49.99}).rate, 49.99, 'catalog price must not be divided by catalog hours');
assert.match(html, /jobItems\.push\(catalogServiceLine\(service\)\)/, 'job catalog additions must use the shared service mapping');
assert.match(html, /estItems\.push\(catalogServiceLine\(svc\)\)/, 'estimate catalog additions must use the shared service mapping');
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
assert.match(html, /id="jf-apply-trip-fee"[^>]*onchange="toggleJobTripFee\(\)"/, 'repair orders must offer an explicit trip-fee toggle');
assert.match(html, /function toggleJobTripFee\(\)/, 'trip-fee toggle behavior must use the saved settings preset');
assert.match(html, /amount\.value=Number\(state\.settings\.service_fee\|\|0\)\.toFixed\(2\)/, 'enabling a trip fee must populate the Settings preset');
assert.match(html, /travel_fee:document\.getElementById\('jf-apply-trip-fee'\)\.checked\?/, 'disabled trip fees must save as zero');
assert.match(html, /getElementById\('jf-apply-trip-fee'\)\.checked=Number\(j\.travel_fee\|\|0\)>0/, 'editing a charged repair order must restore the trip-fee toggle');
const tripToggleStart = html.indexOf('function toggleJobTripFee()');
const tripToggleEnd = html.indexOf('\nfunction renderJobItems()', tripToggleStart);
assert.ok(tripToggleStart >= 0 && tripToggleEnd > tripToggleStart, 'trip-fee toggle helper must be extractable');
const tripElements = { 'jf-apply-trip-fee':{checked:true}, 'jf-travel-fee':{value:'',disabled:true} };
const tripToggleContext = { state:{settings:{service_fee:50}}, document:{getElementById:id=>tripElements[id]}, _calcJob(){} };
vm.runInNewContext(`${html.slice(tripToggleStart, tripToggleEnd)};toggleJobTripFee();`, tripToggleContext);
assert.strictEqual(tripElements['jf-travel-fee'].value, '50.00', 'trip-fee toggle must apply the saved $50 preset');
assert.strictEqual(tripElements['jf-travel-fee'].disabled, false, 'enabled trip-fee input must be editable');
tripElements['jf-apply-trip-fee'].checked=false;
tripToggleContext.toggleJobTripFee();
assert.strictEqual(tripElements['jf-travel-fee'].disabled, true, 'disabled trip-fee input must not be editable');
assert.match(html, /<option value="open">All open Repair orders<\/option>/, 'Jobs must offer an all-open repair-order filter');
assert.match(html, /<option value="closed">All closed repair orders<\/option>/, 'Jobs must offer an all-closed repair-order filter');
const jobFilterStart = html.indexOf('function jobMatchesOrderFilter(');
const jobFilterEnd = html.indexOf('\nfunction renderJobs()', jobFilterStart);
assert.ok(jobFilterStart >= 0 && jobFilterEnd > jobFilterStart, 'job repair-order filter helper must be extractable');
const jobFilterContext = {};
vm.runInNewContext(`${html.slice(jobFilterStart, jobFilterEnd)};globalThis.jobMatchesOrderFilter=jobMatchesOrderFilter;`, jobFilterContext);
assert.strictEqual(jobFilterContext.jobMatchesOrderFilter({ status: 'Pending', closed_at: null }, 'open'), true, 'pending repair orders must be open');
assert.strictEqual(jobFilterContext.jobMatchesOrderFilter({ status: 'Waiting on Parts', closed_at: null }, 'open'), true, 'waiting-on-parts repair orders must be open');
assert.strictEqual(jobFilterContext.jobMatchesOrderFilter({ status: 'Complete', closed_at: '2026-08-12 12:00:00' }, 'closed'), true, 'completed repair orders must be closed');
assert.strictEqual(jobFilterContext.jobMatchesOrderFilter({ status: 'Canceled', closed_at: null }, 'closed'), true, 'canceled repair orders must be closed');
assert.strictEqual(jobFilterContext.jobMatchesOrderFilter({ status: 'In Progress', closed_at: '2026-08-12 12:00:00' }, 'closed'), true, 'persisted closed repair orders must remain discoverable');
assert.strictEqual(jobFilterContext.jobMatchesOrderFilter({ status: 'Complete', closed_at: '2026-08-12 12:00:00' }, ''), true, 'all statuses must include closed repair orders');
assert.strictEqual((html.match(/data-job-sort=/g)||[]).length, 10, 'every Jobs data column must provide a sort control');
assert.match(html, /function setJobSort\(key\)/, 'Jobs column sorting must provide ascending/descending toggling');
assert.match(html, /setAttribute\('aria-sort'/, 'Jobs sort controls must expose their current direction');
const jobSortStart = html.indexOf('function jobSortValue(');
const jobSortEnd = html.indexOf('\nfunction setJobSort(', jobSortStart);
assert.ok(jobSortStart >= 0 && jobSortEnd > jobSortStart, 'job sort helpers must be extractable');
const jobSortContext = {};
vm.runInNewContext(`${html.slice(jobSortStart, jobSortEnd)};globalThis.compareJobsForSort=compareJobsForSort;`, jobSortContext);
const sortJobs = [{ repair_order_number:'RO-10', first:'Zoe', labor:5, parts:20 },{ repair_order_number:'RO-2', first:'Amy', labor:10, parts:5 }];
assert.deepStrictEqual(sortJobs.slice().sort((a,b)=>jobSortContext.compareJobsForSort(a,b,'ro','asc')).map(job=>job.repair_order_number), ['RO-2','RO-10'], 'repair-order sorting must use natural numeric order');
assert.deepStrictEqual(sortJobs.slice().sort((a,b)=>jobSortContext.compareJobsForSort(a,b,'customer','asc')).map(job=>job.first), ['Amy','Zoe'], 'customer sorting must use customer names');
assert.deepStrictEqual(sortJobs.slice().sort((a,b)=>jobSortContext.compareJobsForSort(a,b,'total','desc')).map(job=>job.repair_order_number), ['RO-10','RO-2'], 'descending total sorting must use displayed job totals');
assert.strictEqual((html.match(/<div>Labor hours<\/div><div>Qty<\/div>/g)||[]).length, 2, 'job and estimate editors must separate labor hours from part quantity');
assert.match(html, /function isLaborLineItem\(type\)/, 'line-item editors must classify labor-hour rows consistently');
assert.match(html, /function setJobItemType\(index,type\)/, 'job type changes must move quantity into the correct column');
assert.match(html, /function setEstItemType\(index,type\)/, 'estimate type changes must move quantity into the correct column');
assert.ok(html.includes('aria-label="Labor hours"') && html.includes('aria-label="Part quantity"'), 'separate line-item inputs must have clear accessible labels');
const lineItemTypeStart = html.indexOf('function isLaborLineItem(');
const lineItemTypeEnd = html.indexOf('\nfunction addJobItem(', lineItemTypeStart);
assert.ok(lineItemTypeStart >= 0 && lineItemTypeEnd > lineItemTypeStart, 'job line-item type helpers must be extractable');
const lineItemTypeContext = { jobItems:[{ type:'labor', qty:2.5, taxable:0 }], renderJobItems(){} };
vm.runInNewContext(`${html.slice(lineItemTypeStart, lineItemTypeEnd)};globalThis.qa={isLaborLineItem,setJobItemType};`, lineItemTypeContext);
assert.strictEqual(lineItemTypeContext.qa.isLaborLineItem('diagnostic'), true, 'diagnostic work must use the labor-hours column');
assert.strictEqual(lineItemTypeContext.qa.isLaborLineItem('part'), false, 'parts must use the quantity column');
lineItemTypeContext.qa.setJobItemType(0,'part');
assert.strictEqual(lineItemTypeContext.jobItems[0].qty, 1, 'switching from labor to parts must reset the ambiguous quantity');
assert.strictEqual(lineItemTypeContext.jobItems[0].taxable, 1, 'switching to a part must retain parts-tax behavior');
assert.match(html, /onclick="handleCustVehicleAction\(\)"[^>]*id="cf-veh-btn"/, 'customer vehicle action must support adding a vehicle after customer creation');
assert.match(html, /function handleCustVehicleAction\(\)[\s\S]*?openVehModal\(customerId,null\)/, 'editing a customer must provide a direct add-vehicle path');
assert.ok(!html.includes("document.getElementById('cf-veh-toggle').style.display='none'; // hide vehicle adder on edit"), 'customer editing must not hide the add-vehicle action');
assert.match(html, /Optional — you can add a vehicle later\./, 'new-customer form must explain that vehicle information is optional');
assert.match(html, /id="ef-add-inventory"/, 'parts expenses must offer an inventory-update option');
assert.match(html, /function toggleExpenseInventoryFields\(\)/, 'expense inventory fields must use the existing inventory state');
assert.match(html, /inventory_item:inventoryItem/, 'successful expense saves must update local inventory state');
assert.match(html, /if\(payment\)upsertStateRecord\('payments',payment\)/, 'marking a job paid must add the returned payment to renderer state');
assert.match(html, /renderSafely\(renderJobs,renderDashboard,renderFinance,renderReport\)/, 'job payment creation must refresh Payments and P&L views');
assert.match(html, /upsertStateRecord\('jobs',\{\.\.\.\(existing\|\|\{\}\),\.\.\.body,\.\.\.jobResult/, 'job saves must apply the canonical server response to table state');
assert.match(html, /function fillJobMileageFromVehicle\(\)/, 'new R/Os must prefill mileage from the selected vehicle');
assert.match(html, /upsertStateRecord\('vehicles',\{\.\.\.vehicle,miles:Number\(jobResult\.vehicle_mileage\)\}\)/, 'R/O saves must apply the returned vehicle mileage to renderer state');
assert.match(html, /<th>RO #<\/th><th>Customer<\/th>/, 'Payments ledger must identify the linked repair order');
assert.match(html, /openJobModal\(\$\{safeId\(p\.job_id\)\}\)/, 'Payments ledger repair-order links must open the associated job');
assert.ok(!html.includes("'RO#'+esc(j.repair_order_number)"), 'payment job selector must not duplicate the RO prefix');
const estimatesRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'estimates.js'), 'utf8');
assert.match(estimatesRoute, /return `EST-\$\{String\(highest \+ 1\)\.padStart\(4, '0'\)\}`/, 'estimate identifiers must use the next sequential EST-#### number');
assert.match(estimatesRoute, /const createEstimate = db\.transaction/, 'estimate number selection and creation must be atomic');
assert.match(estimatesRoute, /ORDER BY e\.date DESC, e\.id DESC/, 'same-day estimates must have deterministic newest-first ordering');
assert.match(html, /function fillEstimateMileageFromVehicle\(\)/, 'new estimates must prefill mileage from the selected vehicle');
assert.match(estimatesRoute, /function advanceEstimateVehicleMileage\(vehicleId, mileage\)/, 'estimate saves must share a vehicle-mileage advancement helper');
assert.match(estimatesRoute, /advanceEstimateVehicleMileage\(current\.vehicle_id, miles \|\| 0\)/, 'estimate edits must advance vehicle mileage atomically');
assert.match(estimatesRoute, /date, miles, labor, parts, tax_rate, status/, 'estimate conversion must carry mileage and its saved tax rate into the repair order');
assert.match(html, /const wantsConversion=body\.status==='Approved'/, 'saving an approved estimate must trigger repair-order conversion');
assert.match(html, /The estimate was saved as Draft, but no repair order was created/, 'failed automatic conversion must remain retryable without an approved orphan estimate');
assert.match(html, /function openConvertedRepairOrder\(/, 'automatic and manual estimate conversion must share the repair-order opening path');
assert.match(estimatesRoute, /repairOrderNumber = `RO-\$\{String\(highestRepairOrder \+ 1\)\.padStart\(4, '0'\)\}`/, 'estimate conversion must assign the next RO-#### number');
assert.match(estimatesRoute, /INSERT INTO jobs \(customer_id, vehicle_id, employee_id, service, repair_order_number,/, 'converted estimates must persist their repair-order number');
const jobsRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'jobs.js'), 'utf8');
assert.match(jobsRoute, /function advanceVehicleMileage\(vehicleId, mileage\)/, 'R/O saves must share a vehicle-mileage advancement helper');
assert.match(jobsRoute, /\? > COALESCE\(miles, 0\)/, 'R/O mileage must never reduce stored vehicle mileage');
assert.match(jobsRoute, /advanceVehicleMileage\(current\.vehicle_id, miles \|\| 0\)/, 'R/O edits must update vehicle mileage inside the job transaction');
assert.match(jobsRoute, /function insertAutomaticJobPayment\(/, 'job Paid transitions must create a payment through the server');
assert.match(jobsRoute, /const shouldRecordPayment = invoice_status === 'Paid'/, 'Paid repair orders must reconcile a newly introduced balance');
assert.match(jobsRoute, /remainingBalance > 0/, 'automatic job payments must remain idempotent when the repair order is already fully paid');
assert.match(jobsRoute, /db\.transaction\(\(\) => \{[\s\S]*insertAutomaticJobPayment/, 'job status and automatic payment must share one transaction');
const paymentsRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'payments.js'), 'utf8');
assert.match(paymentsRoute, /LEFT JOIN jobs j ON p\.job_id = j\.id/, 'payment API must join the stable job relationship');
assert.match(paymentsRoute, /j\.repair_order_number/, 'payment API must return the linked repair-order number');

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
assert.match(plansRoute, /INSERT INTO payments[\s\S]*return \{ planId: result\.lastInsertRowid, payment \}/, 'plan and down payment must be saved in one transaction');
assert.match(plansRoute, /res\.json\(\{ \.\.\.plan, payment: saved\.payment \}\)/, 'plan creation must return its recorded down payment');

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
