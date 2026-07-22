const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere, resolveShopId, employeeInTenant, inventoryItemsInTenant } = require('../tenant');

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

const saveJobItems = db.transaction((jobId, items) => {
  db.prepare('DELETE FROM job_items WHERE job_id = ?').run(jobId);
  if (!items || !items.length) return;
  const ins = db.prepare(`INSERT INTO job_items (job_id, type, description, qty, rate, amount, taxable, inventory_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  items.forEach(i => ins.run(jobId, i.type || 'labor', i.description || '', i.qty || 1, i.rate || 0, i.amount || 0, i.taxable ? 1 : 0, i.inventory_id || null));
});

router.post('/', (req, res) => {
  const {
    customer_id, vehicle_id, service, date, miles, labor, labor_hours, labor_rate,
    parts, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee, items
  } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
  if (!vehicle_id)  return res.status(400).json({ error: 'Vehicle is required' });
  if (!date)        return res.status(400).json({ error: 'Date is required' });

  const tenant = customerTenantWhere(req, 'c');
  const cust = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(customer_id, ...tenant.values);
  if (!cust) return res.status(400).json({ error: 'Customer not found' });

  const veh = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
  if (!veh) return res.status(400).json({ error: 'Vehicle not found or does not belong to this customer' });

  if (!employeeInTenant(req, employee_id)) {
    return res.status(400).json({ error: 'Employee is outside the active shop context' });
  }

  if (!inventoryItemsInTenant(req, items)) {
    return res.status(400).json({ error: 'Inventory item is outside the active shop context' });
  }

  if (estimate_id) {
    const est = db.prepare('SELECT id FROM estimates WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(estimate_id, customer_id);
    if (!est) return res.status(400).json({ error: 'Estimate not found or does not belong to this customer' });
  }

  const isTerminal = (status === 'Complete' || status === 'Canceled');
  const closedAt = isTerminal ? new Date().toISOString().replace('T', ' ').split('.')[0] : null;

  // Compute labor/parts from items if provided, else use direct values
  const totals = (items && items.length) ? itemTotals(items) : null;
  const laborVal = totals ? totals.labor : (labor || 0);
  const partsVal = totals ? totals.parts : (parts || 0);

  const result = db.prepare(`
    INSERT INTO jobs
      (customer_id, vehicle_id, service, date, miles, labor, labor_hours, labor_rate,
       parts, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
       service_address, travel_fee, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id, vehicle_id, service, date, miles || 0,
    laborVal, parseFloat(labor_hours) || 0, parseFloat(labor_rate) || 0,
    partsVal, status || 'Pending', notes || '', employee_id || null,
    complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
    service_address || '', travel_fee || 0, closedAt
  );
  const jobId = result.lastInsertRowid;
  if (items && items.length) saveJobItems(jobId, items);
  res.json({ id: jobId, closed_at: closedAt, ...req.body });
});

router.put('/:id', (req, res) => {
  const {
    service, date, miles, labor, labor_hours, labor_rate, parts, status, notes,
    employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee, items
  } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT j.closed_at, j.customer_id
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Job not found' });

  if (!employeeInTenant(req, employee_id)) {
    return res.status(400).json({ error: 'Employee is outside the active shop context' });
  }

  if (!inventoryItemsInTenant(req, items)) {
    return res.status(400).json({ error: 'Inventory item is outside the active shop context' });
  }

  if (estimate_id) {
    const est = db.prepare('SELECT id FROM estimates WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(estimate_id, current.customer_id);
    if (!est) return res.status(400).json({ error: 'Estimate not found or does not belong to this job customer' });
  }

  const isTerminal = status === 'Complete' || status === 'Canceled';
  const closedAt = (isTerminal && !current.closed_at)
    ? new Date().toISOString().replace('T', ' ').split('.')[0]
    : current.closed_at;

  const updatedTotals = items !== undefined ? (() => { saveJobItems(req.params.id, items || []); return itemTotals(items || []); })() : null;
  const laborVal = updatedTotals ? updatedTotals.labor : (labor || 0);
  const partsVal = updatedTotals ? updatedTotals.parts : (parts || 0);

  db.prepare(`
    UPDATE jobs
    SET service=?, date=?, miles=?, labor=?, labor_hours=?, labor_rate=?, parts=?,
        status=?, notes=?, employee_id=?, complaint=?, diagnosis=?, invoice_status=?,
        estimate_id=?, service_address=?, travel_fee=?, closed_at=?
    WHERE id=?
  `).run(
    service, date, miles || 0,
    laborVal, parseFloat(labor_hours) || 0, parseFloat(labor_rate) || 0,
    partsVal, status || 'Pending', notes || '', employee_id || null,
    complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
    service_address || '', travel_fee || 0, closedAt,
    req.params.id
  );
  res.json({ success: true });
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
