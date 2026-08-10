const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere } = require('../tenant');
const { fail, requiredText, finiteNumber, nonNegativeNumber, positiveId, isoDate } = require('../validation');

function validateExpense(res, body) {
  if (!(isoDate(res, body, 'date', { required: true, label: 'Date' })
    && requiredText(res, body, 'description', 'Description')
    && requiredText(res, body, 'category', 'Category')
    && finiteNumber(res, body, 'amount', { required: true, label: 'Amount' }))) return false;
  if (body.inventory === undefined) return true;
  const inventory = body.inventory;
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) return fail(res, 'inventory', 'Inventory details must be an object');
  if (body.category !== 'Parts & supplies') return fail(res, 'category', 'Only Parts & supplies expenses can be added to inventory');
  if (!positiveId(res, inventory.id, 'inventory.id')) return false;
  if (!inventory.id && !requiredText(res, inventory, 'name', 'Inventory item name')) return false;
  for (const [field, label] of [['quantity','Inventory quantity'],['cost','Inventory unit cost'],['retail_price','Inventory retail price']]) {
    if (!nonNegativeNumber(res, inventory, field, { required: true, label })) return false;
  }
  if (Number(inventory.quantity) <= 0) return fail(res, 'inventory.quantity', 'Inventory quantity must be greater than zero');
  return true;
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
  const inventory = req.body.inventory;
  let existingInventory = null;
  if (inventory?.id) {
    const tenant = shopTenantWhere(req, 'pi');
    existingInventory = db.prepare(`SELECT * FROM parts_inventory AS pi WHERE pi.id = ? AND ${tenant.clause}`).get(inventory.id, ...tenant.values);
    if (!existingInventory) return fail(res, 'inventory.id', 'Inventory item not found', 404);
  }
  const saveExpense = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO expenses (shop_id, date, description, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(shopId, date, description, category, amount, note || '');
    let inventoryItem = null;
    if (inventory && existingInventory) {
      db.prepare('UPDATE parts_inventory SET cost=?, retail_price=?, quantity=quantity+? WHERE id=?')
        .run(Number(inventory.cost), Number(inventory.retail_price), Number(inventory.quantity), existingInventory.id);
      inventoryItem = db.prepare('SELECT * FROM parts_inventory WHERE id = ?').get(existingInventory.id);
    } else if (inventory) {
      const inventoryResult = db.prepare(`
        INSERT INTO parts_inventory (shop_id, name, part_number, vendor, cost, retail_price, quantity, reorder_qty, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', '')
      `).run(shopId, inventory.name, inventory.part_number || '', inventory.vendor || '', Number(inventory.cost), Number(inventory.retail_price), Number(inventory.quantity));
      inventoryItem = db.prepare('SELECT * FROM parts_inventory WHERE id = ?').get(inventoryResult.lastInsertRowid);
    }
    return { id: result.lastInsertRowid, inventoryItem };
  });
  const saved = saveExpense();
  res.json({ id: saved.id, shop_id: shopId, date, description, category, amount, note: note || '', inventory_item: saved.inventoryItem });
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
