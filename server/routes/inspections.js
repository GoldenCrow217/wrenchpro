const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, c.first, c.last, v.year, v.make, v.model,
           e.first AS emp_first, e.last AS emp_last
    FROM inspections i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN vehicles v ON i.vehicle_id = v.id
    LEFT JOIN employees e ON i.employee_id = e.id
    ORDER BY i.date DESC
  `).all();
  rows.forEach(r => { r.items = db.prepare('SELECT * FROM inspection_items WHERE inspection_id = ? ORDER BY id').all(r.id); });
  res.json(rows);
});

router.post('/', (req, res) => {
  const { job_id, customer_id, vehicle_id, employee_id, date, notes, status, items } = req.body;
  const result = db.prepare(`
    INSERT INTO inspections (job_id, customer_id, vehicle_id, employee_id, date, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(job_id || null, customer_id, vehicle_id || null, employee_id || null, date, notes || '', status || 'Draft');
  const id = result.lastInsertRowid;
  if (items && items.length) {
    const ins = db.prepare('INSERT INTO inspection_items (inspection_id, category, item_name, condition, notes) VALUES (?, ?, ?, ?, ?)');
    items.forEach(it => ins.run(id, it.category || '', it.item_name || '', it.condition || 'pass', it.notes || ''));
  }
  res.json({ id, ...req.body });
});

router.put('/:id', (req, res) => {
  const { notes, status, items } = req.body;
  db.prepare('UPDATE inspections SET notes=?, status=? WHERE id=?').run(notes || '', status || 'Draft', req.params.id);
  if (items !== undefined) {
    db.prepare('DELETE FROM inspection_items WHERE inspection_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO inspection_items (inspection_id, category, item_name, condition, notes) VALUES (?, ?, ?, ?, ?)');
    (items || []).forEach(it => ins.run(req.params.id, it.category || '', it.item_name || '', it.condition || 'pass', it.notes || ''));
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM inspection_items WHERE inspection_id = ?').run(req.params.id);
  db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
