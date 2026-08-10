const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');
const { fail, finiteNumber, positiveId, isoDate } = require('../validation');

function validatePlan(res, body) {
  if (!positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  if (!positiveId(res, body.job_id, 'job_id', { required: true })) return false;
  if (!finiteNumber(res, body, 'total', { required: true, label: 'Total' })) return false;
  if (!finiteNumber(res, body, 'down_payment', { label: 'Down payment' })) return false;
  if (!finiteNumber(res, body, 'installment_count', { label: 'Installment count' })) return false;
  if (!isoDate(res, body, 'start_date', { label: 'Start date' })) return false;
  if (body.installments !== undefined && !Array.isArray(body.installments)) return fail(res, 'installments', 'Installments must be an array');
  for (const installment of body.installments || []) {
    if (!isoDate(res, installment, 'due_date', { required: true, label: 'Installment due date' })) return false;
    if (!finiteNumber(res, installment, 'amount', { required: true, label: 'Installment amount' })) return false;
  }
  if (body.plan_type === 'custom') {
    const installments = body.installments || [];
    if (!installments.length || installments.length !== body.installment_count) return fail(res, 'installments', 'Enter each custom payment amount');
    if (installments.some(installment => installment.amount <= 0)) return fail(res, 'installments', 'Custom payment amounts must be greater than zero');
    const financedCents = Math.round((body.total - (body.down_payment || 0)) * 100);
    const scheduledCents = Math.round(installments.reduce((sum, installment) => sum + installment.amount, 0) * 100);
    if (scheduledCents !== financedCents) return fail(res, 'installments', 'Custom payment amounts must equal the balance after the down payment');
  }
  return true;
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const plans = db.prepare(`
    SELECT pp.*, c.first, c.last, j.repair_order_number
    FROM payment_plans pp
    JOIN customers c ON pp.customer_id = c.id
    LEFT JOIN jobs j ON pp.job_id = j.id AND j.deleted_at IS NULL
    WHERE c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY pp.created_at DESC
  `).all(...tenant.values);
  plans.forEach(p => {
    p.installments = db.prepare('SELECT * FROM installments WHERE plan_id = ? ORDER BY due_date').all(p.id);
  });
  res.json(plans);
});

router.post('/', (req, res) => {
  if (!validatePlan(res, req.body)) return;
  const { customer_id, job_id, description, total, down_payment, plan_type, installment_count, frequency, start_date, notes, installments } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);

  const job = db.prepare('SELECT id, repair_order_number FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(job_id, customer_id);
  if (!job) return fail(res, 'job_id', 'Repair order not found or does not belong to this customer', 404);

  const insertPlan = db.prepare(`
    INSERT INTO payment_plans (customer_id, job_id, description, total, down_payment, plan_type, installment_count, frequency, start_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInst = db.prepare('INSERT INTO installments (plan_id, due_date, amount, paid) VALUES (?, ?, ?, ?)');

  const planId = db.transaction(() => {
    const result = insertPlan.run(customer_id, job_id || null, description, total, down_payment || 0, plan_type || 'installments', installment_count || 4, frequency || 'monthly', start_date, notes || '');
    if (installments && installments.length) {
      installments.forEach(inst => insertInst.run(result.lastInsertRowid, inst.due_date, inst.amount, 0));
    }
    return result.lastInsertRowid;
  })();

  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(planId);
  plan.repair_order_number = job.repair_order_number;
  plan.installments = db.prepare('SELECT * FROM installments WHERE plan_id = ? ORDER BY due_date').all(planId);
  res.json(plan);
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

  const amount = Number(installment.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Installment amount must be greater than zero' });

  const paidDate = req.body.date || new Date().toISOString().split('T')[0];
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
      INSERT INTO payments (customer_id, plan_id, installment_id, job_id, description, amount, method, date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(plan.customer_id, plan.id, installmentId, plan.job_id || null, description, amount, method, paidDate, 'Auto-logged from payment plan installment');

    const updateResult = db.prepare('UPDATE installments SET paid=1, paid_date=? WHERE id=? AND paid=0').run(paidDate, installmentId);
    if (updateResult.changes !== 1) {
      const error = new Error('Installment changed while payment was being recorded; no changes were saved');
      error.status = 409;
      throw error;
    }

    return {
      installment: db.prepare('SELECT * FROM installments WHERE id = ?').get(installmentId),
      payment: db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentResult.lastInsertRowid),
      alreadyPaid: false,
    };
  });

  const result = payInstallment();
  result.payment.repair_order_number = plan.repair_order_number || null;
  res.json({ success: true, already_paid: result.alreadyPaid, installment: result.installment, payment: result.payment });
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
    db.prepare('DELETE FROM installments WHERE plan_id = ?').run(req.params.id);
    db.prepare('DELETE FROM payment_plans WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

module.exports = router;
