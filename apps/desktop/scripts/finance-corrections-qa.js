const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-finance-corrections-qa-'));
const port = String(5700 + Math.floor(Math.random() * 200));
const baseUrl = `http://127.0.0.1:${port}`;
let child;
let output = '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function requestRaw(method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, ok: response.ok, body: parsed, text };
}
async function request(method, route, body) {
  const result = await requestRaw(method, route, body);
  if (!result.ok) throw new Error(`${method} ${route}: HTTP ${result.status} ${result.text}`);
  return result.body;
}
async function startServer() {
  child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  for (let attempt = 0; attempt < 75; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try { if ((await request('GET', '/api/health')).ok) return; } catch { await sleep(100); }
  }
  throw new Error(`Server did not start:\n${output}`);
}
async function stopServer() {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
}

(async () => {
  try {
    await startServer();
    await request('PUT', '/api/settings', { tax_rate: 10, late_fee: 5, payment_grace_days: 0 });
    const customer = await request('POST', '/api/customers', { first: 'Finance', last: 'QA' });
    const vehicle = await request('POST', '/api/vehicles', { customer_id: customer.id, year: 2024, make: 'Test', model: 'Car' });

    const part = await request('POST', '/api/inventory', { name: 'Weighted Part', cost: 5, retail_price: 8, quantity: 10, reorder_qty: 0 });
    const restock = await request('POST', '/api/expenses', {
      date: '2026-08-01', description: 'Restock', category: 'Parts & supplies', amount: 10,
      inventory: { id: part.id, name: part.name, cost: 10, retail_price: 15, quantity: 1 },
    });
    assert.ok(Math.abs(restock.inventory_item.cost - (60 / 11)) < 1e-9, 'Expense restock did not preserve weighted-average inventory cost');
    assert.strictEqual(restock.inventory_item.quantity, 11, 'Expense restock quantity is incorrect');

    const job = await request('POST', '/api/jobs', {
      customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-02',
      items: [{ type: 'part', description: 'Weighted Part', qty: 2, rate: 50, inventory_id: part.id }],
    });
    assert.strictEqual(job.service, 'Weighted Part', 'Job with line items but no service text did not derive its visible Service column');
    assert.deepStrictEqual(job.inventory_updates, [{ id: part.id, quantity: 9 }], 'Job creation did not return its committed inventory quantity');
    assert.strictEqual((await request('GET', '/api/inventory')).find(item => item.id === part.id).quantity, 9, 'Direct job creation did not deduct inventory');
    const editedJob = await request('PUT', `/api/jobs/${job.id}`, {
      ...job, date: '2026-08-02', items: [{ type: 'part', description: 'Weighted Part', qty: 3, rate: 50, inventory_id: part.id }],
    });
    assert.strictEqual(editedJob.items[0].qty, 3, 'Edited job item quantity was not saved');
    assert.deepStrictEqual(editedJob.inventory_updates, [{ id: part.id, quantity: 8 }], 'Job edit did not return its committed inventory quantity');
    assert.strictEqual((await request('GET', '/api/inventory')).find(item => item.id === part.id).quantity, 8, 'Job edit did not deduct only the inventory delta');
    const laborJob = await request('PUT', `/api/jobs/${job.id}`, {
      ...editedJob, items: [{ type: 'labor', description: 'No longer a part', qty: 1, rate: 50, inventory_id: part.id }],
    });
    assert.strictEqual(laborJob.items[0].inventory_id, null, 'Server retained an inventory link on a non-part line');
    assert.deepStrictEqual(laborJob.inventory_updates, [{ id: part.id, quantity: 11 }], 'Changing an inventory part to labor did not restore stock');
    const restoredPartJob = await request('PUT', `/api/jobs/${job.id}`, {
      ...laborJob, items: [{ type: 'part', description: 'Weighted Part', qty: 3, rate: 50, inventory_id: part.id }],
    });
    assert.deepStrictEqual(restoredPartJob.inventory_updates, [{ id: part.id, quantity: 8 }], 'Changing labor back to an inventory part did not reapply stock usage');
    const deletedJob = await request('DELETE', `/api/jobs/${job.id}`);
    assert.deepStrictEqual(deletedJob.inventory_updates, [{ id: part.id, quantity: 11 }], 'Job deletion did not return its restored inventory quantity');
    assert.strictEqual((await request('GET', '/api/inventory')).find(item => item.id === part.id).quantity, 11, 'Deleting an unpaid job did not restore inventory');
    const insufficient = await requestRaw('POST', '/api/jobs', {
      customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-02',
      items: [{ type: 'part', description: 'Too many', qty: 12, rate: 50, inventory_id: part.id }],
    });
    assert.strictEqual(insufficient.status, 409, 'Insufficient direct-job inventory must be rejected');
    assert.strictEqual((await request('GET', '/api/inventory')).find(item => item.id === part.id).quantity, 11, 'Rejected job changed inventory quantity');

    const paidJob = await request('POST', '/api/jobs', {
      customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-03', status: 'Complete',
      items: [{ type: 'labor', description: 'Labor', qty: 1, rate: 100 }, { type: 'part', description: 'Part', qty: 1, rate: 100 }],
    });
    await request('POST', '/api/payments', { customer_id: customer.id, job_id: paidJob.id, amount: 210, date: '2026-08-03' });
    const dashboard = await request('GET', '/api/dashboard');
    assert.strictEqual(dashboard.totalReceived, 210, 'Dashboard cash received is incorrect');
    assert.strictEqual(dashboard.totalRevenue, 200, 'Dashboard operating revenue must exclude sales tax');
    assert.strictEqual(dashboard.netProfit, 190, 'Dashboard net profit must exclude sales tax and subtract expenses');
    const blockedDelete = await requestRaw('DELETE', `/api/jobs/${paidJob.id}`);
    assert.strictEqual(blockedDelete.status, 409, 'A repair order with payments must not be deletable');

    const canceledJob = await request('POST', '/api/jobs', {
      customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-04', status: 'Canceled', items: [{ type: 'labor', qty: 1, rate: 40 }],
    });
    await request('POST', '/api/payments', { customer_id: customer.id, job_id: canceledJob.id, amount: 40, date: '2026-08-04' });
    assert.strictEqual((await request('GET', '/api/dashboard')).totalRevenue, 200, 'Canceled repair-order receipts must not become operating revenue');

    const planJob = await request('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-05', items: [{ type: 'labor', qty: 1, rate: 100 }] });
    const plan = await request('POST', '/api/plans', {
      customer_id: customer.id, job_id: planJob.id, total: 100, down_payment: 0, installment_count: 2, start_date: '2026-07-01',
      installments: [{ due_date: '2026-07-01', amount: 50 }, { due_date: '2026-08-01', amount: 50 }],
    });
    const paidInstallment = await request('PUT', `/api/plans/installment/${plan.installments[0].id}/pay`, { date: '2026-08-06', method: 'Card' });
    assert.strictEqual(paidInstallment.payment.late_fee_amount, 5, 'Installment payment did not identify its late-fee amount');
    const blockedEdit = await requestRaw('PUT', `/api/payments/${paidInstallment.payment.id}`, { amount: 10, date: '2026-08-06' });
    assert.strictEqual(blockedEdit.status, 409, 'Installment-generated payments must not be independently editable');

    const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
    assert.match(html, /e\.tax_rate\?\?state\.settings\.tax_rate/, 'Estimate editing must preserve an intentional zero tax rate');
    assert.match(html, /inventory_id:i\.inventory_id\|\|null/, 'Estimate editing must preserve inventory links');
    assert.match(html, /Est\. wage cost/, 'Time tracking must label employee wage cost correctly');
    assert.match(html, /Balance due/, 'Invoices must display a balance due');
    const planStart = html.indexOf('function planBalance(');
    const planEnd = html.indexOf('function planOverdue(', planStart);
    const planContext = { state: { payments: [] } };
    vm.runInNewContext(`${html.slice(planStart, planEnd)};globalThis.planBalance=planBalance;`, planContext);
    assert.strictEqual(planContext.planBalance({ total: 100, installments: [
      { amount: 50, amount_paid: 55, late_fee: 5 }, { amount: 50, amount_paid: 0, late_fee: 0 },
    ] }), 50, 'A paid late fee must not reduce remaining principal');
    const helperStart = html.indexOf('function addDays(');
    const helperEnd = html.indexOf('//', html.indexOf('function addCalendarMonths(', helperStart));
    const context = {};
    vm.runInNewContext(`${html.slice(helperStart, helperEnd)};globalThis.addCalendarMonths=addCalendarMonths;`, context);
    assert.strictEqual(context.addCalendarMonths('2026-01-31', 1), '2026-02-28', 'Monthly schedules must advance by calendar month');

    console.log('Finance corrections QA passed');
  } finally {
    await stopServer();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
