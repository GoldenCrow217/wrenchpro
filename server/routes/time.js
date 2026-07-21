const express = require('express');
const router = express.Router();
const db = require('../database');
const { shopTenantWhere, customerTenantWhere } = require('../tenant');

function employeeInTenant(req, employeeId) {
  const tenant = shopTenantWhere(req, 'e');
  return db.prepare(`SELECT e.id FROM employees e WHERE e.id = ? AND ${tenant.clause}`).get(employeeId, ...tenant.values);
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
    SELECT t.*, e.first, e.last, j.service AS job_service
    FROM time_logs t
    JOIN employees e ON t.employee_id = e.id
    LEFT JOIN jobs j
      ON t.job_id = j.id
     AND j.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM customers c
       WHERE c.id = j.customer_id
         AND c.deleted_at IS NULL
         AND ((e.shop_id IS NULL AND c.shop_id IS NULL) OR e.shop_id = c.shop_id)
     )
    WHERE ${tenant.clause}
    ORDER BY t.clock_in DESC
  `).all(...tenant.values));
});

router.post('/', (req, res) => {
  const { employee_id, job_id, type, clock_in, clock_out, notes } = req.body;
  if (!employeeInTenant(req, employee_id)) return res.status(400).json({ error: 'Employee is outside the active shop context' });
  if (!jobInTenant(req, job_id)) return res.status(400).json({ error: 'Job is outside the active shop context' });
  const result = db.prepare(`
    INSERT INTO time_logs (employee_id, job_id, type, clock_in, clock_out, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, job_id || null, type || 'general', clock_in, clock_out || null, notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { clock_out, notes } = req.body;
  const tenant = shopTenantWhere(req, 'e');
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
