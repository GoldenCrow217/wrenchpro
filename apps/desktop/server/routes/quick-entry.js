const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, resolveShopId } = require('../tenant');
const { fail, requiredText, nonNegativeNumber, isoDate } = require('../validation');
const { localDateKey } = require('../business-date');
const { reconcileJobInvoiceStatus } = require('../job-finance');

function validateQuickEntry(res, body) {
  if (!requiredText(res, body, 'first', 'Customer first name')) return false;
  if (!requiredText(res, body, 'last', 'Customer last name')) return false;
  if (!requiredText(res, body, 'make', 'Vehicle make')) return false;
  if (!requiredText(res, body, 'model', 'Vehicle model')) return false;
  if (!requiredText(res, body, 'service', 'Service description')) return false;
  if (!isoDate(res, body, 'date', { required: true, label: 'Job date' })) return false;
  for (const field of ['year', 'miles', 'labor', 'labor_hours', 'labor_rate', 'parts', 'amount_paid']) {
    if (!nonNegativeNumber(res, body, field, { label: field.replaceAll('_', ' ') })) return false;
  }
  if (Number(body.amount_paid || 0) > 0 && !isoDate(res, body, 'payment_date', { required: true, label: 'Payment date' })) return false;
  return true;
}

function billingSettings(req) {
  const shopId = resolveShopId(req);
  return (shopId ? db.prepare('SELECT tax_rate, default_pay_method FROM shop_settings WHERE shop_id=?').get(shopId) : null)
    || db.prepare('SELECT tax_rate, default_pay_method FROM settings WHERE id=1').get() || {};
}

function nextRepairOrderNumber(req) {
  const tenant = customerTenantWhere(req, 'c');
  const rows = db.prepare(`
    SELECT j.repair_order_number FROM jobs j
    JOIN customers c ON j.customer_id=c.id
    WHERE ${tenant.clause}
  `).all(...tenant.values);
  const highest = rows.reduce((max, row) => {
    const match = String(row.repair_order_number || '').match(/^RO-(\d+)$/i);
    const number = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 1000);
  return `RO-${String(highest + 1).padStart(4, '0')}`;
}

router.post('/', (req, res) => {
  if (!validateQuickEntry(res, req.body)) return;
  const body = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const settings = billingSettings(req);
  const save = db.transaction(() => {
    let customer = db.prepare(`
      SELECT c.* FROM customers c
      WHERE lower(c.first)=lower(?) AND lower(c.last)=lower(?)
        AND c.deleted_at IS NULL AND ${tenant.clause}
      ORDER BY c.id LIMIT 1
    `).get(body.first, body.last, ...tenant.values);
    let customerCreated = false;
    if (!customer) {
      const result = db.prepare(`
        INSERT INTO customers (shop_id, first, last, phone, email, status)
        VALUES (?, ?, ?, ?, ?, 'Active')
      `).run(tenant.shopId, body.first, body.last, body.phone || '', body.email || '');
      customer = db.prepare('SELECT * FROM customers WHERE id=?').get(result.lastInsertRowid);
      customerCreated = true;
    }

    let vehicle = db.prepare(`
      SELECT * FROM vehicles
      WHERE customer_id=? AND lower(make)=lower(?) AND lower(model)=lower(?) AND deleted_at IS NULL
      ORDER BY id LIMIT 1
    `).get(customer.id, body.make, body.model);
    let vehicleCreated = false;
    if (!vehicle) {
      const result = db.prepare(`
        INSERT INTO vehicles (customer_id, year, make, model, plate, miles)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(customer.id, Number(body.year) || null, body.make, body.model, body.plate || '', Number(body.miles) || 0);
      vehicle = db.prepare('SELECT * FROM vehicles WHERE id=?').get(result.lastInsertRowid);
      vehicleCreated = true;
    } else if (Number(body.miles) > Number(vehicle.miles || 0)) {
      db.prepare('UPDATE vehicles SET miles=? WHERE id=?').run(Number(body.miles), vehicle.id);
      vehicle.miles = Number(body.miles);
    }

    const taxRate = Number(settings.tax_rate) || 0;
    const repairOrderNumber = nextRepairOrderNumber(req);
    const jobResult = db.prepare(`
      INSERT INTO jobs
        (customer_id, vehicle_id, service, repair_order_number, date, miles, labor, labor_hours, labor_rate,
         parts, tax_rate, status, notes, invoice_status, closed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Complete', ?, 'Unpaid', datetime('now'))
    `).run(
      customer.id, vehicle.id, body.service, repairOrderNumber, body.date, Number(body.miles) || 0,
      Number(body.labor) || 0, Number(body.labor_hours) || 0, Number(body.labor_rate) || 0,
      Number(body.parts) || 0, taxRate, body.notes || ''
    );

    let payment = null;
    if (Number(body.amount_paid) > 0) {
      const paymentResult = db.prepare(`
        INSERT INTO payments (customer_id, job_id, description, amount, method, date, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.id, jobResult.lastInsertRowid, body.service.slice(0, 60), Number(body.amount_paid),
        body.payment_method || settings.default_pay_method || 'Cash', body.payment_date || localDateKey(), 'Quick Entry payment'
      );
      payment = db.prepare('SELECT * FROM payments WHERE id=?').get(paymentResult.lastInsertRowid);
    }
    const invoiceStatus = reconcileJobInvoiceStatus(db, jobResult.lastInsertRowid, taxRate);
    const job = db.prepare(`
      SELECT j.*, c.first, c.last, v.year, v.make, v.model, v.plate, v.miles AS vehicle_mileage
      FROM jobs j JOIN customers c ON j.customer_id=c.id JOIN vehicles v ON j.vehicle_id=v.id
      WHERE j.id=?
    `).get(jobResult.lastInsertRowid);
    job.items = [];
    if (payment) Object.assign(payment, { first: customer.first, last: customer.last, repair_order_number: repairOrderNumber, job_invoice_status: invoiceStatus });
    return { customer, vehicle, job, payment, customer_created: customerCreated, vehicle_created: vehicleCreated };
  });

  res.json(save());
});

module.exports = router;
