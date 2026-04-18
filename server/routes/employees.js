const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const employees = db.prepare('SELECT * FROM employees ORDER BY last, first').all();
  res.json(employees);
});

router.post('/', (req, res) => {
  const { first, last, phone, email, role, hourly_rate, status, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO employees (first, last, phone, email, role, hourly_rate, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    first, last,
    phone || '', email || '',
    role || 'Mechanic',
    parseFloat(hourly_rate) || 0,
    status || 'active',
    notes || ''
  );
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { first, last, phone, email, role, hourly_rate, status, notes } = req.body;
  db.prepare(
    'UPDATE employees SET first=?, last=?, phone=?, email=?, role=?, hourly_rate=?, status=?, notes=? WHERE id=?'
  ).run(
    first, last,
    phone || '', email || '',
    role || 'Mechanic',
    parseFloat(hourly_rate) || 0,
    status || 'active',
    notes || '',
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  // Unassign jobs before deleting
  db.prepare('UPDATE jobs SET employee_id = NULL WHERE employee_id = ?').run(req.params.id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
