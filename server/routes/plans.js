const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const plans = db.prepare(`
    SELECT pp.*, c.first, c.last
    FROM payment_plans pp
    JOIN customers c ON pp.customer_id = c.id
    ORDER BY pp.created_at DESC
  `).all();
  plans.forEach(p => {
    p.installments = db.prepare('SELECT * FROM installments WHERE plan_id = ? ORDER BY due_date').all(p.id);
  });
  res.json(plans);
});

router.post('/', (req, res) => {
  const { customer_id, job_id, description, total, down_payment, plan_type, installment_count, frequency, start_date, notes, installments } = req.body;
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
  const today = new Date().toISOString().split('T')[0];
  db.prepare('UPDATE installments SET paid=1, paid_date=? WHERE id=?').run(today, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM installments WHERE plan_id = ?').run(req.params.id);
    db.prepare('DELETE FROM payment_plans WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

module.exports = router;