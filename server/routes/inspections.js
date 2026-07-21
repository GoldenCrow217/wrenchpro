const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere } = require('../tenant');

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  const tenant = shopTenantWhere(req);
  return Boolean(db.prepare(`SELECT id FROM employees WHERE id = ? AND ${tenant.clause}`).get(employeeId, ...tenant.values));
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const rows = db.prepare(`
    SELECT i.*, c.first, c.last, v.year, v.make, v.model,
           e.first AS emp_first, e.last AS emp_last
    FROM inspections i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN vehicles v ON i.vehicle_id = v.id
    LEFT JOIN employees e ON i.employee_id = e.id
    WHERE c.deleted_at IS NULL AND (v.id IS NULL OR v.deleted_at IS NULL) AND ${tenant.clause}
    ORDER BY i.date DESC
  `).all(...tenant.values);
  rows.forEach(r => { r.items = db.prepare('SELECT * FROM inspection_items WHERE inspection_id = ? ORDER BY id').all(r.id); });
  res.json(rows);
});

router.post('/', (req, res) => {
  const { job_id, customer_id, vehicle_id, employee_id, date, notes, status, items } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return res.status(400).json({ error: 'Customer not found' });

  if (vehicle_id) {
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
    if (!vehicle) return res.status(400).json({ error: 'Vehicle not found or does not belong to this customer' });
  }

  if (job_id) {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(job_id, customer_id);
    if (!job) return res.status(400).json({ error: 'Job not found or does not belong to this customer' });
  }

  if (!employeeInTenant(req, employee_id)) return res.status(400).json({ error: 'Employee not found for this shop' });

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
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE inspections SET notes=?, status=?
    WHERE id IN (
      SELECT i.id FROM inspections i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(notes || '', status || 'Draft', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Inspection not found' });
  if (items !== undefined) {
    db.prepare('DELETE FROM inspection_items WHERE inspection_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO inspection_items (inspection_id, category, item_name, condition, notes) VALUES (?, ?, ?, ?, ?)');
    (items || []).forEach(it => ins.run(req.params.id, it.category || '', it.item_name || '', it.condition || 'pass', it.notes || ''));
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT i.id FROM inspections i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Inspection not found' });
  db.prepare('DELETE FROM inspection_items WHERE inspection_id = ?').run(req.params.id);
  db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
