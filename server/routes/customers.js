const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, customerTenantWhere } = require('../tenant');
const { requiredText, positiveId } = require('../validation');

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req);
  const customers = db.prepare(`SELECT * FROM customers WHERE deleted_at IS NULL AND ${tenant.clause} ORDER BY last, first`).all(...tenant.values);
  res.json(customers);
});

router.get('/:id', (req, res) => {
  const tenant = customerTenantWhere(req);
  const customer = db.prepare(`SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE customer_id = ? AND deleted_at IS NULL').all(req.params.id);
  const jobs = db.prepare('SELECT * FROM jobs WHERE customer_id = ? AND deleted_at IS NULL ORDER BY date DESC').all(req.params.id);
  res.json({ ...customer, vehicles, jobs });
});

router.post('/', (req, res) => {
  const { first, last, phone, email, address, billing_address, notes, status, tags, customer_type, preferred_contact } = req.body;
  if (!requiredText(res, req.body, 'first', 'Customer first name')) return;
  if (!requiredText(res, req.body, 'last', 'Customer last name')) return;
  const shopId = resolveShopId(req);
  const result = db.prepare(
    'INSERT INTO customers (shop_id, first, last, phone, email, address, billing_address, notes, status, tags, customer_type, preferred_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(shopId, first, last, phone || '', email || '', address || '', billing_address || '', notes || '', status || 'Active', tags || '', customer_type || 'Personal', preferred_contact || 'Phone');
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.json(customer);
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  if (!requiredText(res, req.body, 'first', 'Customer first name')) return;
  if (!requiredText(res, req.body, 'last', 'Customer last name')) return;
  const { first, last, phone, email, address, billing_address, notes, status, tags, customer_type, preferred_contact } = req.body;
  const tenant = customerTenantWhere(req);
  const result = db.prepare(
    `UPDATE customers SET first=?, last=?, phone=?, email=?, address=?, billing_address=?, notes=?, status=?, tags=?, customer_type=?, preferred_contact=? WHERE id=? AND ${tenant.clause}`
  ).run(first, last, phone || '', email || '', address || '', billing_address || '', notes || '', status || 'Active', tags || '', customer_type || 'Personal', preferred_contact || 'Phone', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Customer not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req);
  const archiveCustomer = db.transaction(() => {
    const result = db.prepare(`UPDATE customers SET deleted_at = datetime('now') WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
    if (!result.changes) return false;
    db.prepare("UPDATE vehicles SET deleted_at = datetime('now') WHERE customer_id = ? AND deleted_at IS NULL").run(req.params.id);
    return true;
  });
  if (!archiveCustomer()) return res.status(404).json({ error: 'Customer not found' });
  res.json({ success: true });
});

module.exports = router;
