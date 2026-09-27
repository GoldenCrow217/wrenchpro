const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere } = require('../tenant');
const { fail, nonNegativeNumber, positiveId, isoDate } = require('../validation');

function defaultedNumber(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : Number(value);
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function warrantyExpiry(startDate, months) {
  const [year, month, day] = startDate.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function validateWarranty(res, body, create) {
  if (create && !positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  if (create && !positiveId(res, body.vehicle_id, 'vehicle_id')) return false;
  if (create && !positiveId(res, body.job_id, 'job_id')) return false;
  for (const [field, label] of [['labor_months','Labor months'],['parts_months','Parts months'],['mileage_limit','Mileage limit']]) {
    if (!nonNegativeNumber(res, body, field, { label })) return false;
    if (body[field] !== undefined && body[field] !== '' && !Number.isInteger(Number(body[field]))) return fail(res, field, `${label} must be a whole number`);
  }
  return isoDate(res, body, 'start_date', { label: 'Start date' });
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  res.json(db.prepare(`
    SELECT w.*, c.first, c.last, v.year, v.make, v.model
    FROM warranties w
    JOIN customers c ON w.customer_id = c.id
    LEFT JOIN vehicles v ON w.vehicle_id = v.id
    WHERE ${tenant.clause}
    ORDER BY w.created_at DESC
  `).all(...tenant.values));
});

router.post('/', (req, res) => {
  if (!validateWarranty(res, req.body, true)) return;
  const { job_id, customer_id, vehicle_id, description, labor_months, parts_months, mileage_limit, notes, start_date } = req.body;

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

  const lm = defaultedNumber(labor_months, 12);
  const pm = defaultedNumber(parts_months, 12);
  const mileageLimit = defaultedNumber(mileage_limit, 12000);
  const sd = start_date || localDateKey();
  const expires_date = warrantyExpiry(sd, Math.max(lm, pm));
  const result = db.prepare(`
    INSERT INTO warranties (job_id, customer_id, vehicle_id, description, labor_months, parts_months, mileage_limit, notes, start_date, expires_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
  `).run(job_id || null, customer_id, vehicle_id || null, description || '', lm, pm, mileageLimit, notes || '', sd, expires_date);
  res.json({ id: result.lastInsertRowid, expires_date, ...req.body, labor_months: lm, parts_months: pm, mileage_limit: mileageLimit, start_date: sd });
});

router.put('/:id', (req, res) => {
  if (!validateWarranty(res, req.body, false)) return;
  const { description, labor_months, parts_months, mileage_limit, notes, status, start_date } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT w.start_date FROM warranties w
    JOIN customers c ON w.customer_id = c.id
    WHERE w.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Warranty not found' });
  const lm = defaultedNumber(labor_months, 12);
  const pm = defaultedNumber(parts_months, 12);
  const mileageLimit = defaultedNumber(mileage_limit, 12000);
  const sd = start_date || current.start_date || localDateKey();
  const expiresDate = warrantyExpiry(sd, Math.max(lm, pm));
  const result = db.prepare(`
    UPDATE warranties SET description=?, labor_months=?, parts_months=?, mileage_limit=?, notes=?, status=?, start_date=?, expires_date=?
    WHERE id IN (
      SELECT w.id FROM warranties w
      JOIN customers c ON w.customer_id = c.id
      WHERE w.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(description || '', lm, pm, mileageLimit, notes || '', status || 'Active', sd, expiresDate, req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Warranty not found' });
  res.json({ success: true, expires_date: expiresDate });
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
