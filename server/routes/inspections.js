const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere } = require('../tenant');
const { fail, positiveId, isoDate } = require('../validation');

function validateInspection(res, body, create) {
  if (create && !positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  for (const field of ['vehicle_id','job_id','employee_id']) if (!positiveId(res, body[field], field)) return false;
  if (create && !isoDate(res, body, 'date', { required: true, label: 'Inspection date' })) return false;
  if (body.items !== undefined && !Array.isArray(body.items)) return fail(res, 'items', 'Items must be an array');
  return true;
}

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  const tenant = shopTenantWhere(req);
  return Boolean(db.prepare(`SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL AND ${tenant.clause}`).get(employeeId, ...tenant.values));
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
    WHERE ${tenant.clause}
    ORDER BY i.date DESC
  `).all(...tenant.values);
  rows.forEach(r => { r.items = db.prepare('SELECT * FROM inspection_items WHERE inspection_id = ? ORDER BY id').all(r.id); });
  res.json(rows);
});

router.post('/', (req, res) => {
  if (!validateInspection(res, req.body, true)) return;
  const { job_id, customer_id, vehicle_id, employee_id, date, notes, status, items } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);

  if (vehicle_id) {
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
    if (!vehicle) return fail(res, 'vehicle_id', 'Vehicle not found or does not belong to this customer', 404);
  }

  if (job_id) {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(job_id, customer_id);
    if (!job) return fail(res, 'job_id', 'Job not found or does not belong to this customer', 404);
  }

  if (!employeeInTenant(req, employee_id)) return fail(res, 'employee_id', 'Employee not found', 404);

  const id = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO inspections (job_id, customer_id, vehicle_id, employee_id, date, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(job_id || null, customer_id, vehicle_id || null, employee_id || null, date, notes || '', status || 'Draft');
    const inspectionId = result.lastInsertRowid;
    if (items && items.length) {
      const ins = db.prepare('INSERT INTO inspection_items (inspection_id, category, item_name, condition, notes) VALUES (?, ?, ?, ?, ?)');
      items.forEach(it => ins.run(inspectionId, it.category || '', it.item_name || '', it.condition || 'pass', it.notes || ''));
    }
    return inspectionId;
  })();
  res.json({ id, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!validateInspection(res, req.body, false)) return;
  const { notes, status, items } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const changes = db.transaction(() => {
    const result = db.prepare(`
      UPDATE inspections SET notes=?, status=?
      WHERE id IN (
        SELECT i.id FROM inspections i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
      )
    `).run(notes || '', status || 'Draft', req.params.id, ...tenant.values);
    if (!result.changes) return 0;
    if (items !== undefined) {
      db.prepare('DELETE FROM inspection_photos WHERE inspection_item_id IN (SELECT id FROM inspection_items WHERE inspection_id = ?)').run(req.params.id);
      db.prepare('DELETE FROM inspection_items WHERE inspection_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO inspection_items (inspection_id, category, item_name, condition, notes) VALUES (?, ?, ?, ?, ?)');
      (items || []).forEach(it => ins.run(req.params.id, it.category || '', it.item_name || '', it.condition || 'pass', it.notes || ''));
    }
    return result.changes;
  })();
  if (!changes) return res.status(404).json({ error: 'Inspection not found' });
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
  db.transaction(() => {
    db.prepare('DELETE FROM inspection_photos WHERE inspection_item_id IN (SELECT id FROM inspection_items WHERE inspection_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM inspection_items WHERE inspection_id = ?').run(req.params.id);
    db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

module.exports = router;
