const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const plans = db.prepare(`
    SELECT pp.*, c.first, c.last
    FROM payment_plans pp
    JOIN customers c ON pp.customer_id = c.id
    WHERE c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY pp.created_at DESC
  `).all(...tenant.values);
  plans.forEach(p => {
    p.installments = db.prepare('SELECT * FROM installments WHERE plan_id = ? ORDER BY due_date').all(p.id);
  });
  res.json(plans);
});

router.post('/', (req, res) => {
  const { customer_id, job_id, description, total, down_payment, plan_type, installment_count, frequency, start_date, notes, installments } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
  if (total === undefined || total === null || Number.isNaN(Number(total))) return res.status(400).json({ error: 'Total is required' });

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return res.status(400).json({ error: 'Customer not found' });

  if (job_id) {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(job_id, customer_id);
    if (!job) return res.status(400).json({ error: 'Job not found or does not belong to this customer' });
  }

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

  res.json({ id: planId, ...req.body });
});

router.put('/installment/:id/pay', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const today = new Date().toISOString().split('T')[0];
  const result = db.prepare(`
    UPDATE installments SET paid=1, paid_date=?
    WHERE id IN (
      SELECT i.id FROM installments i
      JOIN payment_plans pp ON i.plan_id = pp.id
      JOIN customers c ON pp.customer_id = c.id
      WHERE i.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(today, req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Installment not found' });
  res.json({ success: true });
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
