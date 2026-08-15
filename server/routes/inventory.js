const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere } = require('../tenant');
const { requiredText, nonNegativeNumber, positiveId } = require('../validation');

function validatePart(res, body) {
  if (!requiredText(res, body, 'name', 'Part name')) return false;
  for (const [field, label] of [['cost','Cost'],['retail_price','Retail price'],['quantity','Quantity'],['reorder_qty','Reorder quantity']]) {
    if (!nonNegativeNumber(res, body, field, { label })) return false;
  }
  return true;
}

router.get('/', (req, res) => {
  const tenant = shopTenantWhere(req);
  res.json(db.prepare(`SELECT * FROM parts_inventory WHERE ${tenant.clause} ORDER BY name`).all(...tenant.values));
});

router.post('/', (req, res) => {
  if (!validatePart(res, req.body)) return;
  const { name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes } = req.body;
  const shopId = resolveShopId(req);
  const result = db.prepare(`
    INSERT INTO parts_inventory (shop_id, name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(shopId, name, part_number || '', vendor || '', cost || 0, retail_price || 0, quantity || 0, reorder_qty || 0, location || '', notes || '');
  res.json({ id: result.lastInsertRowid, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  if (!validatePart(res, req.body)) return;
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
  const part = db.prepare(`SELECT id FROM parts_inventory WHERE id = ? AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!part) return res.status(404).json({ error: 'Inventory item not found' });
  const jobReferences = db.prepare('SELECT COUNT(*) AS count FROM job_items WHERE inventory_id = ?').get(part.id).count;
  const estimateReferences = db.prepare('SELECT COUNT(*) AS count FROM estimate_items WHERE inventory_id = ?').get(part.id).count;
  if (jobReferences || estimateReferences) {
    return res.status(409).json({
      error: 'This part is used on an existing repair order or estimate and cannot be permanently deleted.',
      field: 'id',
    });
  }
  const result = db.prepare(`DELETE FROM parts_inventory WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  res.json({ success: true });
});

module.exports = router;
