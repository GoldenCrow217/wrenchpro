const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, resolveShopId } = require('../tenant');
const { fail, finiteNumber, positiveId, isoDate } = require('../validation');
const { localDateKey } = require('../business-date');
const { reconcileJobInvoiceStatus } = require('../job-finance');

function validatePlan(res, body) {
  if (!positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  if (!positiveId(res, body.job_id, 'job_id', { required: true })) return false;
  if (!finiteNumber(res, body, 'total', { required: true, label: 'Total' })) return false;
  if (!finiteNumber(res, body, 'down_payment', { label: 'Down payment' })) return false;
  if (!finiteNumber(res, body, 'installment_count', { label: 'Installment count' })) return false;
  if (Number(body.total) <= 0) return fail(res, 'total', 'Total must be greater than zero');
  if (Number(body.down_payment || 0) < 0) return fail(res, 'down_payment', 'Down payment cannot be negative');
  if (Number(body.down_payment || 0) > Number(body.total)) return fail(res, 'down_payment', 'Down payment cannot exceed the plan total');
  if (!Number.isInteger(Number(body.installment_count)) || Number(body.installment_count) < 0) return fail(res, 'installment_count', 'Installment count must be a non-negative whole number');
  if (!isoDate(res, body, 'start_date', { label: 'Start date' })) return false;
  if (!isoDate(res, body, 'down_payment_date', { label: 'Down-payment date' })) return false;
  if (body.installments !== undefined && !Array.isArray(body.installments)) return fail(res, 'installments', 'Installments must be an array');
  for (const installment of body.installments || []) {
    if (!isoDate(res, installment, 'due_date', { required: true, label: 'Installment due date' })) return false;
    if (!finiteNumber(res, installment, 'amount', { required: true, label: 'Installment amount' })) return false;
  }
  const installments = body.installments || [];
  const financedCents = Math.round((body.total - (body.down_payment || 0)) * 100);
  if (financedCents > 0) {
    if (Number(body.installment_count) <= 0) return fail(res, 'installment_count', 'Installment count must be greater than zero when a balance remains');
    if (installments.length !== body.installment_count) return fail(res, 'installments', 'Enter each scheduled payment');
    if (installments.some(installment => installment.amount <= 0)) return fail(res, 'installments', 'Installment amounts must be greater than zero');
    const scheduledCents = Math.round(installments.reduce((sum, installment) => sum + installment.amount, 0) * 100);
    if (scheduledCents !== financedCents) return fail(res, 'installments', 'Scheduled payment amounts must equal the balance after the down payment');
  } else if (installments.length || Number(body.installment_count) !== 0) {
    return fail(res, 'installments', 'A fully paid plan cannot have additional scheduled payments');
  }
  return true;
}

function paymentSettings(req) {
  const shopId = resolveShopId(req);
  return (shopId ? db.prepare('SELECT payment_grace_days, late_fee, default_pay_method, tax_rate FROM shop_settings WHERE shop_id = ?').get(shopId) : null)
    || db.prepare('SELECT payment_grace_days, late_fee, default_pay_method, tax_rate FROM settings WHERE id = 1').get()
    || {};
}

function isPastGrace(dueDate, paymentDate, graceDays) {
  if (!dueDate || !paymentDate) return false;
  const cutoff = new Date(`${dueDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + Math.max(0, Number(graceDays) || 0));
  return paymentDate > cutoff.toISOString().slice(0, 10);
}

router.get('/', (req, res) => {
  const settings = paymentSettings(req);
  const tenant = customerTenantWhere(req, 'c');
  const plans = db.prepare(`
    SELECT pp.*, c.first, c.last, j.repair_order_number,
           COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.plan_id=pp.id),0) AS paid_total
    FROM payment_plans pp
    JOIN customers c ON pp.customer_id = c.id
    LEFT JOIN jobs j ON pp.job_id = j.id AND j.deleted_at IS NULL
    WHERE ${tenant.clause}
    ORDER BY pp.created_at DESC
  `).all(...tenant.values);
  plans.forEach(p => {
    p.installments = db.prepare('SELECT * FROM installments WHERE plan_id = ? ORDER BY due_date').all(p.id);
    p.grace_days = Number(settings.payment_grace_days) || 0;
    p.installments.forEach(inst => { inst.late_fee_due = !inst.paid && isPastGrace(inst.due_date, localDateKey(), p.grace_days) ? Number(inst.late_fee || settings.late_fee) || 0 : Number(inst.late_fee) || 0; });
  });
  res.json(plans);
});

router.post('/', (req, res) => {
  if (!validatePlan(res, req.body)) return;
  const { customer_id, job_id, description, total, down_payment, down_payment_method, down_payment_date, plan_type, installment_count, frequency, start_date, notes, installments } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id, c.first, c.last FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);

  const job = db.prepare('SELECT id, repair_order_number FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(job_id, customer_id);
  if (!job) return fail(res, 'job_id', 'Repair order not found or does not belong to this customer', 404);

  const insertPlan = db.prepare(`
    INSERT INTO payment_plans (customer_id, job_id, description, total, down_payment, plan_type, installment_count, frequency, start_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInst = db.prepare('INSERT INTO installments (plan_id, due_date, amount, paid) VALUES (?, ?, ?, ?)');

  const saved = db.transaction(() => {
    const result = insertPlan.run(customer_id, job_id || null, description, total, down_payment || 0, plan_type || 'installments', installment_count ?? 4, frequency || 'monthly', start_date, notes || '');
    if (installments && installments.length) {
      installments.forEach(inst => insertInst.run(result.lastInsertRowid, inst.due_date, inst.amount, 0));
    }
    let payment = null;
    if (Number(down_payment) > 0) {
      const settings = paymentSettings(req);
      const paymentResult = db.prepare(`
        INSERT INTO payments (customer_id, plan_id, job_id, description, amount, method, date, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(customer_id, result.lastInsertRowid, job_id, `${description || 'Plan'} — down payment`, down_payment, down_payment_method || settings.default_pay_method || 'Cash', down_payment_date || localDateKey(), 'Down payment');
      const jobInvoiceStatus = reconcileJobInvoiceStatus(db, job_id, Number(settings.tax_rate) || 0);
      payment = db.prepare('SELECT * FROM payments WHERE id=?').get(paymentResult.lastInsertRowid);
      payment.job_invoice_status = jobInvoiceStatus;
    }
    return { planId: result.lastInsertRowid, payment };
  })();

  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(saved.planId);
  plan.repair_order_number = job.repair_order_number;
  plan.installments = db.prepare('SELECT * FROM installments WHERE plan_id = ? ORDER BY due_date').all(saved.planId);
  plan.paid_total = Number(saved.payment?.amount) || 0;
  if (saved.payment) Object.assign(saved.payment, { first: customer.first, last: customer.last, repair_order_number: job.repair_order_number });
  res.json({ ...plan, payment: saved.payment });
});

router.put('/:id/link-job', (req, res) => {
  if (!positiveId(res, req.body.job_id, 'job_id', { required: true })) return;
  const tenant = customerTenantWhere(req, 'c');
  const plan = db.prepare(`SELECT pp.* FROM payment_plans pp JOIN customers c ON pp.customer_id=c.id WHERE pp.id=? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!plan) return res.status(404).json({ error: 'Payment plan not found' });
  const job = db.prepare('SELECT id, repair_order_number FROM jobs WHERE id=? AND customer_id=? AND deleted_at IS NULL').get(req.body.job_id, plan.customer_id);
  if (!job) return fail(res, 'job_id', 'Repair order not found or does not belong to this customer', 404);
  db.prepare('UPDATE payment_plans SET job_id=? WHERE id=?').run(job.id, plan.id);
  db.prepare('UPDATE payments SET job_id=? WHERE plan_id=? AND job_id IS NULL').run(job.id, plan.id);
  res.json({ success: true, job_id: job.id, repair_order_number: job.repair_order_number });
});

router.put('/installment/:id/pay', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const installmentId = Number(req.params.id);
  if (!Number.isSafeInteger(installmentId) || installmentId <= 0) return res.status(400).json({ error: 'A valid installment ID is required' });

  const installment = db.prepare('SELECT * FROM installments WHERE id = ?').get(installmentId);
  if (!installment) return res.status(404).json({ error: 'Installment not found' });

  const plan = db.prepare(`
    SELECT pp.*, c.id AS valid_customer_id, j.repair_order_number
    FROM payment_plans pp
    JOIN customers c ON pp.customer_id = c.id
    LEFT JOIN jobs j ON pp.job_id = j.id AND j.deleted_at IS NULL
    WHERE pp.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(installment.plan_id, ...tenant.values);
  if (!plan) return res.status(404).json({ error: 'Payment plan not found for this installment' });

  const paidDate = req.body.date || localDateKey();
  const settings = paymentSettings(req);
  const assessedLateFee = isPastGrace(installment.due_date, paidDate, settings.payment_grace_days) ? Number(installment.late_fee || settings.late_fee) || 0 : Number(installment.late_fee) || 0;
  const amount = Math.round((Number(installment.amount) + assessedLateFee - Number(installment.amount_paid || 0)) * 100) / 100;
  if (!installment.paid && (!Number.isFinite(amount) || amount <= 0)) return res.status(400).json({ error: 'Installment amount must be greater than zero' });
  const method = req.body.method || 'Cash';
  const description = `${plan.description || 'Payment plan'} (installment)`;

  const payInstallment = db.transaction(() => {
    const current = db.prepare('SELECT * FROM installments WHERE id = ? AND plan_id = ?').get(installmentId, plan.id);
    if (!current) {
      const error = new Error('Installment no longer belongs to this payment plan');
      error.status = 409;
      throw error;
    }

    const existingPayment = db.prepare('SELECT * FROM payments WHERE installment_id = ?').get(installmentId);
    if (current.paid) {
      if (!existingPayment) {
        const error = new Error('Installment is marked paid but has no linked payment; repair is required');
        error.status = 409;
        throw error;
      }
      return { installment: current, payment: existingPayment, alreadyPaid: true };
    }
    if (existingPayment) {
      const error = new Error('A linked payment exists but the installment is not marked paid; repair is required');
      error.status = 409;
      throw error;
    }

    const paymentResult = db.prepare(`
      INSERT INTO payments (customer_id, plan_id, installment_id, job_id, late_fee_amount, description, amount, method, date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(plan.customer_id, plan.id, installmentId, plan.job_id || null, assessedLateFee, description, amount, method, paidDate, 'Auto-logged from payment plan installment');

    const updateResult = db.prepare('UPDATE installments SET paid=1, paid_date=?, amount_paid=amount+?, late_fee=? WHERE id=? AND paid=0').run(paidDate, assessedLateFee, assessedLateFee, installmentId);
    if (updateResult.changes !== 1) {
      const error = new Error('Installment changed while payment was being recorded; no changes were saved');
      error.status = 409;
      throw error;
    }

    const jobInvoiceStatus = reconcileJobInvoiceStatus(db, plan.job_id, Number(settings.tax_rate) || 0);
    return {
      installment: db.prepare('SELECT * FROM installments WHERE id = ?').get(installmentId),
      payment: db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentResult.lastInsertRowid),
      alreadyPaid: false,
      jobInvoiceStatus,
    };
  });

  const result = payInstallment();
  result.payment.repair_order_number = plan.repair_order_number || null;
  res.json({ success: true, already_paid: result.alreadyPaid, installment: result.installment, payment: result.payment, job_invoice_status: result.jobInvoiceStatus || null });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT pp.id FROM payment_plans pp
    JOIN customers c ON pp.customer_id = c.id
    WHERE pp.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Payment plan not found' });

  db.transaction(() => {
    db.prepare('DELETE FROM payment_allocations WHERE installment_id IN (SELECT id FROM installments WHERE plan_id = ?)').run(req.params.id);
    db.prepare('UPDATE payments SET plan_id=NULL, installment_id=NULL WHERE plan_id = ?').run(req.params.id);
    db.prepare('DELETE FROM installments WHERE plan_id = ?').run(req.params.id);
    db.prepare('DELETE FROM payment_plans WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

module.exports = router;
