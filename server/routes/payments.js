const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');
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

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);

  let resolvedJobId = job_id ? Number(job_id) : null;
  if (plan_id) {
    const plan = db.prepare('SELECT id, job_id FROM payment_plans WHERE id = ? AND customer_id = ?').get(plan_id, customer_id);
    if (!plan) return fail(res, 'plan_id', 'Payment plan not found or does not belong to this customer', 404);
    if (resolvedJobId && plan.job_id && resolvedJobId !== plan.job_id) return fail(res, 'job_id', 'Payment repair order does not match the selected payment plan');
    resolvedJobId = plan.job_id || resolvedJobId;
  }

  let job = null;
  if (resolvedJobId) {
    job = db.prepare('SELECT id, repair_order_number FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(resolvedJobId, customer_id);
    if (!job) return fail(res, 'job_id', 'Job not found or does not belong to this customer', 404);
  }

  const result = db.prepare(`
    INSERT INTO payments (customer_id, plan_id, job_id, description, amount, method, date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, plan_id || null, resolvedJobId, description || '', amount, method || 'Cash', date, note || '');
  res.json({ id: result.lastInsertRowid, ...req.body, job_id: resolvedJobId, repair_order_number: job?.repair_order_number || null });
});

router.put('/:id', (req, res) => {
  if (!validatePayment(res, req.body, false)) return;
  const { description, amount, method, date, note } = req.body;
  const tenant = customerTenantWhere(req, 'c');
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
  const result = db.prepare(`
    DELETE FROM payments
    WHERE id IN (
      SELECT p.id FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE p.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Payment not found' });
  res.json({ success: true });
});

module.exports = router;
