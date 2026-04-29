const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM parts_inventory ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO parts_inventory (name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, part_number || '', vendor || '', cost || 0, retail_price || 0, quantity || 0, reorder_qty || 0, location || '', notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes } = req.body;
  db.prepare(`
    UPDATE parts_inventory SET name=?, part_number=?, vendor=?, cost=?, retail_price=?, quantity=?, reorder_qty=?, location=?, notes=?
    WHERE id=?
  `).run(name, part_number || '', vendor || '', cost || 0, retail_price || 0, quantity || 0, reorder_qty || 0, location || '', notes || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM parts_inventory WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
