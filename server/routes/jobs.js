const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, c.first, c.last, v.year, v.make, v.model, v.plate,
           e.first AS emp_first, e.last AS emp_last
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles  v ON j.vehicle_id  = v.id
    LEFT JOIN employees e ON j.employee_id = e.id
    WHERE j.deleted_at IS NULL
    ORDER BY j.date DESC
  `).all();
  res.json(jobs);
});

router.get('/:id/balance', (req, res) => {
  const job = db.prepare('SELECT labor, parts, travel_fee FROM jobs WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const paid = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE job_id = ?').get(req.params.id).total;
  const total = (job.labor || 0) + (job.parts || 0) + (job.travel_fee || 0);
  res.json({ total, paid, balance: total - paid });
});

router.post('/', (req, res) => {
  const {
    customer_id, vehicle_id, service, date, miles, labor, labor_hours, labor_rate,
    parts, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee
  } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
  if (!vehicle_id)  return res.status(400).json({ error: 'Vehicle is required' });
  if (!date)        return res.status(400).json({ error: 'Date is required' });

  const cust = db.prepare('SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL').get(customer_id);
  if (!cust) return res.status(400).json({ error: 'Customer not found' });

  const veh = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
  if (!veh) return res.status(400).json({ error: 'Vehicle not found or does not belong to this customer' });

  const isTerminal = (status === 'Complete' || status === 'Canceled');
  const closedAt = isTerminal ? new Date().toISOString().replace('T', ' ').split('.')[0] : null;

  const result = db.prepare(`
    INSERT INTO jobs
      (customer_id, vehicle_id, service, date, miles, labor, labor_hours, labor_rate,
       parts, status, notes, employee_id, complaint, diagnosis, invoice_status, estimate_id,
       service_address, travel_fee, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id, vehicle_id, service, date, miles || 0,
    labor || 0, parseFloat(labor_hours) || 0, parseFloat(labor_rate) || 0,
    parts || 0, status || 'Pending', notes || '', employee_id || null,
    complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
    service_address || '', travel_fee || 0, closedAt
  );
  res.json({ id: result.lastInsertRowid, closed_at: closedAt, ...req.body });
});

router.put('/:id', (req, res) => {
  const {
    service, date, miles, labor, labor_hours, labor_rate, parts, status, notes,
    employee_id, complaint, diagnosis, invoice_status, estimate_id,
    service_address, travel_fee
  } = req.body;

  const current = db.prepare('SELECT closed_at FROM jobs WHERE id = ?').get(req.params.id);
  const isTerminal = status === 'Complete' || status === 'Canceled';
  const closedAt = (isTerminal && !(current && current.closed_at))
    ? new Date().toISOString().replace('T', ' ').split('.')[0]
    : (current ? current.closed_at : null);

  db.prepare(`
    UPDATE jobs
    SET service=?, date=?, miles=?, labor=?, labor_hours=?, labor_rate=?, parts=?,
        status=?, notes=?, employee_id=?, complaint=?, diagnosis=?, invoice_status=?,
        estimate_id=?, service_address=?, travel_fee=?, closed_at=?
    WHERE id=?
  `).run(
    service, date, miles || 0,
    labor || 0, parseFloat(labor_hours) || 0, parseFloat(labor_rate) || 0,
    parts || 0, status || 'Pending', notes || '', employee_id || null,
    complaint || '', diagnosis || '', invoice_status || 'Unpaid', estimate_id || null,
    service_address || '', travel_fee || 0, closedAt,
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare("UPDATE jobs SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
