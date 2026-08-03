const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere } = require('../tenant');
const { requiredText, finiteNumber, positiveId, isoDate } = require('../validation');

function validateExpense(res, body) {
  return isoDate(res, body, 'date', { required: true, label: 'Date' })
    && requiredText(res, body, 'description', 'Description')
    && requiredText(res, body, 'category', 'Category')
    && finiteNumber(res, body, 'amount', { required: true, label: 'Amount' });
}

router.get('/', (req, res) => {
  const { category, month } = req.query;
  const tenant = shopTenantWhere(req);
  let query = `SELECT * FROM expenses WHERE ${tenant.clause}`;
  const params = [...tenant.values];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (month) { query += ' AND date LIKE ?'; params.push(month + '%'); }
  query += ' ORDER BY date DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  if (!validateExpense(res, req.body)) return;
  const { date, description, category, amount, note } = req.body;
  const shopId = resolveShopId(req);
  const result = db.prepare(
    'INSERT INTO expenses (shop_id, date, description, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(shopId, date, description, category, amount, note || '');
  res.json({ id: result.lastInsertRowid, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  if (!validateExpense(res, req.body)) return;
  const { date, description, category, amount, note } = req.body;
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`UPDATE expenses SET date=?, description=?, category=?, amount=?, note=? WHERE id=? AND ${tenant.clause}`)
    .run(date, description, category, amount, note || '', req.params.id, ...tenant.values);
  if (result.changes === 0) return res.status(404).json({ error: 'Expense not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`DELETE FROM expenses WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (result.changes === 0) return res.status(404).json({ error: 'Expense not found' });
  res.json({ success: true });
});

module.exports = router;
