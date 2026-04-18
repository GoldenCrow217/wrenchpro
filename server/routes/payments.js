const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const payments = db.prepare(`
    SELECT p.*, c.first, c.last
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    ORDER BY p.date DESC
  `).all();
  res.json(payments);
});

router.post('/', (req, res) => {
  const { customer_id, plan_id, job_id, description, amount, method, date, note } = req.body;
  const result = db.prepare(`
    INSERT INTO payments (customer_id, plan_id, job_id, description, amount, method, date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, plan_id || null, job_id || null, description || '', amount, method || 'Cash', date, note || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { description, amount, method, date, note } = req.body;
  db.prepare(`UPDATE payments SET description=?, amount=?, method=?, date=?, note=? WHERE id=?`)
    .run(description || '', amount, method || 'Cash', date, note || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;