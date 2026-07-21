const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const payments = db.prepare(`
    SELECT p.*, c.first, c.last
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY p.date DESC
  `).all(...tenant.values);
  res.json(payments);
});

router.post('/', (req, res) => {
  const { customer_id, plan_id, job_id, description, amount, method, date, note } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) return res.status(400).json({ error: 'Amount is required' });

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return res.status(400).json({ error: 'Customer not found' });

  if (job_id) {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(job_id, customer_id);
    if (!job) return res.status(400).json({ error: 'Job not found or does not belong to this customer' });
  }

  if (plan_id) {
    const plan = db.prepare('SELECT id FROM payment_plans WHERE id = ? AND customer_id = ?').get(plan_id, customer_id);
    if (!plan) return res.status(400).json({ error: 'Payment plan not found or does not belong to this customer' });
  }

  const result = db.prepare(`
    INSERT INTO payments (customer_id, plan_id, job_id, description, amount, method, date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, plan_id || null, job_id || null, description || '', amount, method || 'Cash', date, note || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
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
