const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere } = require('../tenant');
const { requiredText, finiteNumber, positiveId } = require('../validation');

function validateEmployee(res, body) {
  return requiredText(res, body, 'first', 'First name')
    && requiredText(res, body, 'last', 'Last name')
    && finiteNumber(res, body, 'hourly_rate', { label: 'Hourly rate' });
}

router.get('/', (req, res) => {
  const tenant = shopTenantWhere(req);
  const employees = db.prepare(`SELECT * FROM employees WHERE ${tenant.clause} ORDER BY last, first`).all(...tenant.values);
  res.json(employees);
});

router.post('/', (req, res) => {
  if (!validateEmployee(res, req.body)) return;
  const { first, last, phone, email, role, hourly_rate, status, notes } = req.body;
  const shopId = resolveShopId(req);
  const result = db.prepare(
    'INSERT INTO employees (shop_id, first, last, phone, email, role, hourly_rate, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    shopId,
    first, last,
    phone || '', email || '',
    role || 'Mechanic',
    parseFloat(hourly_rate) || 0,
    status || 'active',
    notes || ''
  );
  res.json({ id: result.lastInsertRowid, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  if (!validateEmployee(res, req.body)) return;
  const { first, last, phone, email, role, hourly_rate, status, notes } = req.body;
  const tenant = shopTenantWhere(req);
  const result = db.prepare(
    `UPDATE employees SET first=?, last=?, phone=?, email=?, role=?, hourly_rate=?, status=?, notes=? WHERE id=? AND ${tenant.clause}`
  ).run(
    first, last,
    phone || '', email || '',
    role || 'Mechanic',
    parseFloat(hourly_rate) || 0,
    status || 'active',
    notes || '',
    req.params.id,
    ...tenant.values
  );
  if (!result.changes) return res.status(404).json({ error: 'Employee not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = shopTenantWhere(req);

  const deleteEmployee = db.transaction(() => {
    const employee = db.prepare(`SELECT id FROM employees WHERE id = ? AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
    if (!employee) return false;

    // Unassign only jobs visible in this tenant before deleting. The employee id
    // is globally unique today, but keeping the write scoped protects hosted
    // data if old/local records were ever mis-linked during migration.
    db.prepare(`
      UPDATE jobs
      SET employee_id = NULL
      WHERE employee_id = ?
        AND id IN (
          SELECT j.id
          FROM jobs j
          JOIN customers c ON j.customer_id = c.id
          WHERE c.deleted_at IS NULL AND ${tenant.clause.replace(/shop_id/g, 'c.shop_id')}
        )
    `).run(req.params.id, ...tenant.values);
    db.prepare(`DELETE FROM employees WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
    return true;
  });

  if (!deleteEmployee()) return res.status(404).json({ error: 'Employee not found' });
  res.json({ success: true });
});

module.exports = router;
