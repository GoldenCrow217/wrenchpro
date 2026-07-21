const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere } = require('../tenant');

router.get('/', (req, res) => {
  const tenant = shopTenantWhere(req);
  res.json(db.prepare(`SELECT * FROM parts_inventory WHERE ${tenant.clause} ORDER BY name`).all(...tenant.values));
});

router.post('/', (req, res) => {
  const { name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes } = req.body;
  const shopId = resolveShopId(req);
  const result = db.prepare(`
    INSERT INTO parts_inventory (shop_id, name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(shopId, name, part_number || '', vendor || '', cost || 0, retail_price || 0, quantity || 0, reorder_qty || 0, location || '', notes || '');
  res.json({ id: result.lastInsertRowid, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  const { name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes } = req.body;
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`
    UPDATE parts_inventory SET name=?, part_number=?, vendor=?, cost=?, retail_price=?, quantity=?, reorder_qty=?, location=?, notes=?
    WHERE id=? AND ${tenant.clause}
  `).run(name, part_number || '', vendor || '', cost || 0, retail_price || 0, quantity || 0, reorder_qty || 0, location || '', notes || '', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Inventory item not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`DELETE FROM parts_inventory WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Inventory item not found' });
  res.json({ success: true });
});

module.exports = router;
