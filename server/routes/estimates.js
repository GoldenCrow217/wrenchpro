const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere, employeeInTenant, inventoryItemsInTenant } = require('../tenant');
const { fail, finiteNumber, positiveId, isoDate } = require('../validation');
const { calculateEstimateTotals } = require('../pricing');

function validateEstimate(res, body, create) {
  if (create && !positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  if (create && !positiveId(res, body.vehicle_id, 'vehicle_id')) return false;
  if (!positiveId(res, body.employee_id, 'employee_id')) return false;
  if (create && !isoDate(res, body, 'date', { required: true, label: 'Estimate date' })) return false;
  if (!isoDate(res, body, 'expires_date', { label: 'Expiration date' })) return false;
  for (const field of ['miles','discount','tax_rate','total']) if (!finiteNumber(res, body, field, { label: field.replaceAll('_', ' ') })) return false;
  if (body.miles !== undefined && Number(body.miles) < 0) return fail(res, 'miles', 'Mileage cannot be negative');
  if (body.items !== undefined && !Array.isArray(body.items)) return fail(res, 'items', 'Items must be an array');
  for (const item of body.items || []) {
    for (const field of ['qty','rate','amount']) if (!finiteNumber(res, item, field, { label: `Item ${field}` })) return false;
    if (!positiveId(res, item.inventory_id, 'inventory_id')) return false;
  }
  return true;
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const estimates = db.prepare(`
    SELECT e.*, c.first, c.last, v.year, v.make, v.model,
           emp.first AS emp_first, emp.last AS emp_last
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN vehicles  v   ON e.vehicle_id  = v.id
    LEFT JOIN employees emp ON e.employee_id = emp.id
    WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY e.date DESC, e.id DESC
  `).all(...tenant.values);
  if (estimates.length) {
    const ids = estimates.map(e => e.id);
    const allItems = db.prepare(`
      SELECT ei.*, pi.name AS inventory_name
      FROM estimate_items ei
      LEFT JOIN parts_inventory pi ON ei.inventory_id = pi.id
      WHERE ei.estimate_id IN (${ids.map(() => '?').join(',')})
      ORDER BY ei.estimate_id, ei.id
    `).all(...ids);
    const itemMap = {};
    allItems.forEach(i => { (itemMap[i.estimate_id] = itemMap[i.estimate_id] || []).push(i); });
    estimates.forEach(e => { e.items = itemMap[e.id] || []; });
  }
  res.json(estimates);
});

function nextEstimateNumber(req) {
  const tenant = customerTenantWhere(req, 'c');
  const estimates = db.prepare(`
    SELECT e.estimate_number
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    WHERE ${tenant.clause}
  `).all(...tenant.values);
  const highest = estimates.reduce((max, estimate) => {
    const match = String(estimate.estimate_number || '').trim().match(/^EST-(\d+)$/i);
    if (!match) return max;
    const number = Number(match[1]);
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 1000);
  return `EST-${String(highest + 1).padStart(4, '0')}`;
}

function advanceEstimateVehicleMileage(vehicleId, mileage) {
  const nextMileage = Number(mileage);
  if (!vehicleId || !Number.isFinite(nextMileage) || nextMileage < 0) return;
  db.prepare(`UPDATE vehicles SET miles=? WHERE id=? AND deleted_at IS NULL AND ? > COALESCE(miles,0)`)
    .run(nextMileage, vehicleId, nextMileage);
}

const createEstimate = db.transaction((req, values) => {
  const num = nextEstimateNumber(req);
  const total = calculateEstimateTotals(values.items || [], values.discount, values.tax_rate).total;
  const result = db.prepare(`
    INSERT INTO estimates
      (customer_id, vehicle_id, employee_id, estimate_number, date, miles, status, notes,
       customer_complaint, discount, tax_rate, expires_date, total, approved_by, approval_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    values.customer_id, values.vehicle_id || null, values.employee_id || null, num, values.date, values.miles || 0,
    values.status || 'Draft', values.notes || '', values.customer_complaint || '',
    values.discount || 0, values.tax_rate || 0, values.expires_date || null, total || 0,
    values.approved_by || '', values.approval_notes || ''
  );
  const estId = result.lastInsertRowid;
  if (values.items && values.items.length) {
    const ins = db.prepare(`
      INSERT INTO estimate_items (estimate_id, type, description, qty, rate, amount, inventory_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    values.items.forEach(i => ins.run(estId, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0, i.inventory_id || null));
  }
  advanceEstimateVehicleMileage(values.vehicle_id, values.miles || 0);
  const vehicleMileage = values.vehicle_id ? db.prepare('SELECT miles FROM vehicles WHERE id=?').get(values.vehicle_id)?.miles : null;
  return { id: estId, estimate_number: num, total, vehicle_mileage: vehicleMileage };
});

router.post('/', (req, res) => {
  if (!validateEstimate(res, req.body, true)) return;
  const {
    customer_id, vehicle_id, employee_id, date, miles, status, notes,
    customer_complaint, discount, tax_rate, expires_date, items,
    approved_by, approval_notes
  } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const cust = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(customer_id, ...tenant.values);
  if (!cust) return fail(res, 'customer_id', 'Customer not found', 404);
  if (vehicle_id) {
    const veh = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
    if (!veh) return fail(res, 'vehicle_id', 'Vehicle not found or does not belong to this customer', 404);
  }
  if (!employeeInTenant(req, employee_id)) {
    return res.status(400).json({ error: 'Employee is outside the active shop context' });
  }
  if (!inventoryItemsInTenant(req, items)) {
    return res.status(400).json({ error: 'Estimate item inventory is outside the active shop context' });
  }

  const created = createEstimate(req, {
    customer_id, vehicle_id, employee_id, date, miles, status, notes,
    customer_complaint, discount, tax_rate, expires_date, items,
    approved_by, approval_notes,
  });
  res.json({ ...req.body, ...created });
});

router.put('/:id', (req, res) => {
  if (!validateEstimate(res, req.body, false)) return;
  const {
    status, notes, customer_complaint, miles, discount, tax_rate, expires_date, items,
    approved_by, approval_notes
  } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT e.approved_at, e.vehicle_id
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Estimate not found' });
  if (!inventoryItemsInTenant(req, items)) {
    return res.status(400).json({ error: 'Estimate item inventory is outside the active shop context' });
  }
  const totalItems = items === undefined
    ? db.prepare('SELECT type, amount FROM estimate_items WHERE estimate_id = ?').all(req.params.id)
    : items;
  const total = calculateEstimateTotals(totalItems, discount, tax_rate).total;

  const approvedAt = (status === 'Approved' && !current.approved_at)
    ? new Date().toISOString().replace('T', ' ').split('.')[0]
    : current.approved_at;

  db.transaction(() => {
    db.prepare(`
      UPDATE estimates
      SET status=?, notes=?, customer_complaint=?, miles=?, discount=?, tax_rate=?, expires_date=?, total=?,
          approved_at=?, approved_by=?, approval_notes=?
      WHERE id=?
    `).run(
      status || 'Draft', notes || '', customer_complaint || '', miles || 0,
      discount || 0, tax_rate || 0, expires_date || null, total || 0,
      approvedAt, approved_by || '', approval_notes || '',
      req.params.id
    );

    if (items !== undefined) {
      db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(req.params.id);
      const ins = db.prepare(`
        INSERT INTO estimate_items (estimate_id, type, description, qty, rate, amount, inventory_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      (items || []).forEach(i => ins.run(req.params.id, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0, i.inventory_id || null));
    }
    advanceEstimateVehicleMileage(current.vehicle_id, miles || 0);
  })();
  const vehicleMileage = current.vehicle_id ? db.prepare('SELECT miles FROM vehicles WHERE id=?').get(current.vehicle_id)?.miles : null;
  res.json({ success: true, vehicle_mileage: vehicleMileage });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`
    UPDATE estimates SET deleted_at = datetime('now')
    WHERE id IN (
      SELECT e.id FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Estimate not found' });
  res.json({ success: true });
});

router.post('/:id/convert', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const est = db.prepare(`
    SELECT e.*
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!est) return res.status(404).json({ error: 'Not found' });
  if (!est.vehicle_id) return res.status(400).json({ error: 'A vehicle must be selected on the estimate before converting to a job' });
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  const existingJob = db.prepare('SELECT id, repair_order_number FROM jobs WHERE estimate_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1').get(est.id);
  if (existingJob) {
    db.prepare(`UPDATE estimates SET status='Approved', approved_at=COALESCE(approved_at, ?) WHERE id=?`).run(now, est.id);
    return res.json({ job_id: existingJob.id, repair_order_number: existingJob.repair_order_number, already_converted: true });
  }
  const items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(est.id);
  const labor = items.filter(i => i.type === 'labor').reduce((a, i) => a + i.amount, 0);
  const parts = items.filter(i => i.type !== 'labor').reduce((a, i) => a + i.amount, 0);
  const service = items.map(i => i.description).filter(Boolean).join(', ').slice(0, 255) || est.customer_complaint || 'Service';
  const inventoryTenant = shopTenantWhere(req, 'pi');

  const doConvert = db.transaction(() => {
    const duplicate = db.prepare('SELECT id, repair_order_number FROM jobs WHERE estimate_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1').get(est.id);
    if (duplicate) {
      db.prepare(`UPDATE estimates SET status='Approved', approved_at=COALESCE(approved_at, ?) WHERE id=?`).run(now, est.id);
      return { jobId: duplicate.id, repairOrderNumber: duplicate.repair_order_number, alreadyConverted: true };
    }

    const requestedInventory = new Map();
    items.filter(i => i.inventory_id && i.type !== 'labor').forEach(i => {
      const qty = Number(i.qty) || 0;
      if (qty > 0) requestedInventory.set(i.inventory_id, (requestedInventory.get(i.inventory_id) || 0) + qty);
    });
    const inventoryLookup = db.prepare(`SELECT pi.id, pi.name, pi.quantity FROM parts_inventory AS pi WHERE pi.id = ? AND ${inventoryTenant.clause}`);
    for (const [inventoryId, requiredQty] of requestedInventory) {
      const inventory = inventoryLookup.get(inventoryId, ...inventoryTenant.values);
      if (!inventory) {
        const error = new Error('An estimate item references inventory that no longer exists');
        error.status = 400;
        throw error;
      }
      if (Number(inventory.quantity) < requiredQty) {
        const error = new Error(`Insufficient inventory for ${inventory.name || 'estimate item'}: ${inventory.quantity} available, ${requiredQty} required`);
        error.status = 409;
        throw error;
      }
    }

    const repairOrders = db.prepare(`
      SELECT j.repair_order_number
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      WHERE ${tenant.clause}
    `).all(...tenant.values);
    const highestRepairOrder = repairOrders.reduce((max, job) => {
      const match = String(job.repair_order_number || '').trim().match(/^RO-(\d+)$/i);
      if (!match) return max;
      const number = Number(match[1]);
      return Number.isSafeInteger(number) ? Math.max(max, number) : max;
    }, 1000);
    const repairOrderNumber = `RO-${String(highestRepairOrder + 1).padStart(4, '0')}`;

    const result = db.prepare(`
      INSERT INTO jobs (customer_id, vehicle_id, employee_id, service, repair_order_number, date, miles, labor, parts, status, notes, estimate_id, complaint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
    `).run(est.customer_id, est.vehicle_id, est.employee_id, service, repairOrderNumber, est.date, est.miles || 0, labor, parts, est.notes, est.id, est.customer_complaint);
    const jobId = result.lastInsertRowid;

    db.prepare(`UPDATE estimates SET status='Approved', approved_at=? WHERE id=? AND approved_at IS NULL`)
      .run(now, est.id);

    // Copy estimate items to job_items. Only part and shop-supply lines are taxable.
    if (items.length) {
      const insItem = db.prepare(`INSERT INTO job_items (job_id, type, description, qty, rate, amount, taxable, inventory_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      items.forEach(i => {
        const taxable = ['part', 'parts', 'shop_supply'].includes(String(i.type || '').toLowerCase()) ? 1 : 0;
        insItem.run(jobId, i.type, i.description, i.qty, i.rate, i.amount, taxable, i.inventory_id || null);
      });
    }

    const deduct = db.prepare(`UPDATE parts_inventory AS pi SET quantity = quantity - ? WHERE pi.id = ? AND ${inventoryTenant.clause}`);
    for (const [inventoryId, requiredQty] of requestedInventory) {
      deduct.run(requiredQty, inventoryId, ...inventoryTenant.values);
    }
    advanceEstimateVehicleMileage(est.vehicle_id, est.miles || 0);

    return { jobId, repairOrderNumber, alreadyConverted: false };
  });

  const converted = doConvert();
  res.json({ job_id: converted.jobId, repair_order_number: converted.repairOrderNumber, already_converted: converted.alreadyConverted });
});

module.exports = router;
