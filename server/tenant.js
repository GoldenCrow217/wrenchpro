const db = require('./database');

function rawRequestedShopId(req) {
  return req.get('x-wrenchpro-shop-id') || req.query.shop_id || '';
}

function requestedShopId(req) {
  const raw = rawRequestedShopId(req);
  const parsed = Number(raw || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function hasRequestedShopId(req) {
  return Boolean(rawRequestedShopId(req));
}

function validateRequestedShopContext(req, res, next) {
  if (!hasRequestedShopId(req)) return next();

  const shopId = requestedShopId(req);
  if (!shopId) return res.status(400).json({ error: 'Invalid shop context' });

  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId);
  if (!shop) return res.status(404).json({ error: 'Shop context not found' });

  return next();
}

function resolveShopId(req) {
  if (req.activeShopId) return Number(req.activeShopId);

  const requested = requestedShopId(req);
  if (requested) {
    const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(requested);
    return shop ? shop.id : null;
  }
  const latest = db.prepare('SELECT id FROM shops ORDER BY id DESC LIMIT 1').get();
  return latest ? latest.id : null;
}

function customerTenantWhere(req, alias = '') {
  const shopId = resolveShopId(req);
  const prefix = alias ? `${alias}.` : '';
  if (!shopId) return { shopId: null, clause: `(${prefix}shop_id IS NULL)`, values: [] };
  return { shopId, clause: `(${prefix}shop_id = ?)`, values: [shopId] };
}

function shopTenantWhere(req, alias = '') {
  const shopId = resolveShopId(req);
  const prefix = alias ? `${alias}.` : '';
  if (!shopId) return { shopId: null, clause: `(${prefix}shop_id IS NULL)`, values: [] };
  return { shopId, clause: `(${prefix}shop_id = ?)`, values: [shopId] };
}

function getTenantCustomer(req, customerId, alias = '') {
  const tenant = customerTenantWhere(req, alias);
  const prefix = alias ? `${alias}.` : '';
  const customer = db.prepare(`SELECT ${prefix || ''}* FROM customers ${alias ? alias : ''} WHERE ${prefix}id = ? AND ${prefix}deleted_at IS NULL AND ${tenant.clause}`)
    .get(customerId, ...tenant.values);
  return { customer, tenant };
}

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  const tenant = shopTenantWhere(req, 'e');
  return Boolean(db.prepare(`SELECT e.id FROM employees e WHERE e.id = ? AND ${tenant.clause}`).get(employeeId, ...tenant.values));
}

function inventoryItemsInTenant(req, items = []) {
  const ids = [...new Set((items || []).map(i => i.inventory_id).filter(Boolean).map(Number))];
  if (!ids.length) return true;
  const tenant = shopTenantWhere(req, 'pi');
  const placeholders = ids.map(() => '?').join(',');
  const row = db.prepare(`SELECT COUNT(*) AS count FROM parts_inventory pi WHERE pi.id IN (${placeholders}) AND ${tenant.clause}`).get(...ids, ...tenant.values);
  return row.count === ids.length;
}

module.exports = {
  requestedShopId,
  hasRequestedShopId,
  validateRequestedShopContext,
  resolveShopId,
  customerTenantWhere,
  shopTenantWhere,
  getTenantCustomer,
  employeeInTenant,
  inventoryItemsInTenant,
};
