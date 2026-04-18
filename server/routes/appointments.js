const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM appointments ORDER BY date, time').all());
});

router.post('/', (req, res) => {
  const { cust, phone, service, date, time } = req.body;
  const result = db.prepare(
    'INSERT INTO appointments (cust, phone, service, date, time) VALUES (?, ?, ?, ?, ?)'
  ).run(cust || '', phone || '', service || '', date, time || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
