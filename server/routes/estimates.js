const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const estimates = db.prepare(`
    SELECT e.*, c.first, c.last, v.year, v.make, v.model,
           emp.first AS emp_first, emp.last AS emp_last
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN vehicles  v   ON e.vehicle_id  = v.id
    LEFT JOIN employees emp ON e.employee_id = emp.id
    WHERE e.deleted_at IS NULL
    ORDER BY e.date DESC
  `).all();
  estimates.forEach(est => {
    est.items = db.prepare(`
      SELECT ei.*, pi.name AS inventory_name
      FROM estimate_items ei
      LEFT JOIN parts_inventory pi ON ei.inventory_id = pi.id
      WHERE ei.estimate_id = ?
      ORDER BY ei.id
    `).all(est.id);
  });
  res.json(estimates);
});

router.post('/', (req, res) => {
  const {
    customer_id, vehicle_id, employee_id, date, status, notes,
    customer_complaint, discount, tax_rate, expires_date, total, items,
    approved_by, approval_notes
  } = req.body;
  const num = 'EST-' + String(Date.now()).slice(-6);
  const result = db.prepare(`
    INSERT INTO estimates
      (customer_id, vehicle_id, employee_id, estimate_number, date, status, notes,
       customer_complaint, discount, tax_rate, expires_date, total, approved_by, approval_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id, vehicle_id || null, employee_id || null, num, date,
    status || 'Draft', notes || '', customer_complaint || '',
    discount || 0, tax_rate || 0, expires_date || null, total || 0,
    approved_by || '', approval_notes || ''
  );
  const estId = result.lastInsertRowid;
  if (items && items.length) {
    const ins = db.prepare(`
      INSERT INTO estimate_items (estimate_id, type, description, qty, rate, amount, inventory_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    items.forEach(i => ins.run(estId, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0, i.inventory_id || null));
  }
  res.json({ id: estId, estimate_number: num, ...req.body });
});

router.put('/:id', (req, res) => {
  const {
    status, notes, customer_complaint, discount, tax_rate, expires_date, total, items,
    approved_by, approval_notes
  } = req.body;

  const current = db.prepare('SELECT approved_at FROM estimates WHERE id = ?').get(req.params.id);
  const approvedAt = (status === 'Approved' && !(current && current.approved_at))
    ? new Date().toISOString().replace('T', ' ').split('.')[0]
    : (current ? current.approved_at : null);

  db.prepare(`
    UPDATE estimates
    SET status=?, notes=?, customer_complaint=?, discount=?, tax_rate=?, expires_date=?, total=?,
        approved_at=?, approved_by=?, approval_notes=?
    WHERE id=?
  `).run(
    status || 'Draft', notes || '', customer_complaint || '',
    discount || 0, tax_rate || 0, expires_date || null, total || 0,
    approvedAt, approved_by || '', approval_notes || '',
    req.params.id
  );

  if (items !== undefined) {
    db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(req.params.id);
    const ins = db.prepare(`
      INSERT INTO estimate_items (estimate_id, type, description, qty, rate, amount, inventory_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    (items || []).forEach(i => ins.run(req.params.id, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0, i.inventory_id || null));
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare("UPDATE estimates SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/convert', (req, res) => {
  const est = db.prepare('SELECT * FROM estimates WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!est) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(est.id);
  const labor = items.filter(i => i.type === 'labor').reduce((a, i) => a + i.amount, 0);
  const parts = items.filter(i => i.type !== 'labor').reduce((a, i) => a + i.amount, 0);
  const service = items.map(i => i.description).filter(Boolean).join(', ').slice(0, 255) || est.customer_complaint || 'Service';
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  const result = db.prepare(`
    INSERT INTO jobs (customer_id, vehicle_id, employee_id, service, date, labor, parts, status, notes, estimate_id, complaint)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
  `).run(est.customer_id, est.vehicle_id, est.employee_id, service, est.date, labor, parts, est.notes, est.id, est.customer_complaint);

  db.prepare(`UPDATE estimates SET status='Approved', approved_at=? WHERE id=? AND approved_at IS NULL`)
    .run(now, est.id);

  // Deduct inventory-backed parts
  const deduct = db.prepare('UPDATE parts_inventory SET quantity = MAX(0, quantity - ?) WHERE id = ?');
  items.filter(i => i.inventory_id && i.type !== 'labor').forEach(i => {
    deduct.run(Math.round(i.qty || 1), i.inventory_id);
  });

  res.json({ job_id: result.lastInsertRowid });
});

module.exports = router;
