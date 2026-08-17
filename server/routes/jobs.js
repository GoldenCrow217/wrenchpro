const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere, resolveShopId, employeeInTenant, inventoryItemsInTenant } = require('../tenant');
const { fail, nonNegativeNumber, positiveId, isoDate } = require('../validation');
const { normalizedItemType, normalizeLineItems, lineItemTotals } = require('../line-items');
const { reconcileJobInvoiceStatus } = require('../job-finance');
const { calculateJobTotals, isTaxablePart } = require('../pricing');
const { localDateKey } = require('../business-date');

const JOB_STATUSES = new Set(['Pending', 'Confirmed', 'En Route', 'In Progress', 'Waiting on Parts', 'Complete', 'Canceled']);
const INVOICE_STATUSES = new Set(['Unpaid', 'Paid', 'Partial', 'Voided']);

function validateOptionalText(res, body, field, label) {
  if (body[field] === undefined || body[field] === null) return true;
  if (typeof body[field] !== 'string') return fail(res, field, `${label} must be text`);
  return true;
}

function validateJob(res, body, create) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(res, null, 'Job details must be an object');
  if (!positiveId(res, body.customer_id, 'customer_id', { required: create })) return false;
  if (!positiveId(res, body.vehicle_id, 'vehicle_id', { required: create })) return false;
  if (!positiveId(res, body.employee_id, 'employee_id')) return false;
  if (!positiveId(res, body.estimate_id, 'estimate_id')) return false;
  if (!isoDate(res, body, 'date', { required: create, label: 'Job date' })) return false;
  for (const [field, label] of [['service','Service'],['notes','Notes'],['complaint','Complaint'],['diagnosis','Diagnosis'],['service_address','Service address']]) {
    if (!validateOptionalText(res, body, field, label)) return false;
  }
  if (body.status !== undefined && !JOB_STATUSES.has(body.status)) return fail(res, 'status', 'Work order status is not supported');
  if (body.invoice_status !== undefined && !INVOICE_STATUSES.has(body.invoice_status)) return fail(res, 'invoice_status', 'Invoice status is not supported');
  for (const field of ['miles','labor','labor_hours','labor_rate','parts','discount','travel_fee','parts_deposit_required']) if (!nonNegativeNumber(res, body, field, { label: field.replaceAll('_', ' ') })) return false;
  if (body.miles !== undefined && body.miles !== null && body.miles !== '' && !Number.isInteger(Number(body.miles))) return fail(res, 'miles', 'Mileage must be a whole number');
  if (body.items !== undefined && !Array.isArray(body.items)) return fail(res, 'items', 'Items must be an array');
  for (const item of body.items || []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return fail(res, 'items', 'Each item must be an object');
    if (!normalizedItemType(item.type)) return fail(res, 'type', 'Item type is not supported');
    if (!validateOptionalText(res, item, 'description', 'Item description')) return false;
    for (const field of ['qty','rate','amount']) if (!nonNegativeNumber(res, item, field, { label: `Item ${field}` })) return false;
    if (item.qty !== undefined && Number(item.qty) <= 0) return fail(res, 'qty', 'Item quantity must be greater than zero');
    if (!positiveId(res, item.inventory_id, 'inventory_id')) return false;
  }
  if (body.repair_order_number !== undefined) {
    if (typeof body.repair_order_number !== 'string') return fail(res, 'repair_order_number', 'Repair order number must be text');
    body.repair_order_number = body.repair_order_number.trim();
    if (!create && !body.repair_order_number) return fail(res, 'repair_order_number', 'Repair order number is required');
    if (body.repair_order_number.length > 80) return fail(res, 'repair_order_number', 'Repair order number must be 80 characters or fewer');
    if (body.repair_order_number && !/^RO-\d{4,}$/i.test(body.repair_order_number)) return fail(res, 'repair_order_number', 'Repair order number must use RO-#### format');
    body.repair_order_number = body.repair_order_number.toUpperCase();
  }
  return true;
}

function serviceFromItems(items = []) {
  return items.map(item => String(item.description || '').trim()).filter(Boolean).join(', ').slice(0, 255);
}

function nextRepairOrderNumber(req) {
  const tenant = customerTenantWhere(req, 'c');
  const rows = db.prepare(`
    SELECT j.repair_order_number FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE ${tenant.clause}
  `).all(...tenant.values);
  const highest = rows.reduce((max, job) => {
    const match = String(job.repair_order_number || '').trim().match(/^RO-(\d+)$/i);
    if (!match) return max;
    const number = Number(match[1]);
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 1000);
  return `RO-${String(highest + 1).padStart(4, '0')}`;
}

function repairOrderInUse(req, repairOrderNumber, excludeId = null) {
  const tenant = customerTenantWhere(req, 'c');
  return db.prepare(`
    SELECT j.id FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE upper(j.repair_order_number) = upper(?)
      AND (? IS NULL OR j.id <> ?)
      AND ${tenant.clause}
    LIMIT 1
  `).get(repairOrderNumber, excludeId, excludeId, ...tenant.values);
}

function savedJobRecord(req, jobId) {
  const tenant = customerTenantWhere(req, 'c');
  const job = db.prepare(`
    SELECT j.*, c.first, c.last, c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address,
           v.year, v.make, v.model, v.plate, v.state AS vehicle_state, v.vin AS vehicle_vin, v.miles AS vehicle_mileage,
           e.first AS emp_first, e.last AS emp_last
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles v ON j.vehicle_id = v.id
    LEFT JOIN employees e ON j.employee_id = e.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND ${tenant.clause}
  `).get(jobId, ...tenant.values);
  if (!job) return null;
  job.items = db.prepare('SELECT * FROM job_items WHERE job_id = ? ORDER BY id').all(job.id);
  return job;
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const jobs = db.prepare(`
    SELECT j.*, c.first, c.last, c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address,
           v.year, v.make, v.model, v.plate, v.state AS vehicle_state, v.vin AS vehicle_vin,
           e.first AS emp_first, e.last AS emp_last
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles  v ON j.vehicle_id  = v.id
    LEFT JOIN employees e ON j.employee_id = e.id
    WHERE j.deleted_at IS NULL AND ${tenant.clause}
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
    SELECT j.labor, j.parts, j.discount, j.travel_fee, j.tax_rate
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const paid = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.job_id = ? AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values).total;

  const items = db.prepare('SELECT * FROM job_items WHERE job_id = ?').all(req.params.id);
  const currentTaxRate = Number(job.tax_rate ?? billingSettings(req).tax_rate) || 0;
  let laborTotal, partsTotal;
  if (items.length > 0) {
    laborTotal = items.filter(i => !i.taxable).reduce((a, i) => a + (i.amount || 0), 0);
    partsTotal = items.filter(i => i.taxable).reduce((a, i) => a + (i.amount || 0), 0);
  } else {
    laborTotal = job.labor || 0;
    partsTotal = job.parts || 0;
  }
  const totals = calculateJobTotals(laborTotal, partsTotal, job.travel_fee, job.discount, currentTaxRate);
  res.json({ total: totals.total, paid, balance: Math.max(0, totals.total - paid), labor_total: laborTotal, parts_total: partsTotal, discount: totals.discount, tax: totals.tax });
});

function billingSettings(req) {
  const shopId = resolveShopId(req);
  return (shopId ? db.prepare('SELECT tax_rate, default_pay_method FROM shop_settings WHERE shop_id = ?').get(shopId) : null)
    || db.prepare('SELECT tax_rate, default_pay_method FROM settings WHERE id = 1').get()
    || {};
}

function jobGrandTotal(req, labor, parts, travelFee, discount, savedTaxRate) {
  const taxRate = Number(savedTaxRate ?? billingSettings(req).tax_rate) || 0;
  return calculateJobTotals(labor, parts, travelFee, discount, taxRate).total;
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
  const existing = db.prepare('SELECT * FROM job_items WHERE job_id=?').all(jobId);
  const existingById = new Map(existing.map(item => [Number(item.id), item]));
  const kept = new Set();
  const ins = db.prepare(`INSERT INTO job_items (job_id, type, description, qty, rate, amount, taxable, inventory_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`UPDATE job_items SET type=?,description=?,qty=?,rate=?,amount=?,taxable=?,inventory_id=? WHERE id=? AND job_id=?`);
  (items || []).forEach(i => {
    const old = existingById.get(Number(i.id));
    if (old) {
      update.run(i.type||'labor',i.description||'',i.qty??1,i.rate??0,i.amount??0,i.taxable?1:0,i.inventory_id||null,old.id,jobId);
      kept.add(old.id);
      if (Math.abs(Number(old.amount||0)-Number(i.amount||0))>.004) {
        const latest = db.prepare(`SELECT * FROM service_authorizations WHERE job_id=? AND item_type='job_item' AND item_id=? ORDER BY id DESC LIMIT 1`).get(jobId,old.id);
        if (latest && latest.status==='approved') db.prepare(`INSERT INTO service_authorizations (shop_id,job_id,item_type,item_id,status,authorization_method,customer_name,signature,authorized_price,notes,employee_id,authorized_at) VALUES (?,?, 'job_item',?,'pending','','','',?,'Price changed after authorization',NULL,NULL)`).run(latest.shop_id,jobId,old.id,Number(i.amount)||0);
      }
    } else kept.add(Number(ins.run(jobId,i.type||'labor',i.description||'',i.qty??1,i.rate??0,i.amount??0,i.taxable?1:0,i.inventory_id||null).lastInsertRowid));
  });
  for (const old of existing) if (!kept.has(Number(old.id))) {
    db.prepare(`UPDATE deferred_services SET status='dismissed',resolved_at=datetime('now') WHERE source_type='job_item' AND source_item_id=? AND status='open'`).run(old.id);
    db.prepare('DELETE FROM job_items WHERE id=?').run(old.id);
  }
});

function inventoryQuantities(items = []) {
  const quantities = new Map();
  items.filter(item => item.inventory_id && isTaxablePart(item)).forEach(item => {
    const id = Number(item.inventory_id);
    quantities.set(id, (quantities.get(id) || 0) + Number(item.qty || 0));
  });
  return quantities;
}

function applyInventoryItemChanges(req, previousItems = [], nextItems = []) {
  const previous = inventoryQuantities(previousItems);
  const next = inventoryQuantities(nextItems);
  const updates = [];
  const tenant = shopTenantWhere(req, 'pi');
  const lookup = db.prepare(`SELECT pi.id, pi.name, pi.quantity FROM parts_inventory pi WHERE pi.id=? AND ${tenant.clause}`);
  const update = db.prepare(`UPDATE parts_inventory AS pi SET quantity=quantity-? WHERE pi.id=? AND ${tenant.clause}`);
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const change = (next.get(id) || 0) - (previous.get(id) || 0);
    if (Math.abs(change) < 1e-9) continue;
    const inventory = lookup.get(id, ...tenant.values);
    if (!inventory) {
      const error = new Error('An item references inventory that no longer exists');
      error.status = 400;
      error.field = 'inventory_id';
      throw error;
    }
    if (change > 0 && Number(inventory.quantity) + 1e-9 < change) {
      const error = new Error(`Insufficient inventory for ${inventory.name || 'repair-order item'}: ${inventory.quantity} available, ${change} required`);
      error.status = 409;
      error.field = 'inventory_id';
      throw error;
    }
    update.run(change, id, ...tenant.values);
    updates.push({ id, quantity: Number(lookup.get(id, ...tenant.values).quantity) });
  }
  return updates;
}

function advanceVehicleMileage(vehicleId, mileage) {
  const nextMileage = Number(mileage);
  if (!Number.isFinite(nextMileage) || nextMileage < 0) return;
  db.prepare(`
    UPDATE vehicles
    SET miles = ?
    WHERE id = ? AND deleted_at IS NULL AND ? > COALESCE(miles, 0)
  `).run(nextMileage, vehicleId, nextMileage);
}

const createJob = db.transaction((req, values, items, automaticPayment, vehicleMileage) => {
  const result = db.prepare(`
    INSERT INTO jobs
      (customer_id, vehicle_id, service, repair_order_number, date, miles, labor, labor_hours, labor_rate,
       parts, discount, tax_rate, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
       service_address, travel_fee, parts_deposit_required, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(...values);
  const jobId = result.lastInsertRowid;
  let inventoryUpdates = [];
  if (items && items.length) {
    inventoryUpdates = applyInventoryItemChanges(req, [], items);
    saveJobItems(jobId, items);
  }
  advanceVehicleMileage(vehicleMileage.vehicleId, vehicleMileage.miles);
  const payment = automaticPayment ? insertAutomaticJobPayment(jobId, automaticPayment.customer, automaticPayment.amount, automaticPayment.method, automaticPayment.date, automaticPayment.repairOrderNumber, automaticPayment.service) : null;
  reconcileJobInvoiceStatus(db, jobId);
  return { jobId, payment, inventoryUpdates };
});

router.post('/', (req, res) => {
  if (!validateJob(res, req.body, true)) return;
  let {
    customer_id, vehicle_id, service, repair_order_number, date, miles, labor, labor_hours, labor_rate,
    parts, discount, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee, parts_deposit_required, items
  } = req.body;
  items = items === undefined ? undefined : normalizeLineItems(items);
  if (!String(service || '').trim() && items !== undefined) service = serviceFromItems(items);

  repair_order_number = repair_order_number || nextRepairOrderNumber(req);
  if (repairOrderInUse(req, repair_order_number)) return fail(res, 'repair_order_number', 'Repair order number is already in use', 409);

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
  const totals = (items && items.length) ? lineItemTotals(items) : null;
  const laborVal = totals ? totals.labor : (labor || 0);
  const partsVal = totals ? totals.parts : (parts || 0);
  const laborHoursVal = totals ? totals.laborHours : (parseFloat(labor_hours) || 0);
  const laborRateVal = totals ? totals.laborRate : (parseFloat(labor_rate) || 0);

  const settings = billingSettings(req);
  const effectiveTaxRate = Number(settings.tax_rate) || 0;
  const jobTaxRate = isTerminal || invoice_status === 'Paid' ? effectiveTaxRate : null;
  if (Number(parts_deposit_required || 0) > 0 && ['In Progress', 'Complete'].includes(status) && invoice_status !== 'Paid') {
    return fail(res, 'parts_deposit_required', 'Required parts deposit must be paid before work can begin', 409);
  }
  const paidOnCreate = invoice_status === 'Paid' ? {
    customer: cust,
    amount: jobGrandTotal(req, laborVal, partsVal, travel_fee, discount, effectiveTaxRate),
    method: settings.default_pay_method || 'Cash',
    date: localDateKey(),
    repairOrderNumber: repair_order_number || '',
    service: service || '',
  } : null;
  const created = createJob(req, [
    customer_id, vehicle_id, service, repair_order_number || '', date, miles || 0,
    laborVal, laborHoursVal, laborRateVal,
    partsVal, discount || 0, jobTaxRate, status || 'Pending', notes || '', employee_id || null,
    complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
    service_address || '', travel_fee || 0, parts_deposit_required || 0, closedAt
  ], items, paidOnCreate, { vehicleId: vehicle_id, miles: miles || 0 });
  const savedJob = savedJobRecord(req, created.jobId);
  res.json({ ...savedJob, payment: created.payment, inventory_updates: created.inventoryUpdates });
});

router.put('/:id', (req, res) => {
  if (!validateJob(res, req.body, false)) return;
  let {
    service, repair_order_number, date, miles, labor, labor_hours, labor_rate, parts, discount, status, notes,
    employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee, parts_deposit_required, items
  } = req.body;
  items = items === undefined ? undefined : normalizeLineItems(items);

  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT j.*, c.first, c.last
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Job not found' });
  if (req.body.customer_id !== undefined && Number(req.body.customer_id) !== Number(current.customer_id)) {
    return fail(res, 'customer_id', 'A repair order cannot be moved to a different customer', 409);
  }
  if (req.body.vehicle_id !== undefined && Number(req.body.vehicle_id) !== Number(current.vehicle_id)) {
    return fail(res, 'vehicle_id', 'A repair order cannot be moved to a different vehicle', 409);
  }
  service = service ?? current.service;
  if (!String(service || '').trim() && items !== undefined) service = serviceFromItems(items);
  repair_order_number = repair_order_number ?? current.repair_order_number;
  date = date ?? current.date;
  miles = miles ?? current.miles;
  labor = labor ?? current.labor;
  labor_hours = labor_hours ?? current.labor_hours;
  labor_rate = labor_rate ?? current.labor_rate;
  parts = parts ?? current.parts;
  discount = discount ?? current.discount;
  status = status ?? current.status;
  notes = notes ?? current.notes;
  employee_id = employee_id === undefined ? current.employee_id : employee_id;
  complaint = complaint ?? current.complaint;
  diagnosis = diagnosis ?? current.diagnosis;
  invoice_status = invoice_status ?? current.invoice_status;
  estimate_id = estimate_id === undefined ? current.estimate_id : estimate_id;
  service_address = service_address ?? current.service_address;
  travel_fee = travel_fee ?? current.travel_fee;
  parts_deposit_required = parts_deposit_required ?? current.parts_deposit_required;
  if (repair_order_number && repair_order_number.toUpperCase() !== String(current.repair_order_number || '').toUpperCase()
      && repairOrderInUse(req, repair_order_number, Number(req.params.id))) {
    return fail(res, 'repair_order_number', 'Repair order number is already in use', 409);
  }

  if (employee_id && Number(employee_id) !== Number(current.employee_id) && !employeeInTenant(req, employee_id)) {
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

  const updatedTotals = items !== undefined ? lineItemTotals(items || []) : null;
  const laborVal = updatedTotals ? updatedTotals.labor : (Number(labor) || 0);
  const partsVal = updatedTotals ? updatedTotals.parts : (Number(parts) || 0);
  const laborHoursVal = updatedTotals ? updatedTotals.laborHours : (Number(labor_hours) || 0);
  const laborRateVal = updatedTotals ? updatedTotals.laborRate : (Number(labor_rate) || 0);
  const shouldRecordPayment = req.body.invoice_status === 'Paid';
  const paidToDate = shouldRecordPayment
    ? Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE job_id = ?').get(req.params.id).total) || 0
    : 0;
  const settings = billingSettings(req);
  const effectiveTaxRate = Number(current.tax_rate ?? settings.tax_rate) || 0;
  const jobTaxRate = isTerminal || invoice_status === 'Paid' ? effectiveTaxRate : current.tax_rate;
  const remainingBalance = shouldRecordPayment
    ? Math.max(0, Math.round((jobGrandTotal(req, laborVal, partsVal, travel_fee, discount, effectiveTaxRate) - paidToDate + Number.EPSILON) * 100) / 100)
    : 0;
  const depositPaid = Number(db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE job_id=?').get(req.params.id).total) || 0;
  if (Number(parts_deposit_required || 0) > depositPaid + .005 && ['In Progress', 'Complete'].includes(status) && invoice_status !== 'Paid') {
    return fail(res, 'parts_deposit_required', `Required parts deposit has ${Math.max(0, Number(parts_deposit_required) - depositPaid).toFixed(2)} remaining`, 409);
  }
  let automaticPayment = null;
  let inventoryUpdates = [];
  const previousItems = items === undefined ? null : db.prepare('SELECT * FROM job_items WHERE job_id=?').all(req.params.id);

  db.transaction(() => {
    db.prepare(`
      UPDATE jobs
      SET service=?, repair_order_number=?, date=?, miles=?, labor=?, labor_hours=?, labor_rate=?, parts=?, discount=?, tax_rate=?,
          status=?, notes=?, employee_id=?, complaint=?, diagnosis=?, invoice_status=?,
          estimate_id=?, service_address=?, travel_fee=?, parts_deposit_required=?, closed_at=?
      WHERE id=?
    `).run(
      service, repair_order_number || '', date, miles || 0,
      laborVal, laborHoursVal, laborRateVal,
      partsVal, discount || 0, jobTaxRate, status || 'Pending', notes || '', employee_id || null,
      complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
      service_address || '', travel_fee || 0, parts_deposit_required || 0, closedAt,
      req.params.id
    );
    if (items !== undefined) {
      inventoryUpdates = applyInventoryItemChanges(req, previousItems, items || []);
      saveJobItems(req.params.id, items || []);
    }
    advanceVehicleMileage(current.vehicle_id, miles || 0);
    if (shouldRecordPayment && remainingBalance > 0) {
      automaticPayment = insertAutomaticJobPayment(
        Number(req.params.id),
        { id: current.customer_id, first: current.first, last: current.last },
        remainingBalance,
        settings.default_pay_method || 'Cash',
        localDateKey(),
        repair_order_number || '',
        service || ''
      );
    }
    reconcileJobInvoiceStatus(db, Number(req.params.id), effectiveTaxRate);
  })();
  const savedJob = savedJobRecord(req, req.params.id);
  res.json({ ...savedJob, success: true, payment: automaticPayment, inventory_updates: inventoryUpdates });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const job = db.prepare(`
    SELECT j.id FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const payment = db.prepare('SELECT id FROM payments WHERE job_id=? LIMIT 1').get(job.id);
  if (payment) return res.status(409).json({ error: 'This repair order has payment history and cannot be deleted. Cancel or void it to preserve the financial record.' });
  const plan = db.prepare('SELECT id FROM payment_plans WHERE job_id=? LIMIT 1').get(job.id);
  if (plan) return res.status(409).json({ error: 'This repair order has a payment plan and cannot be deleted. Remove the payment plan first.' });
  const result = db.transaction(() => {
    const existingItems = db.prepare('SELECT * FROM job_items WHERE job_id=?').all(job.id);
    const inventoryUpdates = applyInventoryItemChanges(req, existingItems, []);
    const deleted = db.prepare('UPDATE jobs SET deleted_at = datetime(\'now\') WHERE id = ? AND deleted_at IS NULL').run(job.id);
    return { deleted, inventoryUpdates };
  })();
  if (!result.deleted.changes) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true, inventory_updates: result.inventoryUpdates });
});

module.exports = router;
