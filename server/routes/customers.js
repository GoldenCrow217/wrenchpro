const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY last, first').all();
  res.json(customers);
});

router.get('/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE customer_id = ?').all(req.params.id);
  const jobs = db.prepare('SELECT * FROM jobs WHERE customer_id = ? ORDER BY date DESC').all(req.params.id);
  res.json({ ...customer, vehicles, jobs });
});

router.post('/', (req, res) => {
  const { first, last, phone, email, address, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO customers (first, last, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(first, last, phone || '', email || '', address || '', notes || '');
  res.json({ id: result.lastInsertRowid, first, last, phone, email, address, notes });
});

router.put('/:id', (req, res) => {
  const { first, last, phone, email, address, notes } = req.body;
  db.prepare(
    'UPDATE customers SET first=?, last=?, phone=?, email=?, address=?, notes=? WHERE id=?'
  ).run(first, last, phone || '', email || '', address || '', notes || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;