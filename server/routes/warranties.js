const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  res.json(db.prepare(`
    SELECT w.*, c.first, c.last, v.year, v.make, v.model
    FROM warranties w
    JOIN customers c ON w.customer_id = c.id
    LEFT JOIN vehicles v ON w.vehicle_id = v.id
    WHERE c.deleted_at IS NULL AND (v.id IS NULL OR v.deleted_at IS NULL) AND ${tenant.clause}
    ORDER BY w.created_at DESC
  `).all(...tenant.values));
});

router.post('/', (req, res) => {
  const { job_id, customer_id, vehicle_id, description, labor_months, parts_months, mileage_limit, notes, start_date } = req.body;
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
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE warranties SET description=?, labor_months=?, parts_months=?, mileage_limit=?, notes=?, status=?
    WHERE id IN (
      SELECT w.id FROM warranties w
      JOIN customers c ON w.customer_id = c.id
      WHERE w.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(description || '', labor_months || 12, parts_months || 12, mileage_limit || 12000, notes || '', status || 'Active', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Warranty not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    DELETE FROM warranties
    WHERE id IN (
      SELECT w.id FROM warranties w
      JOIN customers c ON w.customer_id = c.id
      WHERE w.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Warranty not found' });
  res.json({ success: true });
});

module.exports = router;
