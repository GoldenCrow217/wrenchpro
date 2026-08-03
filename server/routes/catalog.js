const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere } = require('../tenant');
const { requiredText, finiteNumber, positiveId } = require('../validation');

function validateCatalogItem(res, body) {
  return requiredText(res, body, 'name', 'Service name')
    && finiteNumber(res, body, 'default_hours', { label: 'Default hours' })
    && finiteNumber(res, body, 'default_price', { label: 'Default price' });
}

router.get('/', (req, res) => {
  const tenant = shopTenantWhere(req);
  res.json(db.prepare(`SELECT * FROM service_catalog WHERE ${tenant.clause} ORDER BY category, name`).all(...tenant.values));
});

router.post('/', (req, res) => {
  if (!validateCatalogItem(res, req.body)) return;
  const { name, description, category, default_hours, default_price, taxable, notes } = req.body;
  const shopId = resolveShopId(req);
  const result = db.prepare(`
    INSERT INTO service_catalog (shop_id, name, description, category, default_hours, default_price, taxable, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(shopId, name, description || '', category || 'General', default_hours || 0, default_price || 0, taxable !== undefined ? (taxable ? 1 : 0) : 1, notes || '');
  res.json({ id: result.lastInsertRowid, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  if (!validateCatalogItem(res, req.body)) return;
  const { name, description, category, default_hours, default_price, taxable, notes } = req.body;
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`
    UPDATE service_catalog SET name=?, description=?, category=?, default_hours=?, default_price=?, taxable=?, notes=?
    WHERE id=? AND ${tenant.clause}
  `).run(name, description || '', category || 'General', default_hours || 0, default_price || 0, taxable !== undefined ? (taxable ? 1 : 0) : 1, notes || '', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Catalog item not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`DELETE FROM service_catalog WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Catalog item not found' });
  res.json({ success: true });
});

module.exports = router;
