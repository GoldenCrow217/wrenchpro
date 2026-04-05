const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { category, month } = req.query;
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (month) { query += ' AND date LIKE ?'; params.push(month + '%'); }
  query += ' ORDER BY date DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const { date, description, category, amount, note } = req.body;
  const result = db.prepare(
    'INSERT INTO expenses (date, description, category, amount, note) VALUES (?, ?, ?, ?, ?)'
  ).run(date, description, category, amount, note || '');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;