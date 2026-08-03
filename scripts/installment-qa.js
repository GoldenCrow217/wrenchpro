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

async function createPlan(customerId, amount = 50) {
  const plan = await successful('POST', '/api/plans', {
    customer_id: customerId,
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
    const plan = await createPlan(customer.id);
    const installment = plan.installments[0];

    const paid = await successful('PUT', `/api/plans/installment/${installment.id}/pay`, { method: 'Card', date: '2026-08-03' });
    assert(paid.installment.paid === 1, 'successful request did not mark installment paid');
    assert(paid.payment.installment_id === installment.id, 'payment was not linked to installment');
    assert(paid.payment.plan_id === plan.id && paid.payment.customer_id === customer.id, 'payment references are incorrect');
    assert(db.prepare('SELECT count(*) AS n FROM payments WHERE installment_id=?').get(installment.id).n === 1, 'successful request did not create exactly one payment');

    const repeated = await successful('PUT', `/api/plans/installment/${installment.id}/pay`, { method: 'Cash' });
    assert(repeated.already_paid === true && repeated.payment.id === paid.payment.id, 'repeat request was not idempotent');

    const doublePlan = await createPlan(customer.id, 60);
    const doubleId = doublePlan.installments[0].id;
    const doubleResults = await Promise.all([
      successful('PUT', `/api/plans/installment/${doubleId}/pay`, { method: 'Cash' }),
      successful('PUT', `/api/plans/installment/${doubleId}/pay`, { method: 'Cash' }),
    ]);
    assert(doubleResults.some(result => result.already_paid === true), 'concurrent repeat was not identified');
    assert(db.prepare('SELECT count(*) AS n FROM payments WHERE installment_id=?').get(doubleId).n === 1, 'double request created duplicate payments');

    const invalidPlan = await createPlan(customer.id, 0);
    const invalid = await request('PUT', `/api/plans/installment/${invalidPlan.installments[0].id}/pay`, {});
    assert(invalid.status === 400 && /amount/i.test(invalid.body.error), 'invalid installment amount was not rejected');

    const missing = await request('PUT', '/api/plans/installment/999999/pay', {});
    assert(missing.status === 404 && /not found/i.test(missing.body.error), 'missing installment did not return 404');

    const inconsistentPlan = await createPlan(customer.id, 70);
    const inconsistentId = inconsistentPlan.installments[0].id;
    db.prepare("UPDATE installments SET paid=1, paid_date='2026-08-03' WHERE id=?").run(inconsistentId);
    const inconsistent = await request('PUT', `/api/plans/installment/${inconsistentId}/pay`, {});
    assert(inconsistent.status === 409 && /repair/i.test(inconsistent.body.error), 'paid installment without payment did not return conflict');

    const missingPlan = await createPlan(customer.id, 75);
    const missingPlanId = missingPlan.installments[0].id;
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM payment_plans WHERE id=?').run(missingPlan.id);
    const missingPlanResult = await request('PUT', `/api/plans/installment/${missingPlanId}/pay`, {});
    assert(missingPlanResult.status === 404 && /plan/i.test(missingPlanResult.body.error), 'missing payment plan did not return 404');
    db.prepare('DELETE FROM installments WHERE id=?').run(missingPlanId);
    db.pragma('foreign_keys = ON');

    const paymentFailurePlan = await createPlan(customer.id, 80);
    const paymentFailureId = paymentFailurePlan.installments[0].id;
    db.exec(`CREATE TRIGGER qa_fail_payment BEFORE INSERT ON payments WHEN NEW.installment_id=${paymentFailureId} BEGIN SELECT RAISE(ABORT, 'injected payment failure'); END`);
    const paymentFailure = await request('PUT', `/api/plans/installment/${paymentFailureId}/pay`, {});
    db.exec('DROP TRIGGER qa_fail_payment');
    assert(paymentFailure.status === 500, 'injected payment failure did not fail request');
    assert(db.prepare('SELECT paid FROM installments WHERE id=?').get(paymentFailureId).paid === 0, 'payment failure left installment paid');
    assert(db.prepare('SELECT count(*) AS n FROM payments WHERE installment_id=?').get(paymentFailureId).n === 0, 'payment failure persisted a payment');

    const updateFailurePlan = await createPlan(customer.id, 90);
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
