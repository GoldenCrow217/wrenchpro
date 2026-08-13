const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const port = String(5200 + Math.floor(Math.random() * 500));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-installment-qa-'));
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function request(method, route, body) {
  const response = await fetch(baseUrl + route, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, ok: response.ok, body: parsed };
}

async function successful(method, route, body) {
  const result = await request(method, route, body);
  if (!result.ok) throw new Error(`${method} ${route}: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

async function createPlan(customerId, jobId, amount = 50) {
  const plan = await successful('POST', '/api/plans', {
    customer_id: customerId,
    job_id: jobId,
    description: 'QA installment plan',
    total: amount,
    installment_count: 1,
    installments: [{ due_date: '2026-08-15', amount }],
  });
  const plans = await successful('GET', '/api/plans');
  return plans.find(candidate => candidate.id === plan.id);
}

(async () => {
  let db;
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { if ((await request('GET', '/api/health')).ok) break; } catch {}
      await sleep(100);
    }
    db = new Database(path.join(dataDir, 'wrenchpro.db'));

    const customer = await successful('POST', '/api/customers', { first: 'Atomic', last: 'Payment' });
    const vehicle = await successful('POST', '/api/vehicles', { customer_id: customer.id, year: 2020, make: 'QA', model: 'Vehicle' });
    const job = await successful('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, repair_order_number: 'RO-9001', service: 'QA repair', date: '2026-08-03', labor: 50 });
    const missingJob = await request('POST', '/api/plans', { customer_id: customer.id, description: 'Missing RO', total: 50, installment_count: 1, installments: [{ due_date: '2026-08-15', amount: 50 }] });
    assert(missingJob.status === 400 && missingJob.body.field === 'job_id', 'payment plan without a repair order was not rejected');
    const plan = await createPlan(customer.id, job.id);
    assert(plan.job_id === job.id && plan.repair_order_number === 'RO-9001', 'payment plan did not return its repair order reference');
    const planPayment = await successful('POST', '/api/payments', { customer_id: customer.id, plan_id: plan.id, description: 'Plan payment', amount: 1, method: 'Cash', date: '2026-08-03' });
    assert(planPayment.job_id === job.id && planPayment.repair_order_number === 'RO-9001', 'manual plan payment did not inherit the plan repair order');
    const customPlan = await successful('POST', '/api/plans', { customer_id: customer.id, job_id: job.id, description: 'Custom amounts', total: 50, plan_type: 'custom', installment_count: 2, installments: [{ due_date: '2026-09-01', amount: 20 }, { due_date: '2026-10-01', amount: 30 }] });
    assert(customPlan.installments.length === 2 && customPlan.installments[0].amount === 20 && customPlan.installments[1].amount === 30, 'custom payment amounts were not preserved');
    const planCountBeforeInvalidCustom = db.prepare('SELECT count(*) AS n FROM payment_plans').get().n;
    const invalidCustom = await request('POST', '/api/plans', { customer_id: customer.id, job_id: job.id, description: 'Invalid custom amounts', total: 50, plan_type: 'custom', installment_count: 2, installments: [{ due_date: '2026-09-01', amount: 10 }, { due_date: '2026-10-01', amount: 30 }] });
    assert(invalidCustom.status === 400 && invalidCustom.body.field === 'installments', 'unbalanced custom payment amounts were not rejected');
    assert(db.prepare('SELECT count(*) AS n FROM payment_plans').get().n === planCountBeforeInvalidCustom, 'rejected custom plan was partially written');
    await successful('PUT', '/api/settings', { payment_grace_days: 2, late_fee: 5, require_parts_deposit: 1, parts_deposit_percent: 100 });
    const depositJob = await successful('POST', '/api/jobs', { customer_id: customer.id, vehicle_id: vehicle.id, repair_order_number: 'RO-9002', service: 'Deposit QA', date: '2026-08-03', labor: 20, parts: 50, parts_deposit_required: 54.13 });
    assert(db.prepare('SELECT parts_deposit_required FROM jobs WHERE id=?').get(depositJob.id).parts_deposit_required === 54.13, 'repair-order parts deposit was not persisted');
    const blockedStart = await request('PUT', `/api/jobs/${depositJob.id}`, { service: 'Deposit QA', repair_order_number: 'RO-9002', date: '2026-08-03', status: 'In Progress', invoice_status: 'Unpaid', parts_deposit_required: 54.13 });
    assert(blockedStart.status === 409 && blockedStart.body.field === 'parts_deposit_required', 'work began without the required parts deposit');
    await successful('POST', '/api/payments', { customer_id: customer.id, job_id: depositJob.id, description: 'Parts deposit', amount: 54.13, method: 'Cash', date: '2026-08-03' });
    await successful('PUT', `/api/jobs/${depositJob.id}`, { service: 'Deposit QA', repair_order_number: 'RO-9002', date: '2026-08-03', status: 'In Progress', invoice_status: 'Partial', parts_deposit_required: 54.13 });
    const allocationPlan = await successful('POST', '/api/plans', { customer_id: customer.id, job_id: job.id, description: 'Allocation QA', total: 40, installment_count: 2, installments: [{ due_date: '2026-08-15', amount: 20 }, { due_date: '2026-09-15', amount: 20 }] });
    const allocated = await successful('POST', '/api/payments', { customer_id: customer.id, plan_id: allocationPlan.id, description: 'Late additional payment', amount: 25, method: 'Cash', date: '2026-08-20' });
    assert(allocated.allocations.length === 1 && allocated.allocations[0].installment_id === allocationPlan.installments[0].id, 'payment was not allocated to the oldest installment first');
    assert(allocated.plan_installments[0].paid === 1 && allocated.plan_installments[0].late_fee === 5, 'late fee and completed allocation were not persisted');
    const partial = await successful('POST', '/api/payments', { customer_id: customer.id, plan_id: allocationPlan.id, description: 'Partial next payment', amount: 10, method: 'Cash', date: '2026-08-20' });
    assert(partial.plan_installments[1].amount_paid === 10 && partial.plan_installments[1].paid === 0, 'partial payment was not retained on the next installment');
    await successful('DELETE', `/api/payments/${partial.id}`);
    assert(db.prepare('SELECT amount_paid FROM installments WHERE id=?').get(allocationPlan.installments[1].id).amount_paid === 0, 'deleting an allocated payment did not reverse its allocation');
    const legacyPlanId = db.prepare("INSERT INTO payment_plans (customer_id,description,total) VALUES (?,?,?)").run(customer.id, 'Legacy QA', 30).lastInsertRowid;
    db.prepare("INSERT INTO payments (customer_id,plan_id,description,amount,method,date) VALUES (?,?,?,?,?,?)").run(customer.id, legacyPlanId, 'Legacy payment', 5, 'Cash', '2026-08-03');
    const linked = await successful('PUT', `/api/plans/${legacyPlanId}/link-job`, { job_id: job.id });
    assert(linked.job_id === job.id && db.prepare('SELECT job_id FROM payments WHERE plan_id=?').get(legacyPlanId).job_id === job.id, 'legacy plan and payments were not linked to the repair order');
    const installment = plan.installments[0];

    const paid = await successful('PUT', `/api/plans/installment/${installment.id}/pay`, { method: 'Card', date: '2026-08-03' });
    assert(paid.installment.paid === 1, 'successful request did not mark installment paid');
    assert(paid.payment.installment_id === installment.id, 'payment was not linked to installment');
    assert(paid.payment.plan_id === plan.id && paid.payment.customer_id === customer.id, 'payment references are incorrect');
    assert(paid.payment.job_id === job.id && paid.payment.repair_order_number === 'RO-9001', 'installment payment did not retain its repair order reference');
    assert(db.prepare('SELECT count(*) AS n FROM payments WHERE installment_id=?').get(installment.id).n === 1, 'successful request did not create exactly one payment');

    const repeated = await successful('PUT', `/api/plans/installment/${installment.id}/pay`, { method: 'Cash' });
    assert(repeated.already_paid === true && repeated.payment.id === paid.payment.id, 'repeat request was not idempotent');

    const doublePlan = await createPlan(customer.id, job.id, 60);
    const doubleId = doublePlan.installments[0].id;
    const doubleResults = await Promise.all([
      successful('PUT', `/api/plans/installment/${doubleId}/pay`, { method: 'Cash' }),
      successful('PUT', `/api/plans/installment/${doubleId}/pay`, { method: 'Cash' }),
    ]);
    assert(doubleResults.some(result => result.already_paid === true), 'concurrent repeat was not identified');
    assert(db.prepare('SELECT count(*) AS n FROM payments WHERE installment_id=?').get(doubleId).n === 1, 'double request created duplicate payments');

    const invalidPlan = await createPlan(customer.id, job.id, 0);
    const invalid = await request('PUT', `/api/plans/installment/${invalidPlan.installments[0].id}/pay`, {});
    assert(invalid.status === 400 && /amount/i.test(invalid.body.error), 'invalid installment amount was not rejected');

    const missing = await request('PUT', '/api/plans/installment/999999/pay', {});
    assert(missing.status === 404 && /not found/i.test(missing.body.error), 'missing installment did not return 404');

    const inconsistentPlan = await createPlan(customer.id, job.id, 70);
    const inconsistentId = inconsistentPlan.installments[0].id;
    db.prepare("UPDATE installments SET paid=1, paid_date='2026-08-03' WHERE id=?").run(inconsistentId);
    const inconsistent = await request('PUT', `/api/plans/installment/${inconsistentId}/pay`, {});
    assert(inconsistent.status === 409 && /repair/i.test(inconsistent.body.error), 'paid installment without payment did not return conflict');

    const missingPlan = await createPlan(customer.id, job.id, 75);
    const missingPlanId = missingPlan.installments[0].id;
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM payment_plans WHERE id=?').run(missingPlan.id);
    const missingPlanResult = await request('PUT', `/api/plans/installment/${missingPlanId}/pay`, {});
    assert(missingPlanResult.status === 404 && /plan/i.test(missingPlanResult.body.error), 'missing payment plan did not return 404');
    db.prepare('DELETE FROM installments WHERE id=?').run(missingPlanId);
    db.pragma('foreign_keys = ON');

    const paymentFailurePlan = await createPlan(customer.id, job.id, 80);
    const paymentFailureId = paymentFailurePlan.installments[0].id;
    db.exec(`CREATE TRIGGER qa_fail_payment BEFORE INSERT ON payments WHEN NEW.installment_id=${paymentFailureId} BEGIN SELECT RAISE(ABORT, 'injected payment failure'); END`);
    const paymentFailure = await request('PUT', `/api/plans/installment/${paymentFailureId}/pay`, {});
    db.exec('DROP TRIGGER qa_fail_payment');
    assert(paymentFailure.status === 500, 'injected payment failure did not fail request');
    assert(db.prepare('SELECT paid FROM installments WHERE id=?').get(paymentFailureId).paid === 0, 'payment failure left installment paid');
    assert(db.prepare('SELECT count(*) AS n FROM payments WHERE installment_id=?').get(paymentFailureId).n === 0, 'payment failure persisted a payment');

    const updateFailurePlan = await createPlan(customer.id, job.id, 90);
    const updateFailureId = updateFailurePlan.installments[0].id;
    db.exec(`CREATE TRIGGER qa_fail_installment BEFORE UPDATE ON installments WHEN OLD.id=${updateFailureId} BEGIN SELECT RAISE(ABORT, 'injected installment failure'); END`);
    const updateFailure = await request('PUT', `/api/plans/installment/${updateFailureId}/pay`, {});
    db.exec('DROP TRIGGER qa_fail_installment');
    assert(updateFailure.status === 500, 'injected installment failure did not fail request');
    assert(db.prepare('SELECT paid FROM installments WHERE id=?').get(updateFailureId).paid === 0, 'installment update failure changed installment');
    assert(db.prepare('SELECT count(*) AS n FROM payments WHERE installment_id=?').get(updateFailureId).n === 0, 'installment update failure did not roll back payment');

    const standalone = await successful('POST', '/api/payments', { customer_id: customer.id, description: 'Standalone QA', amount: 12, method: 'Cash', date: '2026-08-03' });
    assert(standalone.id && db.prepare('SELECT installment_id FROM payments WHERE id=?').get(standalone.id).installment_id === null, 'standalone payment behavior changed');

    assert(db.pragma('integrity_check')[0].integrity_check === 'ok', 'database integrity check failed');
    assert(db.pragma('foreign_key_check').length === 0, 'foreign-key check failed');
    const frontend = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    assert(frontend.includes('payingInstallmentIds.has(instId)'), 'frontend duplicate-click guard is missing');
    assert(frontend.includes('id="pl-job"') && frontend.includes('job_id:jobId'), 'payment-plan repair-order selection is missing');
    assert(frontend.includes('const linkedPlans=state.plans.filter(p=>p.job_id===jobId)'), 'invoice payment-plan rendering is missing');
    assert(frontend.includes('function customPlanInstallments()') && frontend.includes('Custom payment amounts'), 'custom payment amount editor is missing');
    assert(frontend.includes('function planAdditionalPayments(p)') && frontend.includes('Additional payments'), 'additional plan payment display is missing');
    assert(frontend.includes('id="jf-require-parts-deposit"') && frontend.includes('parts_deposit_required:'), 'repair-order parts deposit controls are missing');
    assert(frontend.includes('function linkLegacyPlan(planId)') && frontend.includes('/link-job'), 'legacy plan repair-order linking is missing');
    assert(frontend.includes('payment_grace_days') && frontend.includes('late_fee_due'), 'grace-period and late-fee display is missing');
    assert(!frontend.includes("api('POST','/api/payments',{customer_id:p.customer_id"), 'old two-request payment sequence remains');

    console.log('Atomic installment payment QA passed');
  } finally {
    if (db) db.close();
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  console.error(output);
  process.exit(1);
});
