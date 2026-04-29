const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, e.first, e.last, j.service AS job_service
    FROM time_logs t
    JOIN employees e ON t.employee_id = e.id
    LEFT JOIN jobs j ON t.job_id = j.id
    ORDER BY t.clock_in DESC
  `).all());
});

router.post('/', (req, res) => {
  const { employee_id, job_id, type, clock_in, clock_out, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO time_logs (employee_id, job_id, type, clock_in, clock_out, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, job_id || null, type || 'general', clock_in, clock_out || null, notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { clock_out, notes } = req.body;
  db.prepare('UPDATE time_logs SET clock_out=?, notes=? WHERE id=?').run(clock_out || null, notes || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM time_logs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
