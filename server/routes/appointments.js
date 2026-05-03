const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const appts = db.prepare(`
    SELECT a.*,
           c.first AS cust_first, c.last AS cust_last,
           v.year AS veh_year, v.make AS veh_make, v.model AS veh_model
    FROM appointments a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN vehicles  v ON a.vehicle_id  = v.id
    ORDER BY a.date, a.time
  `).all();
  res.json(appts);
});

router.post('/', (req, res) => {
  const { cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id } = req.body;
  const result = db.prepare(`
    INSERT INTO appointments (cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(cust || '', phone || '', service || '', date, time || '', customer_id || null, vehicle_id || null, address || '', notes || '', estimate_id || null);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id } = req.body;
  db.prepare(`
    UPDATE appointments
    SET cust=?, phone=?, service=?, date=?, time=?, customer_id=?, vehicle_id=?, address=?, notes=?, estimate_id=?
    WHERE id=?
  `).run(cust || '', phone || '', service || '', date, time || '', customer_id || null, vehicle_id || null, address || '', notes || '', estimate_id || null, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
