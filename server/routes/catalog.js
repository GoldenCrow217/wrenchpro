const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM service_catalog ORDER BY category, name').all());
});

router.post('/', (req, res) => {
  const { name, description, category, default_hours, default_price, taxable, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO service_catalog (name, description, category, default_hours, default_price, taxable, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || '', category || 'General', default_hours || 0, default_price || 0, taxable !== undefined ? (taxable ? 1 : 0) : 1, notes || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { name, description, category, default_hours, default_price, taxable, notes } = req.body;
  db.prepare(`
    UPDATE service_catalog SET name=?, description=?, category=?, default_hours=?, default_price=?, taxable=?, notes=?
    WHERE id=?
  `).run(name, description || '', category || 'General', default_hours || 0, default_price || 0, taxable !== undefined ? (taxable ? 1 : 0) : 1, notes || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM service_catalog WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
