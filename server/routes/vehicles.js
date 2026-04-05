const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const vehicles = db.prepare(`
    SELECT v.*, c.first, c.last 
    FROM vehicles v 
    JOIN customers c ON v.customer_id = c.id
    ORDER BY v.year DESC
  `).all();
  res.json(vehicles);
});

router.post('/', (req, res) => {
  const { customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO vehicles (customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles || 0, oil_change_miles || 0, notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, notes } = req.body;
  db.prepare(`
    UPDATE vehicles SET year=?, make=?, model=?, trim=?, color=?, plate=?, state=?, vin=?, miles=?, oil_change_miles=?, notes=?
    WHERE id=?
  `).run(year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles || 0, oil_change_miles || 0, notes || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;