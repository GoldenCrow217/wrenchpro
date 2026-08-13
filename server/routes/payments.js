const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, resolveShopId } = require('../tenant');
const { fail, finiteNumber, positiveId, isoDate } = require('../validation');

function validatePayment(res, body, includeRelationships) {
  if (includeRelationships && !positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  if (includeRelationships && !positiveId(res, body.job_id, 'job_id')) return false;
  if (includeRelationships && !positiveId(res, body.plan_id, 'plan_id')) return false;
  return finiteNumber(res, body, 'amount', { required: true, label: 'Amount' })
    && isoDate(res, body, 'date', { required: true, label: 'Payment date' });
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const payments = db.prepare(`
    SELECT p.*, c.first, c.last, j.repair_order_number
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    LEFT JOIN jobs j ON p.job_id = j.id
    WHERE c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY p.date DESC
  `).all(...tenant.values);
  res.json(payments);
});

router.post('/', (req, res) => {
  if (!validatePayment(res, req.body, true)) return;
  const { customer_id, plan_id, job_id, description, amount, method, date, note } = req.body;
  if (Number(amount) <= 0) return fail(res, 'amount', 'Payment amount must be greater than zero');

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);

  let resolvedJobId = job_id ? Number(job_id) : null;
  let plan = null;
  if (plan_id) {
    plan = db.prepare('SELECT id, job_id FROM payment_plans WHERE id = ? AND customer_id = ?').get(plan_id, customer_id);
    if (!plan) return fail(res, 'plan_id', 'Payment plan not found or does not belong to this customer', 404);
    if (resolvedJobId && plan.job_id && resolvedJobId !== plan.job_id) return fail(res, 'job_id', 'Payment repair order does not match the selected payment plan');
    resolvedJobId = plan.job_id || resolvedJobId;
  }

  let job = null;
  if (resolvedJobId) {
    job = db.prepare('SELECT id, repair_order_number FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(resolvedJobId, customer_id);
    if (!job) return fail(res, 'job_id', 'Job not found or does not belong to this customer', 404);
  }

  const savePayment = db.transaction(() => {
    const result = db.prepare(`INSERT INTO payments (customer_id, plan_id, job_id, description, amount, method, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(customer_id, plan_id || null, resolvedJobId, description || '', amount, method || 'Cash', date, note || '');
    const allocations = [];
    const isDownPayment = String(note || '').trim().toLowerCase() === 'down payment';
    if (plan && !isDownPayment) {
      const shopId = resolveShopId(req);
      const settings = (shopId ? db.prepare('SELECT payment_grace_days, late_fee FROM shop_settings WHERE shop_id=?').get(shopId) : null)
        || db.prepare('SELECT payment_grace_days, late_fee FROM settings WHERE id=1').get() || {};
      let remaining = Number(amount);
      const installments = db.prepare('SELECT * FROM installments WHERE plan_id=? AND paid=0 ORDER BY due_date,id').all(plan.id);
      for (const inst of installments) {
        if (remaining <= 0) break;
        const cutoff = inst.due_date ? new Date(`${inst.due_date}T00:00:00Z`) : null;
        if (cutoff) cutoff.setUTCDate(cutoff.getUTCDate() + (Number(settings.payment_grace_days) || 0));
        const lateFee = cutoff && date > cutoff.toISOString().slice(0,10) ? Number(inst.late_fee || settings.late_fee) || 0 : Number(inst.late_fee) || 0;
        const due = Math.max(0, Number(inst.amount) + lateFee - Number(inst.amount_paid || 0));
        const applied = Math.min(remaining, due);
        if (!(applied > 0)) continue;
        db.prepare('INSERT INTO payment_allocations (payment_id,installment_id,amount) VALUES (?,?,?)').run(result.lastInsertRowid, inst.id, applied);
        const newPaid = Number(inst.amount_paid || 0) + applied;
        const complete = newPaid + .005 >= Number(inst.amount) + lateFee;
        db.prepare('UPDATE installments SET amount_paid=?, late_fee=?, paid=?, paid_date=? WHERE id=?').run(newPaid, lateFee, complete ? 1 : 0, complete ? date : null, inst.id);
        allocations.push({ installment_id: inst.id, amount: applied });
        remaining = Math.round((remaining - applied) * 100) / 100;
      }
    }
    return { id: result.lastInsertRowid, allocations };
  });
  const saved = savePayment();
  const planInstallments = plan ? db.prepare('SELECT * FROM installments WHERE plan_id=? ORDER BY due_date').all(plan.id) : undefined;
  res.json({ id: saved.id, ...req.body, job_id: resolvedJobId, repair_order_number: job?.repair_order_number || null, allocations: saved.allocations, plan_installments: planInstallments });
});

router.put('/:id', (req, res) => {
  if (!validatePayment(res, req.body, false)) return;
  const { description, amount, method, date, note } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const allocated = db.prepare(`SELECT pa.id FROM payment_allocations pa JOIN payments p ON pa.payment_id=p.id JOIN customers c ON p.customer_id=c.id WHERE p.id=? AND c.deleted_at IS NULL AND ${tenant.clause} LIMIT 1`).get(req.params.id, ...tenant.values);
  if (allocated) return res.status(409).json({ error: 'Allocated plan payments cannot be edited; delete and re-record the payment instead' });
  const result = db.prepare(`
    UPDATE payments SET description=?, amount=?, method=?, date=?, note=?
    WHERE id IN (
      SELECT p.id FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE p.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(description || '', amount, method || 'Cash', date, note || '', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Payment not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const payment = db.prepare(`SELECT p.* FROM payments p JOIN customers c ON p.customer_id=c.id WHERE p.id=? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.installment_id) return res.status(409).json({ error: 'Installment payments must remain attached to their paid installment' });
  db.transaction(() => {
    const allocations = db.prepare('SELECT * FROM payment_allocations WHERE payment_id=?').all(payment.id);
    for (const allocation of allocations) {
      const inst = db.prepare('SELECT * FROM installments WHERE id=?').get(allocation.installment_id);
      if (!inst) continue;
      const amountPaid = Math.max(0, Math.round((Number(inst.amount_paid || 0) - Number(allocation.amount || 0)) * 100) / 100);
      db.prepare('UPDATE installments SET amount_paid=?, paid=0, paid_date=NULL WHERE id=?').run(amountPaid, inst.id);
    }
    db.prepare('DELETE FROM payment_allocations WHERE payment_id=?').run(payment.id);
    db.prepare('DELETE FROM payments WHERE id=?').run(payment.id);
  })();
  res.json({ success: true });
});

module.exports = router;
