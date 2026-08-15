const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
assert.ok(html.includes("fn:()=>openEstimateModal()"), 'command palette must call openEstimateModal');
assert.ok(!html.includes("fn:()=>openEstModal()"), 'obsolete estimate command remains');
assert.ok(html.includes('void initializeApp();'), 'startup must use the guarded initializer');
assert.ok(mainSource.includes('http://127.0.0.1:${port}/api/health'), 'readiness check must use IPv4');
assert.ok(mainSource.includes('http://127.0.0.1:${port}'), 'renderer URL must use IPv4');
assert.ok(mainSource.includes('requestSingleInstanceLock()'), 'Electron must prevent concurrent desktop instances');

const dashboardStart = html.indexOf('function dashboardJobTotal(');
const dashboardEnd = html.indexOf('\nfunction dashboardMetrics(', dashboardStart);
const planStart = html.indexOf('function planAdditionalPayments(');
const planEnd = html.indexOf('\nfunction renderPlans(', planStart);
const reportStart = html.indexOf('function reportMetrics(');
const reportEnd = html.indexOf('\nfunction renderReport(', reportStart);
assert.ok(dashboardStart >= 0 && dashboardEnd > dashboardStart && planStart >= 0 && planEnd > planStart && reportStart >= 0 && reportEnd > reportStart);
const reportContext = { state: { payments: [] }, Math, Number, Array, String, Set };
vm.runInNewContext(`${html.slice(dashboardStart, dashboardEnd)}${html.slice(planStart, planEnd)}${html.slice(reportStart, reportEnd)};globalThis.qa=reportMetrics;`, reportContext);
const report = reportContext.qa({
  settings: { tax_rate: 10 },
  jobs: [
    { id: 1, first: 'Ada', last: 'Lovelace', repair_order_number: 'RO-1001', labor: 100, parts: 50, travel_fee: 10, invoice_status: 'Paid', status: 'Complete' },
    { id: 2, first: 'Grace', last: 'Hopper', repair_order_number: 'RO-1002', labor: 80, parts: 0, travel_fee: 0, invoice_status: 'Unpaid', status: 'Complete' },
  ],
  payments: [{ id: 1, job_id: 1, amount: 165, method: 'Card', date: '2026-08-12' }],
  expenses: [{ amount: 20, category: 'Fuel', date: '2026-08-12' }],
  plans: [{ id: 1, first: 'Legacy', last: 'Plan', description: 'Old plan', total: 40, down_payment: 0, installments: [] }],
}, '2026-08');
assert.ok(Math.abs(report.income.labor - 100) < 0.001);
assert.ok(Math.abs(report.income.parts - 50) < 0.001);
assert.ok(Math.abs(report.income.tax - 5) < 0.001);
assert.ok(Math.abs(report.income.fees - 10) < 0.001);
assert.strictEqual(report.totalReceived, 165);
assert.strictEqual(report.totalIncome, 160, 'sales tax must not be counted as operating income');
assert.strictEqual(report.net, 140);
assert.strictEqual(report.totalOutstanding, 120, 'unpaid repair orders and unlinked legacy plans must both be included');

const port = String(6600 + Math.floor(Math.random() * 300));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-corrections-'));
const child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
  cwd: root,
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const url = route => `http://127.0.0.1:${port}${route}`;

async function request(method, route, body) {
  const response = await fetch(url(route), {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function successful(method, route, body) {
  const result = await request(method, route, body);
  assert.ok(result.status < 400, `${method} ${route}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

async function rejected(method, route, body, field, status = 400) {
  const result = await request(method, route, body);
  assert.strictEqual(result.status, status, `${method} ${route}: ${JSON.stringify(result.body)}`);
  if (field) assert.strictEqual(result.body.field, field);
  return result.body;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try { if ((await fetch(url('/api/health'))).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Server did not start:\n${output}`);
}

async function main() {
  await waitForServer();
  const customer = await successful('POST', '/api/customers', { first: 'Reliability', last: 'QA' });
  const vehicle = await successful('POST', '/api/vehicles', { customer_id: customer.id, year: 2020, make: 'Test', model: 'Car', miles: 100 });
  const job = await successful('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-12', service: 'Automatic number', labor: 100 });
  assert.match(job.repair_order_number, /^RO-\d{4,}$/);
  await rejected('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-12', repair_order_number: job.repair_order_number }, 'repair_order_number', 409);
  await rejected('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-12', items: [{ qty: -1, rate: 1, amount: -1 }] }, 'qty');
  await rejected('POST', '/api/estimates', { customer_id: customer.id, date: '2026-08-12', items: [{ qty: 1, rate: -1, amount: -1 }] }, 'rate');
  await rejected('POST', '/api/expenses', { date: '2026-08-12', description: 'Invalid', category: 'Fuel', amount: -1 }, 'amount');
  await rejected('PUT', '/api/settings', { tax_rate: 101 }, 'tax_rate');
  await rejected('POST', '/api/vehicles', { customer_id: customer.id, miles: -1 }, 'miles');
  await rejected('POST', '/api/catalog', { name: 'Invalid service', default_hours: -1 }, 'default_hours');
  await rejected('POST', '/api/employees', { first: 'Bad', last: 'Rate', hourly_rate: -1 }, 'hourly_rate');
  await rejected('POST', '/api/plans', { customer_id: customer.id, job_id: job.id, total: 100, down_payment: 101, installment_count: 1 }, 'down_payment');

  const payment = await successful('POST', '/api/payments', { customer_id: customer.id, job_id: job.id, amount: 10, date: '2026-08-12' });
  await rejected('PUT', `/api/payments/${payment.id}`, { amount: -10, date: '2026-08-12' }, 'amount');

  const warranty = await successful('POST', '/api/warranties', { customer_id: customer.id, vehicle_id: vehicle.id, labor_months: 0, parts_months: 0, mileage_limit: 0, start_date: '2026-01-31' });
  assert.strictEqual(warranty.labor_months, 0);
  assert.strictEqual(warranty.mileage_limit, 0);
  assert.strictEqual(warranty.expires_date, '2026-01-31');
  const warrantyUpdate = await successful('PUT', `/api/warranties/${warranty.id}`, { labor_months: 1, parts_months: 0, mileage_limit: 0, start_date: '2026-01-31' });
  assert.strictEqual(warrantyUpdate.expires_date, '2026-02-28');

  const referencedPart = await successful('POST', '/api/inventory', { name: 'Referenced part', cost: 5, retail_price: 10, quantity: 2 });
  await successful('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-12', items: [{ type: 'part', description: 'Referenced part', qty: 1, rate: 10, amount: 10, inventory_id: referencedPart.id }] });
  const blockedDelete = await rejected('DELETE', `/api/inventory/${referencedPart.id}`, undefined, 'id', 409);
  assert.match(blockedDelete.error, /existing repair order or estimate/i);
  const unusedPart = await successful('POST', '/api/inventory', { name: 'Unused part' });
  await successful('DELETE', `/api/inventory/${unusedPart.id}`);

  console.log('Reliability corrections QA passed');
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  console.error(output);
  process.exitCode = 1;
}).finally(() => child.kill());
