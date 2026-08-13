const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere, resolveShopId, employeeInTenant, inventoryItemsInTenant } = require('../tenant');
const { fail, finiteNumber, positiveId, isoDate } = require('../validation');

function validateJob(res, body, create) {
  if (create && !positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  if (create && !positiveId(res, body.vehicle_id, 'vehicle_id', { required: true })) return false;
  if (!positiveId(res, body.employee_id, 'employee_id')) return false;
  if (!positiveId(res, body.estimate_id, 'estimate_id')) return false;
  if (!isoDate(res, body, 'date', { required: true, label: 'Job date' })) return false;
  for (const field of ['miles','labor','labor_hours','labor_rate','parts','travel_fee','parts_deposit_required']) if (!finiteNumber(res, body, field, { label: field.replaceAll('_', ' ') })) return false;
  if (body.miles !== undefined && Number(body.miles) < 0) return fail(res, 'miles', 'Mileage cannot be negative');
  if (Number(body.parts_deposit_required || 0) < 0) return fail(res, 'parts_deposit_required', 'Parts deposit cannot be negative');
  if (body.items !== undefined && !Array.isArray(body.items)) return fail(res, 'items', 'Items must be an array');
  for (const item of body.items || []) {
    for (const field of ['qty','rate','amount']) if (!finiteNumber(res, item, field, { label: `Item ${field}` })) return false;
    if (!positiveId(res, item.inventory_id, 'inventory_id')) return false;
  }
  if (body.repair_order_number !== undefined) {
    if (typeof body.repair_order_number !== 'string') return fail(res, 'repair_order_number', 'Repair order number must be text');
    body.repair_order_number = body.repair_order_number.trim();
    if (body.repair_order_number.length > 80) return fail(res, 'repair_order_number', 'Repair order number must be 80 characters or fewer');
  }
  return true;
}

function savedJobRecord(req, jobId) {
  const tenant = customerTenantWhere(req, 'c');
  const job = db.prepare(`
    SELECT j.*, c.first, c.last, v.year, v.make, v.model, v.plate, v.miles AS vehicle_mileage,
           e.first AS emp_first, e.last AS emp_last
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles v ON j.vehicle_id = v.id
    LEFT JOIN employees e ON j.employee_id = e.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND c.deleted_at IS NULL
      AND v.deleted_at IS NULL AND ${tenant.clause}
  `).get(jobId, ...tenant.values);
  if (!job) return null;
  job.items = db.prepare('SELECT * FROM job_items WHERE job_id = ? ORDER BY id').all(job.id);
  return job;
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const jobs = db.prepare(`
    SELECT j.*, c.first, c.last, v.year, v.make, v.model, v.plate,
           e.first AS emp_first, e.last AS emp_last
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles  v ON j.vehicle_id  = v.id
    LEFT JOIN employees e ON j.employee_id = e.id
    WHERE j.deleted_at IS NULL AND c.deleted_at IS NULL AND v.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY j.date DESC
  `).all(...tenant.values);
  if (jobs.length) {
    const ids = jobs.map(j => j.id);
    const allItems = db.prepare(`SELECT * FROM job_items WHERE job_id IN (${ids.map(() => '?').join(',')}) ORDER BY job_id, id`).all(...ids);
    const itemMap = {};
    allItems.forEach(i => { (itemMap[i.job_id] = itemMap[i.job_id] || []).push(i); });
    jobs.forEach(j => { j.items = itemMap[j.id] || []; });
  } else {
    jobs.forEach(j => { j.items = []; });
  }
  res.json(jobs);
});

router.get('/:id/balance', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const job = db.prepare(`
    SELECT j.labor, j.parts, j.travel_fee
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const paid = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.job_id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values).total;

  const items = db.prepare('SELECT * FROM job_items WHERE job_id = ?').all(req.params.id);
  let laborTotal, partsTotal, tax;
  if (items.length > 0) {
    const shopId = resolveShopId(req);
    const taxRow = shopId ? db.prepare('SELECT tax_rate FROM shop_settings WHERE shop_id = ?').get(shopId) : null;
    const taxRate = taxRow?.tax_rate ?? (db.prepare('SELECT tax_rate FROM settings WHERE id = 1').get()?.tax_rate ?? 0);
    laborTotal = items.filter(i => !i.taxable).reduce((a, i) => a + (i.amount || 0), 0);
    partsTotal = items.filter(i => i.taxable).reduce((a, i) => a + (i.amount || 0), 0);
    tax = partsTotal * taxRate / 100;
  } else {
    laborTotal = job.labor || 0;
    partsTotal = job.parts || 0;
    tax = 0;
  }
  const total = laborTotal + partsTotal + tax + (job.travel_fee || 0);
  res.json({ total, paid, balance: total - paid, labor_total: laborTotal, parts_total: partsTotal, tax });
});

function itemTotals(items) {
  let labor = 0, parts = 0;
  (items || []).forEach(i => { if (i.taxable) parts += (i.amount || 0); else labor += (i.amount || 0); });
  return { labor, parts };
}

function billingSettings(req) {
  const shopId = resolveShopId(req);
  return (shopId ? db.prepare('SELECT tax_rate, default_pay_method FROM shop_settings WHERE shop_id = ?').get(shopId) : null)
    || db.prepare('SELECT tax_rate, default_pay_method FROM settings WHERE id = 1').get()
    || {};
}

function jobGrandTotal(req, labor, parts, travelFee) {
  const taxRate = Number(billingSettings(req).tax_rate) || 0;
  return Math.round(((Number(labor) || 0) + (Number(parts) || 0) * (1 + taxRate / 100) + (Number(travelFee) || 0) + Number.EPSILON) * 100) / 100;
}

function insertAutomaticJobPayment(jobId, customer, amount, method, date, repairOrderNumber, service) {
  if (!(amount > 0)) return null;
  const description = `Payment for ${repairOrderNumber || `job #${jobId}`}${service ? ` — ${service}` : ''}`;
  const result = db.prepare(`
    INSERT INTO payments (customer_id, job_id, description, amount, method, date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(customer.id, jobId, description, amount, method || 'Cash', date, 'Automatically recorded when job was marked Paid');
  return { id: result.lastInsertRowid, customer_id: customer.id, job_id: jobId, repair_order_number: repairOrderNumber || null, description, amount, method: method || 'Cash', date, note: 'Automatically recorded when job was marked Paid', first: customer.first, last: customer.last };
}

const saveJobItems = db.transaction((jobId, items) => {
  db.prepare('DELETE FROM job_items WHERE job_id = ?').run(jobId);
  if (!items || !items.length) return;
  const ins = db.prepare(`INSERT INTO job_items (job_id, type, description, qty, rate, amount, taxable, inventory_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  items.forEach(i => ins.run(jobId, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0, i.taxable ? 1 : 0, i.inventory_id || null));
});

function advanceVehicleMileage(vehicleId, mileage) {
  const nextMileage = Number(mileage);
  if (!Number.isFinite(nextMileage) || nextMileage < 0) return;
  db.prepare(`
    UPDATE vehicles
    SET miles = ?
    WHERE id = ? AND deleted_at IS NULL AND ? > COALESCE(miles, 0)
  `).run(nextMileage, vehicleId, nextMileage);
}

const createJob = db.transaction((values, items, automaticPayment, vehicleMileage) => {
  const result = db.prepare(`
    INSERT INTO jobs
      (customer_id, vehicle_id, service, repair_order_number, date, miles, labor, labor_hours, labor_rate,
       parts, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
       service_address, travel_fee, parts_deposit_required, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(...values);
  const jobId = result.lastInsertRowid;
  if (items && items.length) saveJobItems(jobId, items);
  advanceVehicleMileage(vehicleMileage.vehicleId, vehicleMileage.miles);
  const payment = automaticPayment ? insertAutomaticJobPayment(jobId, automaticPayment.customer, automaticPayment.amount, automaticPayment.method, automaticPayment.date, automaticPayment.repairOrderNumber, automaticPayment.service) : null;
  return { jobId, payment };
});

router.post('/', (req, res) => {
  if (!validateJob(res, req.body, true)) return;
  const {
    customer_id, vehicle_id, service, repair_order_number, date, miles, labor, labor_hours, labor_rate,
    parts, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee, parts_deposit_required, items
  } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const cust = db.prepare(`SELECT c.id, c.first, c.last FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(customer_id, ...tenant.values);
  if (!cust) return fail(res, 'customer_id', 'Customer not found', 404);

  const veh = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
  if (!veh) return fail(res, 'vehicle_id', 'Vehicle not found or does not belong to this customer', 404);

  if (!employeeInTenant(req, employee_id)) {
    return fail(res, 'employee_id', 'Employee not found', 404);
  }

  if (!inventoryItemsInTenant(req, items)) {
    return fail(res, 'inventory_id', 'Inventory item not found', 404);
  }

  if (estimate_id) {
    const est = db.prepare('SELECT id FROM estimates WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(estimate_id, customer_id);
    if (!est) return fail(res, 'estimate_id', 'Estimate not found or does not belong to this customer', 404);
  }

  const isTerminal = (status === 'Complete' || status === 'Canceled');
  const closedAt = isTerminal ? new Date().toISOString().replace('T', ' ').split('.')[0] : null;

  // Compute labor/parts from items if provided, else use direct values
  const totals = (items && items.length) ? itemTotals(items) : null;
  const laborVal = totals ? totals.labor : (labor || 0);
  const partsVal = totals ? totals.parts : (parts || 0);

  const settings = billingSettings(req);
  if (Number(parts_deposit_required || 0) > 0 && ['In Progress', 'Complete'].includes(status) && invoice_status !== 'Paid') {
    return fail(res, 'parts_deposit_required', 'Required parts deposit must be paid before work can begin', 409);
  }
  const paidOnCreate = invoice_status === 'Paid' ? {
    customer: cust,
    amount: jobGrandTotal(req, laborVal, partsVal, travel_fee),
    method: settings.default_pay_method || 'Cash',
    date: new Date().toISOString().slice(0, 10),
    repairOrderNumber: repair_order_number || '',
    service: service || '',
  } : null;
  const created = createJob([
    customer_id, vehicle_id, service, repair_order_number || '', date, miles || 0,
    laborVal, parseFloat(labor_hours) || 0, parseFloat(labor_rate) || 0,
    partsVal, status || 'Pending', notes || '', employee_id || null,
    complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
    service_address || '', travel_fee || 0, parts_deposit_required || 0, closedAt
  ], items, paidOnCreate, { vehicleId: vehicle_id, miles: miles || 0 });
  const savedJob = savedJobRecord(req, created.jobId);
  res.json({ ...savedJob, payment: created.payment });
});

router.put('/:id', (req, res) => {
  if (!validateJob(res, req.body, false)) return;
  const {
    service, repair_order_number, date, miles, labor, labor_hours, labor_rate, parts, status, notes,
    employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee, parts_deposit_required, items
  } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT j.closed_at, j.customer_id, j.vehicle_id, j.invoice_status, c.first, c.last
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Job not found' });

  if (!employeeInTenant(req, employee_id)) {
    return fail(res, 'employee_id', 'Employee not found', 404);
  }

  if (!inventoryItemsInTenant(req, items)) {
    return fail(res, 'inventory_id', 'Inventory item not found', 404);
  }

  if (estimate_id) {
    const est = db.prepare('SELECT id FROM estimates WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(estimate_id, current.customer_id);
    if (!est) return fail(res, 'estimate_id', 'Estimate not found or does not belong to this job customer', 404);
  }

  const isTerminal = status === 'Complete' || status === 'Canceled';
  const closedAt = isTerminal
    ? (current.closed_at || new Date().toISOString().replace('T', ' ').split('.')[0])
    : null;

  const updatedTotals = items !== undefined ? itemTotals(items || []) : null;
  const laborVal = updatedTotals ? updatedTotals.labor : (labor || 0);
  const partsVal = updatedTotals ? updatedTotals.parts : (parts || 0);
  const shouldRecordPayment = invoice_status === 'Paid' && current.invoice_status !== 'Paid';
  const paidToDate = shouldRecordPayment
    ? Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE job_id = ?').get(req.params.id).total) || 0
    : 0;
  const remainingBalance = shouldRecordPayment
    ? Math.max(0, Math.round((jobGrandTotal(req, laborVal, partsVal, travel_fee) - paidToDate + Number.EPSILON) * 100) / 100)
    : 0;
  const settings = billingSettings(req);
  const depositPaid = Number(db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE job_id=?').get(req.params.id).total) || 0;
  if (Number(parts_deposit_required || 0) > depositPaid + .005 && ['In Progress', 'Complete'].includes(status) && invoice_status !== 'Paid') {
    return fail(res, 'parts_deposit_required', `Required parts deposit has ${Math.max(0, Number(parts_deposit_required) - depositPaid).toFixed(2)} remaining`, 409);
  }
  let automaticPayment = null;

  db.transaction(() => {
    db.prepare(`
      UPDATE jobs
      SET service=?, repair_order_number=?, date=?, miles=?, labor=?, labor_hours=?, labor_rate=?, parts=?,
          status=?, notes=?, employee_id=?, complaint=?, diagnosis=?, invoice_status=?,
          estimate_id=?, service_address=?, travel_fee=?, parts_deposit_required=?, closed_at=?
      WHERE id=?
    `).run(
      service, repair_order_number || '', date, miles || 0,
      laborVal, parseFloat(labor_hours) || 0, parseFloat(labor_rate) || 0,
      partsVal, status || 'Pending', notes || '', employee_id || null,
      complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
      service_address || '', travel_fee || 0, parts_deposit_required || 0, closedAt,
      req.params.id
    );
    if (items !== undefined) saveJobItems(req.params.id, items || []);
    advanceVehicleMileage(current.vehicle_id, miles || 0);
    if (shouldRecordPayment && remainingBalance > 0) {
      automaticPayment = insertAutomaticJobPayment(
        Number(req.params.id),
        { id: current.customer_id, first: current.first, last: current.last },
        remainingBalance,
        settings.default_pay_method || 'Cash',
        new Date().toISOString().slice(0, 10),
        repair_order_number || '',
        service || ''
      );
    }
  })();
  const savedJob = savedJobRecord(req, req.params.id);
  res.json({ ...savedJob, success: true, payment: automaticPayment });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE jobs SET deleted_at = datetime('now')
    WHERE id IN (
      SELECT j.id FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      WHERE j.id = ? AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true });
});

module.exports = router;
