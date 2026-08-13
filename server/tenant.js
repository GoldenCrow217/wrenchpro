const db = require('./database');

// Tenant helpers for the desktop-to-SaaS bridge.
//
// Desktop/local mode intentionally stays permissive when no shop context is
// requested so existing offline users keep seeing their local records. When a
// request does opt into a shop context, all shop-scoped reads/writes are
// filtered to that shop and the selected shop must exist. If an email is
// supplied, it must match an active shop membership; this gives the hosted
// auth layer a safe enforcement point without exposing Supabase secrets here.
const SHOP_HEADER = 'x-wrenchpro-shop-id';
const EMAIL_HEADER = 'x-wrenchpro-user-email';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function requestedShopId(req) {
  const headerValue = req?.headers?.[SHOP_HEADER];
  if (headerValue !== undefined && headerValue !== '') return parsePositiveInteger(headerValue);
  if (String(process.env.ALLOW_DEFAULT_SHOP || '').toLowerCase() === 'true') {
    return parsePositiveInteger(process.env.DEFAULT_SHOP_ID);
  }
  return null;
}

function hasRequestedShopId(req) {
  return req?.headers?.[SHOP_HEADER] !== undefined && req?.headers?.[SHOP_HEADER] !== '';
}

function requestedUserEmail(req) {
  return normalizeEmail(req?.headers?.[EMAIL_HEADER]);
}

function shopExists(shopId) {
  if (!shopId) return false;
  return Boolean(db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId));
}

function membershipFor(shopId, email) {
  if (!shopId || !email) return null;
  return db.prepare(`
    SELECT * FROM shop_memberships
    WHERE shop_id = ? AND lower(email) = lower(?)
  `).get(shopId, email);
}

function validateRequestedShopContext(req, res, next) {
  const rawShopHeader = req?.headers?.[SHOP_HEADER];
  if (rawShopHeader !== undefined && rawShopHeader !== '' && !parsePositiveInteger(rawShopHeader)) {
    return res.status(400).json({ error: 'Shop context must be a positive integer', field: 'shop_id' });
  }

  const shopId = requestedShopId(req);
  if (!shopId) return next();
  if (!shopExists(shopId)) return res.status(404).json({ error: 'Shop context not found', field: 'shop_id' });

  const email = requestedUserEmail(req);
  if (email && !membershipFor(shopId, email)) {
    return res.status(403).json({ error: 'User is not a member of the selected shop' });
  }

  req.shopId = shopId;
  req.shopMembership = email ? membershipFor(shopId, email) : null;
  return next();
}

function resolveShopId(req) {
  return requestedShopId(req);
}

function qualifiedShopColumn(alias) {
  return alias ? `${alias}.shop_id` : 'shop_id';
}

function tenantWhere(req, alias = '') {
  const shopId = requestedShopId(req);
  if (!shopId) return { shopId: null, clause: '1=1', values: [] };
  return { shopId, clause: `${qualifiedShopColumn(alias)} = ?`, values: [shopId] };
}

function customerTenantWhere(req, alias = '') {
  return tenantWhere(req, alias);
}

function shopTenantWhere(req, alias = '') {
  return tenantWhere(req, alias);
}

function getTenantCustomer(req, customerId, alias = '') {
  const tenant = customerTenantWhere(req, alias);
  const prefix = alias ? `${alias}.` : '';
  const sql = `
    SELECT ${alias ? `${alias}.*` : '*'}
    FROM customers ${alias || ''}
    WHERE ${prefix}id = ? AND ${prefix}deleted_at IS NULL AND ${tenant.clause}
  `;
  const customer = db.prepare(sql).get(customerId, ...tenant.values);
  return { customer, tenant };
}

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  const tenant = shopTenantWhere(req);
  return Boolean(db.prepare(`SELECT id FROM employees WHERE id = ? AND ${tenant.clause}`).get(employeeId, ...tenant.values));
}

function inventoryItemsInTenant(req, items) {
  const ids = [...new Set((items || []).map(item => Number(item.inventory_id)).filter(id => Number.isInteger(id) && id > 0))];
  if (!ids.length) return true;
  const tenant = shopTenantWhere(req);
  const placeholders = ids.map(() => '?').join(',');
  const found = db.prepare(`SELECT COUNT(*) AS count FROM parts_inventory WHERE id IN (${placeholders}) AND ${tenant.clause}`).get(...ids, ...tenant.values).count;
  return found === ids.length;
}

module.exports = {
  requestedShopId,
  hasRequestedShopId,
  requestedUserEmail,
  validateRequestedShopContext,
  resolveShopId,
  customerTenantWhere,
  shopTenantWhere,
  getTenantCustomer,
  employeeInTenant,
  inventoryItemsInTenant,
};
