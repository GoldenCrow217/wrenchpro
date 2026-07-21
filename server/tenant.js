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

module.exports = {
  requestedShopId,
  hasRequestedShopId,
  validateRequestedShopContext,
  resolveShopId,
  customerTenantWhere,
  shopTenantWhere,
  getTenantCustomer,
};
