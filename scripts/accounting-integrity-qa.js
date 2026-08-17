const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-accounting-qa-'));
const port = String(5400 + Math.floor(Math.random() * 300));
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
  output = '';
  child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    cwd: path.join(__dirname, '..'),
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
    await request('PUT', '/api/settings', { tax_rate: 8.25, default_pay_method: 'Card' });
    const customer = await request('POST', '/api/customers', { first: 'History', last: 'Keeper', phone: '555-0100' });
    const vehicle = await request('POST', '/api/vehicles', { customer_id: customer.id, year: 2022, make: 'Ford', model: 'Transit' });
    const employee = await request('POST', '/api/employees', { first: 'Time', last: 'Keeper', hourly_rate: 25 });

    const quickDb = new Database(path.join(dataDir, 'wrenchpro.db'));
    quickDb.exec(`CREATE TRIGGER qa_fail_quick_payment BEFORE INSERT ON payments WHEN NEW.note='Quick Entry payment' BEGIN SELECT RAISE(ABORT, 'injected quick-entry failure'); END`);
    const failedQuick = await requestRaw('POST', '/api/quick-entry', {
      first: 'Atomic', last: 'Quick', make: 'Toyota', model: 'Camry', service: 'Historical service', date: '2026-08-12',
      labor: 100, parts: 25, amount_paid: 50, payment_date: '2026-08-12',
    });
    quickDb.exec('DROP TRIGGER qa_fail_quick_payment');
    assert.strictEqual(failedQuick.status, 500, 'Injected Quick Entry payment failure must fail the whole request');
    assert.strictEqual(quickDb.prepare("SELECT COUNT(*) count FROM customers WHERE first='Atomic' AND last='Quick'").get().count, 0, 'Failed Quick Entry left an orphan customer');
    assert.strictEqual(quickDb.prepare("SELECT COUNT(*) count FROM vehicles WHERE make='Toyota' AND model='Camry'").get().count, 0, 'Failed Quick Entry left an orphan vehicle');
    assert.strictEqual(quickDb.prepare("SELECT COUNT(*) count FROM jobs WHERE service='Historical service'").get().count, 0, 'Failed Quick Entry left an orphan repair order');
    const quick = await request('POST', '/api/quick-entry', {
      first: 'Atomic', last: 'Quick', make: 'Toyota', model: 'Camry', service: 'Historical service', date: '2026-08-12',
      labor: 100, parts: 25, amount_paid: 50, payment_date: '2026-08-12', payment_method: 'Card',
    });
    assert.ok(quick.customer.id && quick.vehicle.id && quick.job.id && quick.payment.id, 'Successful Quick Entry did not return every saved record');
    assert.strictEqual(quick.job.invoice_status, 'Partial', 'Quick Entry payment did not reconcile the repair-order status');
    quickDb.close();

    const invalidItems = await requestRaw('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-12', items: [null] });
    assert.strictEqual(invalidItems.status, 400, 'Null job items must return HTTP 400');
    const job = await request('POST', '/api/jobs', {
      customer_id: customer.id, vehicle_id: vehicle.id, employee_id: employee.id, date: '2026-08-12', status: 'Complete',
      items: [
        { type: 'part', description: 'Part', qty: 2, rate: 10, amount: 1, taxable: 0 },
        { type: 'diagnostic', description: 'Diagnostic', qty: 1, rate: 50, amount: 999, taxable: 1 },
      ],
    });
    assert.strictEqual(job.parts, 20, 'Job parts must be derived from quantity times rate');
    assert.strictEqual(job.labor, 50, 'Diagnostic work must remain non-taxable labor');
    assert.deepStrictEqual(job.items.map(item => [item.amount, item.taxable]), [[20, 1], [50, 0]], 'Stored job amounts and tax flags must be server-derived');

    const estimate = await request('POST', '/api/estimates', {
      customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-12', tax_rate: 8.25,
      items: [{ type: 'parts', description: 'Estimate part', qty: 3, rate: 12.5, amount: 1 }],
    });
    assert.strictEqual(estimate.items[0].amount, 37.5, 'Estimate line amount must be server-derived');
    assert.strictEqual(estimate.total, 40.59, 'Estimate total must use the derived line amount');

    const payment = await request('POST', '/api/payments', { customer_id: customer.id, job_id: job.id, amount: 30, date: '2026-08-12' });
    assert.strictEqual(payment.job_invoice_status, 'Partial', 'A partial payment must set the repair order to Partial');
    const editedPayment = await request('PUT', `/api/payments/${payment.id}`, { amount: 80, date: '2026-08-12' });
    assert.strictEqual(editedPayment.job_invoice_status, 'Paid', 'Increasing payment beyond the balance must set the repair order to Paid');
    const deletedPayment = await request('DELETE', `/api/payments/${payment.id}`);
    assert.strictEqual(deletedPayment.job_invoice_status, 'Unpaid', 'Deleting the only payment must reopen the repair-order balance');

    const validTime = await request('POST', '/api/time', { employee_id: employee.id, job_id: job.id, clock_in: '2026-08-12T09:00', clock_out: '2026-08-12T10:00' });
    assert.ok(validTime.id, 'Valid time log was not created');
    assert.strictEqual((await requestRaw('POST', '/api/time', { employee_id: employee.id, clock_in: 'bad-date' })).status, 400, 'Malformed time must return HTTP 400');
    assert.strictEqual((await requestRaw('POST', '/api/time', { employee_id: employee.id, clock_in: '2026-02-30T10:00' })).status, 400, 'Impossible calendar datetime must return HTTP 400');
    assert.strictEqual((await requestRaw('POST', '/api/time', { employee_id: employee.id, clock_in: '2026-08-12T10:00', clock_out: '2026-08-12T09:00' })).status, 400, 'Clock-out before clock-in must return HTTP 400');
    await request('DELETE', `/api/employees/${employee.id}`);
    assert.ok(!(await request('GET', '/api/employees')).some(row => row.id === employee.id), 'Archived employee remained selectable');
    assert.ok((await request('GET', '/api/time')).some(row => row.id === validTime.id), 'Archiving an employee removed historical time');
    assert.strictEqual((await request('GET', '/api/jobs')).find(row => row.id === job.id).employee_id, employee.id, 'Archiving an employee removed a closed job assignment');

    const planJob = await request('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-12', items: [{ type: 'labor', qty: 1, rate: 100 }] });
    const db = new Database(path.join(dataDir, 'wrenchpro.db'));
    db.exec(`CREATE TRIGGER qa_fail_down_payment BEFORE INSERT ON payments WHEN NEW.job_id=${planJob.id} BEGIN SELECT RAISE(ABORT, 'injected down-payment failure'); END`);
    const failedPlan = await requestRaw('POST', '/api/plans', {
      customer_id: customer.id, job_id: planJob.id, total: 100, down_payment: 20, down_payment_date: '2026-08-12', installment_count: 2,
      installments: [{ due_date: '2026-09-01', amount: 40 }, { due_date: '2026-10-01', amount: 40 }],
    });
    db.exec('DROP TRIGGER qa_fail_down_payment');
    assert.strictEqual(failedPlan.status, 500, 'Injected down-payment failure must fail plan creation');
    assert.strictEqual(db.prepare('SELECT COUNT(*) count FROM payment_plans WHERE job_id=?').get(planJob.id).count, 0, 'Failed down payment left a partial plan');
    const plan = await request('POST', '/api/plans', {
      customer_id: customer.id, job_id: planJob.id, description: 'Atomic plan', total: 100, down_payment: 20,
      down_payment_method: 'Card', down_payment_date: '2026-08-12', installment_count: 2,
      installments: [{ due_date: '2026-09-01', amount: 40 }, { due_date: '2026-10-01', amount: 40 }],
    });
    assert.ok(plan.payment?.id && plan.payment.amount === 20, 'Plan response must include its atomic down payment');
    const blockedDownPaymentDelete = await requestRaw('DELETE', `/api/payments/${plan.payment.id}`);
    assert.strictEqual(blockedDownPaymentDelete.status, 409, 'Plan down payments must not be separately deleted');
    assert.match(blockedDownPaymentDelete.body.error, /delete the payment plan first/i, 'Blocked down-payment deletion must explain the safe correction path');
    const paidPlan = await request('POST', '/api/plans', {
      customer_id: customer.id, job_id: planJob.id, total: 25, down_payment: 25, down_payment_date: '2026-08-12', installment_count: 0, installments: [],
    });
    assert.strictEqual(paidPlan.installments.length, 0, 'A fully paid plan must not create zero-dollar installments');

    const archivedCorrection = await request('POST', '/api/payments', { customer_id: customer.id, description: 'Archived customer correction', amount: 7, date: '2026-08-12' });
    const revenueBeforeArchive = (await request('GET', '/api/dashboard')).totalRevenue;
    await request('DELETE', `/api/customers/${customer.id}`);
    assert.ok(!(await request('GET', '/api/customers')).some(row => row.id === customer.id), 'Archived customer remained selectable');
    const archivedJob = (await request('GET', '/api/jobs')).find(row => row.id === job.id);
    assert.ok(archivedJob, 'Archived customer hid historical repair orders');
    assert.strictEqual(archivedJob.customer_phone, '555-0100', 'Archived repair order lost its invoice customer details');
    const correctedArchivedJob = await request('PUT', `/api/jobs/${job.id}`, { ...archivedJob, notes: 'Historical correction', items: archivedJob.items });
    assert.strictEqual(correctedArchivedJob.notes, 'Historical correction', 'A visible archived-customer repair order could not be corrected');
    assert.strictEqual(correctedArchivedJob.employee_id, employee.id, 'Correcting a historical repair order discarded its archived employee assignment');
    assert.ok((await request('GET', '/api/estimates')).some(row => row.id === estimate.id), 'Archived customer hid historical estimates');
    assert.ok((await request('GET', '/api/payments')).some(row => row.id === plan.payment.id), 'Archived customer hid historical payments');
    assert.ok((await request('GET', '/api/plans')).some(row => row.id === plan.id), 'Archived customer hid historical plans');
    const dashboardAfterArchive = await request('GET', '/api/dashboard');
    assert.strictEqual(dashboardAfterArchive.totalRevenue, revenueBeforeArchive, 'Archiving a customer changed historical revenue');
    assert.ok(dashboardAfterArchive.recentPayments.some(row => row.id === plan.payment.id), 'Archiving a customer hid recent payment history');
    const deletedArchivedPayment = await request('DELETE', `/api/payments/${archivedCorrection.id}`);
    assert.strictEqual(deletedArchivedPayment.success, true, 'A visible payment for an archived customer could not be deleted');
    assert.ok(!(await request('GET', '/api/payments')).some(row => row.id === archivedCorrection.id), 'Deleted archived-customer payment remained in the ledger');

    db.prepare("UPDATE jobs SET tax_rate=NULL, labor_hours=0, labor_rate=0, repair_order_number='', service='' WHERE id=?").run(job.id);
    db.close();
    await stopServer();
    await startServer();
    const migratedJob = (await request('GET', '/api/jobs')).find(row => row.id === job.id);
    assert.strictEqual(migratedJob.tax_rate, 8.25, 'Legacy closed job did not receive a frozen tax-rate snapshot');
    assert.match(migratedJob.repair_order_number, /^RO-\d{4,}$/, 'Legacy blank repair order did not receive an RO-#### backfill');
    assert.strictEqual(migratedJob.service, 'Part, Diagnostic', 'Legacy blank job service was not derived from its saved line-item descriptions');
    assert.strictEqual(migratedJob.labor_hours, 1, 'Existing line-item job did not receive its labor-hours backfill');
    assert.strictEqual(migratedJob.labor_rate, 50, 'Existing line-item job did not receive its effective labor-rate backfill');

    console.log('Accounting and historical-integrity QA passed');
  } finally {
    await stopServer();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
