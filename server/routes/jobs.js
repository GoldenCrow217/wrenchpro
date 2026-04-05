const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, c.first, c.last, v.year, v.make, v.model, v.plate
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles v ON j.vehicle_id = v.id
    ORDER BY j.date DESC
  `).all();
  res.json(jobs);
});

router.post('/', (req, res) => {
  const { customer_id, vehicle_id, service, date, miles, labor, parts, status, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO jobs (customer_id, vehicle_id, service, date, miles, labor, parts, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, vehicle_id, service, date, miles || 0, labor || 0, parts || 0, status || 'Pending', notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { service, date, miles, labor, parts, status, notes } = req.body;
  db.prepare(`
    UPDATE jobs SET service=?, date=?, miles=?, labor=?, parts=?, status=?, notes=?
    WHERE id=?
  `).run(service, date, miles || 0, labor || 0, parts || 0, status || 'Pending', notes || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;