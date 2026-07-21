const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, getTenantCustomer, shopTenantWhere } = require('../tenant');

function tenantCustomerOr400(req, customerId) {
  const { customer } = getTenantCustomer(req, customerId, 'c');
  return Boolean(customer);
}

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  const tenant = shopTenantWhere(req, 'e');
  return Boolean(db.prepare(`SELECT e.id FROM employees e WHERE e.id = ? AND ${tenant.clause}`).get(employeeId, ...tenant.values));
}

function vehicleBelongsToTenantCustomer(req, vehicleId, customerId) {
  if (!vehicleId) return true;
  const tenant = customerTenantWhere(req, 'c');
  return Boolean(db.prepare(`
    SELECT v.id FROM vehicles v
    JOIN customers c ON v.customer_id = c.id
    WHERE v.id = ? AND v.customer_id = ? AND v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(vehicleId, customerId, ...tenant.values));
}

function vehicleBelongsToReminderTenant(req, vehicleId, reminderId) {
  if (!vehicleId) return true;
  const tenant = customerTenantWhere(req, 'c');
  return Boolean(db.prepare(`
    SELECT v.id
    FROM service_reminders sr
    JOIN customers c ON sr.customer_id = c.id
    JOIN vehicles v ON v.customer_id = sr.customer_id
    WHERE sr.id = ? AND v.id = ? AND v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(reminderId, vehicleId, ...tenant.values));
}

// ── Interactions ──────────────────────────────────────────────────────────────

router.get('/interactions', (req, res) => {
  const { customer_id } = req.query;
  const tenant = customerTenantWhere(req, 'c');
  const params = [];
  let where = `c.deleted_at IS NULL AND ${tenant.clause}`;
  if (customer_id) {
    where = `i.customer_id = ? AND ${where}`;
    params.push(customer_id);
  }
  params.push(...tenant.values);
  const rows = db.prepare(`
    SELECT i.*, e.first AS emp_first, e.last AS emp_last
    FROM customer_interactions i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN employees e ON i.employee_id = e.id
    WHERE ${where}
    ORDER BY i.created_at DESC
  `).all(...params);
  res.json(rows);
});

router.post('/interactions', (req, res) => {
  const { customer_id, type, summary, employee_id, created_at } = req.body;
  if (!tenantCustomerOr400(req, customer_id)) return res.status(400).json({ error: 'Customer is outside the active shop context' });
  if (!employeeInTenant(req, employee_id)) return res.status(400).json({ error: 'Employee is outside the active shop context' });
  const result = db.prepare(
    `INSERT INTO customer_interactions (customer_id, type, summary, employee_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    customer_id,
    type || 'Note',
    summary || '',
    employee_id || null,
    created_at || new Date().toISOString().split('T')[0]
  );
  res.json({ id: result.lastInsertRowid });
});

router.delete('/interactions/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    DELETE FROM customer_interactions
    WHERE id IN (
      SELECT i.id FROM customer_interactions i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Interaction not found' });
  res.json({ success: true });
});

// ── Follow-ups ────────────────────────────────────────────────────────────────

router.get('/followups', (req, res) => {
  const { customer_id } = req.query;
  const tenant = customerTenantWhere(req, 'c');
  const params = [];
  let where = `c.deleted_at IS NULL AND ${tenant.clause}`;
  if (customer_id) {
    where = `f.customer_id = ? AND ${where}`;
    params.push(customer_id);
  }
  params.push(...tenant.values);
  const rows = db.prepare(`
    SELECT f.* FROM follow_ups f
    JOIN customers c ON f.customer_id = c.id
    WHERE ${where}
    ORDER BY f.due_date ASC
  `).all(...params);
  res.json(rows);
});

router.post('/followups', (req, res) => {
  const { customer_id, due_date, note } = req.body;
  if (!tenantCustomerOr400(req, customer_id)) return res.status(400).json({ error: 'Customer is outside the active shop context' });
  const result = db.prepare(
    `INSERT INTO follow_ups (customer_id, due_date, note) VALUES (?, ?, ?)`
  ).run(customer_id, due_date, note || '');
  res.json({ id: result.lastInsertRowid });
});

router.put('/followups/:id', (req, res) => {
  const { due_date, note, status, completed_at } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE follow_ups SET due_date=?, note=?, status=?, completed_at=?
    WHERE id IN (
      SELECT f.id FROM follow_ups f
      JOIN customers c ON f.customer_id = c.id
      WHERE f.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(due_date, note || '', status || 'pending', completed_at || null, req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Follow-up not found' });
  res.json({ success: true });
});

router.delete('/followups/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    DELETE FROM follow_ups
    WHERE id IN (
      SELECT f.id FROM follow_ups f
      JOIN customers c ON f.customer_id = c.id
      WHERE f.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Follow-up not found' });
  res.json({ success: true });
});

// ── Service Reminders ─────────────────────────────────────────────────────────

router.get('/service-reminders', (req, res) => {
  const { customer_id } = req.query;
  const tenant = customerTenantWhere(req, 'c');
  const params = [];
  let where = `c.deleted_at IS NULL AND ${tenant.clause}`;
  if (customer_id) {
    where = `sr.customer_id = ? AND ${where}`;
    params.push(customer_id);
  }
  params.push(...tenant.values);
  const rows = db.prepare(`
    SELECT sr.*, v.year, v.make, v.model
    FROM service_reminders sr
    JOIN customers c ON sr.customer_id = c.id
    LEFT JOIN vehicles v ON sr.vehicle_id = v.id
    WHERE ${where}
    ORDER BY sr.reminder_date ASC
  `).all(...params);
  res.json(rows);
});

router.post('/service-reminders', (req, res) => {
  const { customer_id, vehicle_id, service_type, reminder_date, note } = req.body;
  if (!tenantCustomerOr400(req, customer_id)) return res.status(400).json({ error: 'Customer is outside the active shop context' });
  if (!vehicleBelongsToTenantCustomer(req, vehicle_id, customer_id)) return res.status(400).json({ error: 'Vehicle is outside the active shop context' });
  const result = db.prepare(
    `INSERT INTO service_reminders (customer_id, vehicle_id, service_type, reminder_date, note)
     VALUES (?, ?, ?, ?, ?)`
  ).run(customer_id, vehicle_id || null, service_type || '', reminder_date, note || '');
  res.json({ id: result.lastInsertRowid });
});

router.put('/service-reminders/:id', (req, res) => {
  const { vehicle_id, service_type, reminder_date, note, status } = req.body;
  if (!vehicleBelongsToReminderTenant(req, vehicle_id, req.params.id)) return res.status(400).json({ error: 'Vehicle is outside the active shop context' });
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE service_reminders SET vehicle_id=?, service_type=?, reminder_date=?, note=?, status=?
    WHERE id IN (
      SELECT sr.id FROM service_reminders sr
      JOIN customers c ON sr.customer_id = c.id
      WHERE sr.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(vehicle_id || null, service_type || '', reminder_date, note || '', status || 'pending', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Service reminder not found' });
  res.json({ success: true });
});

router.delete('/service-reminders/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    DELETE FROM service_reminders
    WHERE id IN (
      SELECT sr.id FROM service_reminders sr
      JOIN customers c ON sr.customer_id = c.id
      WHERE sr.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Service reminder not found' });
  res.json({ success: true });
});

module.exports = router;
