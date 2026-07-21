const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere } = require('../tenant');

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  const tenant = shopTenantWhere(req, 'e');
  return Boolean(db.prepare(`SELECT e.id FROM employees e WHERE e.id = ? AND ${tenant.clause}`).get(employeeId, ...tenant.values));
}

function inventoryItemsInTenant(req, items = []) {
  const ids = [...new Set((items || []).map(i => i.inventory_id).filter(Boolean).map(Number))];
  if (!ids.length) return true;
  const tenant = shopTenantWhere(req, 'pi');
  const placeholders = ids.map(() => '?').join(',');
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM parts_inventory pi
    WHERE pi.id IN (${placeholders}) AND ${tenant.clause}
  `).get(...ids, ...tenant.values);
  return row.count === ids.length;
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const estimates = db.prepare(`
    SELECT e.*, c.first, c.last, v.year, v.make, v.model,
           emp.first AS emp_first, emp.last AS emp_last
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN vehicles  v   ON e.vehicle_id  = v.id
    LEFT JOIN employees emp ON e.employee_id = emp.id
    WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY e.date DESC
  `).all(...tenant.values);
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
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
  const tenant = customerTenantWhere(req, 'c');
  const cust = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(customer_id, ...tenant.values);
  if (!cust) return res.status(400).json({ error: 'Customer not found' });
  if (vehicle_id) {
    const veh = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
    if (!veh) return res.status(400).json({ error: 'Vehicle not found or does not belong to this customer' });
  }
  if (!employeeInTenant(req, employee_id)) {
    return res.status(400).json({ error: 'Employee is outside the active shop context' });
  }
  if (!inventoryItemsInTenant(req, items)) {
    return res.status(400).json({ error: 'Estimate item inventory is outside the active shop context' });
  }

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

  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT e.approved_at
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Estimate not found' });
  if (!inventoryItemsInTenant(req, items)) {
    return res.status(400).json({ error: 'Estimate item inventory is outside the active shop context' });
  }

  const approvedAt = (status === 'Approved' && !current.approved_at)
    ? new Date().toISOString().replace('T', ' ').split('.')[0]
    : current.approved_at;

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
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE estimates SET deleted_at = datetime('now')
    WHERE id IN (
      SELECT e.id FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Estimate not found' });
  res.json({ success: true });
});

router.post('/:id/convert', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const est = db.prepare(`
    SELECT e.*
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!est) return res.status(404).json({ error: 'Not found' });
  if (!est.vehicle_id) return res.status(400).json({ error: 'A vehicle must be selected on the estimate before converting to a job' });
  const items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(est.id);
  const labor = items.filter(i => i.type === 'labor').reduce((a, i) => a + i.amount, 0);
  const parts = items.filter(i => i.type !== 'labor').reduce((a, i) => a + i.amount, 0);
  const service = items.map(i => i.description).filter(Boolean).join(', ').slice(0, 255) || est.customer_complaint || 'Service';
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  const result = db.prepare(`
    INSERT INTO jobs (customer_id, vehicle_id, employee_id, service, date, labor, parts, status, notes, estimate_id, complaint)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
  `).run(est.customer_id, est.vehicle_id, est.employee_id, service, est.date, labor, parts, est.notes, est.id, est.customer_complaint);

  const jobId = result.lastInsertRowid;

  db.prepare(`UPDATE estimates SET status='Approved', approved_at=? WHERE id=? AND approved_at IS NULL`)
    .run(now, est.id);

  // Copy estimate items to job_items. Labor/diagnostic → not taxable; everything else → taxable.
  if (items.length) {
    const insItem = db.prepare(`INSERT INTO job_items (job_id, type, description, qty, rate, amount, taxable, inventory_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    items.forEach(i => {
      const taxable = (i.type === 'labor' || i.type === 'diagnostic') ? 0 : 1;
      insItem.run(jobId, i.type, i.description, i.qty, i.rate, i.amount, taxable, i.inventory_id || null);
    });
  }

  // Deduct inventory-backed parts only inside the active shop context.
  const inventoryTenant = shopTenantWhere(req, 'pi');
  const deduct = db.prepare(`UPDATE parts_inventory AS pi SET quantity = MAX(0, quantity - ?) WHERE pi.id = ? AND ${inventoryTenant.clause}`);
  items.filter(i => i.inventory_id && i.type !== 'labor').forEach(i => {
    deduct.run(Math.round(i.qty || 1), i.inventory_id, ...inventoryTenant.values);
  });

  res.json({ job_id: jobId });
});

module.exports = router;
