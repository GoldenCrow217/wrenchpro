const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY last, first').all();
  res.json(customers);
});

router.get('/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE customer_id = ? AND deleted_at IS NULL').all(req.params.id);
  const jobs = db.prepare('SELECT * FROM jobs WHERE customer_id = ? AND deleted_at IS NULL ORDER BY date DESC').all(req.params.id);
  res.json({ ...customer, vehicles, jobs });
});

router.post('/', (req, res) => {
  const { first, last, phone, email, address, billing_address, notes, status, tags, customer_type, preferred_contact } = req.body;
  if (!first || !first.trim()) return res.status(400).json({ error: 'Customer first name is required' });
  if (!last  || !last.trim())  return res.status(400).json({ error: 'Customer last name is required' });
  const result = db.prepare(
    'INSERT INTO customers (first, last, phone, email, address, billing_address, notes, status, tags, customer_type, preferred_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(first, last, phone || '', email || '', address || '', billing_address || '', notes || '', status || 'Active', tags || '', customer_type || 'Personal', preferred_contact || 'Phone');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { first, last, phone, email, address, billing_address, notes, status, tags, customer_type, preferred_contact } = req.body;
  db.prepare(
    'UPDATE customers SET first=?, last=?, phone=?, email=?, address=?, billing_address=?, notes=?, status=?, tags=?, customer_type=?, preferred_contact=? WHERE id=?'
  ).run(first, last, phone || '', email || '', address || '', billing_address || '', notes || '', status || 'Active', tags || '', customer_type || 'Personal', preferred_contact || 'Phone', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare("UPDATE customers SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
