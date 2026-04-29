const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const estimates = db.prepare(`
    SELECT e.*, c.first, c.last, v.year, v.make, v.model,
           emp.first AS emp_first, emp.last AS emp_last
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN vehicles v ON e.vehicle_id = v.id
    LEFT JOIN employees emp ON e.employee_id = emp.id
    ORDER BY e.date DESC
  `).all();
  estimates.forEach(est => {
    est.items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id').all(est.id);
  });
  res.json(estimates);
});

router.post('/', (req, res) => {
  const { customer_id, vehicle_id, employee_id, date, status, notes, customer_complaint, discount, tax_rate, expires_date, total, items } = req.body;
  const num = 'EST-' + String(Date.now()).slice(-6);
  const result = db.prepare(`
    INSERT INTO estimates (customer_id, vehicle_id, employee_id, estimate_number, date, status, notes, customer_complaint, discount, tax_rate, expires_date, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, vehicle_id || null, employee_id || null, num, date, status || 'Draft', notes || '', customer_complaint || '', discount || 0, tax_rate || 0, expires_date || null, total || 0);
  const estId = result.lastInsertRowid;
  if (items && items.length) {
    const ins = db.prepare('INSERT INTO estimate_items (estimate_id, type, description, qty, rate, amount) VALUES (?, ?, ?, ?, ?, ?)');
    items.forEach(i => ins.run(estId, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0));
  }
  res.json({ id: estId, estimate_number: num, ...req.body });
});

router.put('/:id', (req, res) => {
  const { status, notes, customer_complaint, discount, tax_rate, expires_date, total, items } = req.body;
  db.prepare(`UPDATE estimates SET status=?, notes=?, customer_complaint=?, discount=?, tax_rate=?, expires_date=?, total=? WHERE id=?`)
    .run(status || 'Draft', notes || '', customer_complaint || '', discount || 0, tax_rate || 0, expires_date || null, total || 0, req.params.id);
  if (items !== undefined) {
    db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO estimate_items (estimate_id, type, description, qty, rate, amount) VALUES (?, ?, ?, ?, ?, ?)');
    (items || []).forEach(i => ins.run(req.params.id, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0));
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(req.params.id);
  db.prepare('DELETE FROM estimates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/convert', (req, res) => {
  const est = db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
  if (!est) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(est.id);
  const labor = items.filter(i => i.type === 'labor').reduce((a, i) => a + i.amount, 0);
  const parts = items.filter(i => i.type !== 'labor').reduce((a, i) => a + i.amount, 0);
  const service = items.map(i => i.description).filter(Boolean).join(', ').slice(0, 255) || est.customer_complaint || 'Service';
  const result = db.prepare(`
    INSERT INTO jobs (customer_id, vehicle_id, employee_id, service, date, labor, parts, status, notes, estimate_id, complaint)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
  `).run(est.customer_id, est.vehicle_id, est.employee_id, service, est.date, labor, parts, est.notes, est.id, est.customer_complaint);
  db.prepare("UPDATE estimates SET status='Approved' WHERE id=?").run(est.id);
  res.json({ job_id: result.lastInsertRowid });
});

module.exports = router;
