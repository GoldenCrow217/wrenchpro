const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');
const { fail, nonNegativeNumber, positiveId } = require('../validation');

function validateVehicle(res, body, requireCustomer) {
  if (!positiveId(res, body.customer_id, 'customer_id', { required: requireCustomer })) return false;
  for (const [field, label] of [['year','Year'],['miles','Mileage'],['oil_change_miles','Oil-change mileage']]) {
    if (!nonNegativeNumber(res, body, field, { label })) return false;
  }
  if (body.year !== undefined && body.year !== '' && !Number.isInteger(Number(body.year))) return fail(res, 'year', 'Year must be a whole number');
  if (body.miles !== undefined && body.miles !== '' && !Number.isInteger(Number(body.miles))) return fail(res, 'miles', 'Mileage must be a whole number');
  if (body.oil_change_miles !== undefined && body.oil_change_miles !== '' && !Number.isInteger(Number(body.oil_change_miles))) return fail(res, 'oil_change_miles', 'Oil-change mileage must be a whole number');
  return true;
}

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
  if (!validateVehicle(res, req.body, true)) return;
  const { customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const cust = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(customer_id, ...tenant.values);
  if (!cust) return fail(res, 'customer_id', 'Customer not found', 404);
  const result = db.prepare(`
    INSERT INTO vehicles (customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, year === undefined || year === null || year === '' ? null : year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles === undefined || miles === null || miles === '' ? 0 : miles, oil_change_miles === undefined || oil_change_miles === null || oil_change_miles === '' ? 0 : oil_change_miles, fuel_type || '', transmission || '', engine || '', notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!validateVehicle(res, req.body, false)) return;
  const { year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE vehicles SET year=?, make=?, model=?, trim=?, color=?, plate=?, state=?, vin=?, miles=?, oil_change_miles=?, fuel_type=?, transmission=?, engine=?, notes=?
    WHERE id IN (
      SELECT v.id FROM vehicles v
      JOIN customers c ON v.customer_id = c.id
      WHERE v.id = ? AND v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(year === undefined || year === null || year === '' ? null : year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles === undefined || miles === null || miles === '' ? 0 : miles, oil_change_miles === undefined || oil_change_miles === null || oil_change_miles === '' ? 0 : oil_change_miles, fuel_type || '', transmission || '', engine || '', notes || '', req.params.id, ...tenant.values);
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
