const express = require('express');
const router = express.Router();
const db = require('../database');
const { shopTenantWhere, customerTenantWhere } = require('../tenant');
const { fail, positiveId, localDateTime } = require('../validation');

function employeeInTenant(req, employeeId) {
  const tenant = shopTenantWhere(req, 'e');
  return db.prepare(`SELECT e.id FROM employees e WHERE e.id = ? AND e.deleted_at IS NULL AND ${tenant.clause}`).get(employeeId, ...tenant.values);
}

function jobInTenant(req, jobId) {
  if (!jobId) return true;
  const tenant = customerTenantWhere(req, 'c');
  return db.prepare(`
    SELECT j.id FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ? AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(jobId, ...tenant.values);
}

router.get('/', (req, res) => {
  const tenant = shopTenantWhere(req, 'e');
  res.json(db.prepare(`
    SELECT t.*, e.first, e.last, e.hourly_rate, j.service AS job_service, ji.description AS job_item_description
    FROM time_logs t
    JOIN employees e ON t.employee_id = e.id
    LEFT JOIN jobs j
      ON t.job_id = j.id
     AND j.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM customers c
       WHERE c.id = j.customer_id
         AND ((e.shop_id IS NULL AND c.shop_id IS NULL) OR e.shop_id = c.shop_id)
     )
    LEFT JOIN job_items ji ON ji.id=t.job_item_id AND ji.job_id=t.job_id
    WHERE ${tenant.clause}
    ORDER BY t.clock_in DESC
  `).all(...tenant.values));
});

router.post('/', (req, res) => {
  const { employee_id, job_id, job_item_id, type, clock_in, clock_out, notes } = req.body;
  if (!positiveId(res, employee_id, 'employee_id', { required: true })) return;
  if (!positiveId(res, job_id, 'job_id')) return;
  if (!positiveId(res, job_item_id, 'job_item_id')) return;
  if (!localDateTime(res, req.body, 'clock_in', { required: true, label: 'Clock-in time' })) return;
  if (!localDateTime(res, req.body, 'clock_out', { label: 'Clock-out time' })) return;
  if (clock_out && new Date(clock_out) < new Date(clock_in)) return fail(res, 'clock_out', 'Clock-out time cannot be before clock-in time');
  if (!employeeInTenant(req, employee_id)) return fail(res, 'employee_id', 'Employee not found', 404);
  if (!jobInTenant(req, job_id)) return fail(res, 'job_id', 'Job not found', 404);
  if (job_item_id && (!job_id || !db.prepare('SELECT id FROM job_items WHERE id=? AND job_id=?').get(job_item_id, job_id))) return fail(res, 'job_item_id', 'Labor operation not found on this job', 404);
  const result = db.prepare(`
    INSERT INTO time_logs (employee_id, job_id, job_item_id, type, clock_in, clock_out, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(employee_id, job_id || null, job_item_id || null, type || 'general', clock_in, clock_out || null, notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  const { clock_out, notes } = req.body;
  const tenant = shopTenantWhere(req, 'e');
  if (!localDateTime(res, req.body, 'clock_out', { label: 'Clock-out time' })) return;
  const current = db.prepare(`
    SELECT t.clock_in FROM time_logs t
    JOIN employees e ON t.employee_id=e.id
    WHERE t.id=? AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Time log not found' });
  if (clock_out && new Date(clock_out) < new Date(current.clock_in)) return fail(res, 'clock_out', 'Clock-out time cannot be before clock-in time');
  const result = db.prepare(`
    UPDATE time_logs SET clock_out=?, notes=?
    WHERE id IN (
      SELECT t.id FROM time_logs t
      JOIN employees e ON t.employee_id = e.id
      WHERE t.id = ? AND ${tenant.clause}
    )
  `).run(clock_out || null, notes || '', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Time log not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = shopTenantWhere(req, 'e');
  const result = db.prepare(`
    DELETE FROM time_logs
    WHERE id IN (
      SELECT t.id FROM time_logs t
      JOIN employees e ON t.employee_id = e.id
      WHERE t.id = ? AND ${tenant.clause}
    )
  `).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Time log not found' });
  res.json({ success: true });
});

module.exports = router;
