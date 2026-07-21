const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const vehicles = db.prepare(`
    SELECT v.*, c.first, c.last
    FROM vehicles v
    JOIN customers c ON v.customer_id = c.id
    WHERE v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY v.year DESC
  `).all(...tenant.values);
  res.json(vehicles);
});

router.post('/', (req, res) => {
  const { customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
  const tenant = customerTenantWhere(req, 'c');
  const cust = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(customer_id, ...tenant.values);
  if (!cust) return res.status(400).json({ error: 'Customer not found' });
  const result = db.prepare(`
    INSERT INTO vehicles (customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles || 0, oil_change_miles || 0, fuel_type || '', transmission || '', engine || '', notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE vehicles SET year=?, make=?, model=?, trim=?, color=?, plate=?, state=?, vin=?, miles=?, oil_change_miles=?, fuel_type=?, transmission=?, engine=?, notes=?
    WHERE id IN (
      SELECT v.id FROM vehicles v
      JOIN customers c ON v.customer_id = c.id
      WHERE v.id = ? AND v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles || 0, oil_change_miles || 0, fuel_type || '', transmission || '', engine || '', notes || '', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE vehicles SET deleted_at = datetime('now')
    WHERE id IN (
      SELECT v.id FROM vehicles v
      JOIN customers c ON v.customer_id = c.id
      WHERE v.id = ? AND v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ success: true });
});

module.exports = router;
