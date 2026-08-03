const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere, customerTenantWhere, getTenantCustomer } = require('../tenant');
const { fail, positiveId, isoDate, clockTime } = require('../validation');

function validateTenantRefs(req, res, customerId, vehicleId, estimateId) {
  const tenant = customerTenantWhere(req, 'c');
  if (customerId) {
    const { customer } = getTenantCustomer(req, customerId, 'c');
    if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);
  }
  if (vehicleId) {
    const vehicle = db.prepare(`
      SELECT v.id FROM vehicles v
      JOIN customers c ON v.customer_id = c.id
      WHERE v.id = ? AND v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
      ${customerId ? 'AND v.customer_id = ?' : ''}
    `).get(vehicleId, ...tenant.values, ...(customerId ? [customerId] : []));
    if (!vehicle) return fail(res, 'vehicle_id', 'Vehicle not found', 404);
  }
  if (estimateId) {
    const estimate = db.prepare(`
      SELECT e.id FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
      ${customerId ? 'AND e.customer_id = ?' : ''}
    `).get(estimateId, ...tenant.values, ...(customerId ? [customerId] : []));
    if (!estimate) return fail(res, 'estimate_id', 'Estimate not found', 404);
  }
  return true;
}

function validateAppointment(req, res) {
  const body = req.body;
  if (!isoDate(res, body, 'date', { required: true, label: 'Appointment date' })) return false;
  if (!clockTime(res, body, 'time')) return false;
  for (const field of ['customer_id', 'vehicle_id', 'estimate_id']) {
    if (!positiveId(res, body[field], field)) return false;
  }
  return validateTenantRefs(req, res, body.customer_id, body.vehicle_id, body.estimate_id);
}

router.get('/', (req, res) => {
  const tenant = shopTenantWhere(req, 'a');
  const appts = db.prepare(`
    SELECT a.*,
           c.first AS cust_first, c.last AS cust_last,
           v.year AS veh_year, v.make AS veh_make, v.model AS veh_model
    FROM appointments a
    LEFT JOIN customers c
      ON a.customer_id = c.id
     AND c.deleted_at IS NULL
     AND ((a.shop_id IS NULL AND c.shop_id IS NULL) OR a.shop_id = c.shop_id)
    LEFT JOIN vehicles v
      ON a.vehicle_id = v.id
     AND v.deleted_at IS NULL
     AND v.customer_id = c.id
    WHERE ${tenant.clause}
    ORDER BY a.date, a.time
  `).all(...tenant.values);
  res.json(appts);
});

router.post('/', (req, res) => {
  if (!validateAppointment(req, res)) return;
  const { cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id } = req.body;
  const shopId = resolveShopId(req);
  const result = db.prepare(`
    INSERT INTO appointments (shop_id, cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(shopId, cust || '', phone || '', service || '', date, time || '', customer_id || null, vehicle_id || null, address || '', notes || '', estimate_id || null);
  res.json({ id: result.lastInsertRowid, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  if (!validateAppointment(req, res)) return;
  const { cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id } = req.body;
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`
    UPDATE appointments
    SET cust=?, phone=?, service=?, date=?, time=?, customer_id=?, vehicle_id=?, address=?, notes=?, estimate_id=?
    WHERE id=? AND ${tenant.clause}
  `).run(cust || '', phone || '', service || '', date, time || '', customer_id || null, vehicle_id || null, address || '', notes || '', estimate_id || null, req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`DELETE FROM appointments WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ success: true });
});

module.exports = router;
