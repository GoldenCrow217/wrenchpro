const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const vehicles = db.prepare(`
    SELECT v.*, c.first, c.last
    FROM vehicles v
    JOIN customers c ON v.customer_id = c.id
    WHERE v.deleted_at IS NULL AND c.deleted_at IS NULL
    ORDER BY v.year DESC
  `).all();
  res.json(vehicles);
});

router.post('/', (req, res) => {
  const { customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
  const cust = db.prepare('SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL').get(customer_id);
  if (!cust) return res.status(400).json({ error: 'Customer not found' });
  const result = db.prepare(`
    INSERT INTO vehicles (customer_id, year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles || 0, oil_change_miles || 0, fuel_type || '', transmission || '', engine || '', notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { year, make, model, trim, color, plate, state, vin, miles, oil_change_miles, fuel_type, transmission, engine, notes } = req.body;
  db.prepare(`
    UPDATE vehicles SET year=?, make=?, model=?, trim=?, color=?, plate=?, state=?, vin=?, miles=?, oil_change_miles=?, fuel_type=?, transmission=?, engine=?, notes=?
    WHERE id=?
  `).run(year, make, model, trim || '', color || '', plate || '', state || '', vin || '', miles || 0, oil_change_miles || 0, fuel_type || '', transmission || '', engine || '', notes || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare("UPDATE vehicles SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
