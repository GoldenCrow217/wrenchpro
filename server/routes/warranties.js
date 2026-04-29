const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT w.*, c.first, c.last, v.year, v.make, v.model
    FROM warranties w
    JOIN customers c ON w.customer_id = c.id
    LEFT JOIN vehicles v ON w.vehicle_id = v.id
    ORDER BY w.created_at DESC
  `).all());
});

router.post('/', (req, res) => {
  const { job_id, customer_id, vehicle_id, description, labor_months, parts_months, mileage_limit, notes, start_date } = req.body;
  const lm = labor_months || 12;
  const pm = parts_months || 12;
  const sd = start_date || new Date().toISOString().split('T')[0];
  const exp = new Date(sd);
  exp.setMonth(exp.getMonth() + Math.max(lm, pm));
  const expires_date = exp.toISOString().split('T')[0];
  const result = db.prepare(`
    INSERT INTO warranties (job_id, customer_id, vehicle_id, description, labor_months, parts_months, mileage_limit, notes, start_date, expires_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
  `).run(job_id || null, customer_id, vehicle_id || null, description || '', lm, pm, mileage_limit || 12000, notes || '', sd, expires_date);
  res.json({ id: result.lastInsertRowid, expires_date, ...req.body });
});

router.put('/:id', (req, res) => {
  const { description, labor_months, parts_months, mileage_limit, notes, status } = req.body;
  db.prepare(`UPDATE warranties SET description=?, labor_months=?, parts_months=?, mileage_limit=?, notes=?, status=? WHERE id=?`)
    .run(description || '', labor_months || 12, parts_months || 12, mileage_limit || 12000, notes || '', status || 'Active', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM warranties WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
