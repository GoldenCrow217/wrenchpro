const db = require('./database');

// Local-desktop compatibility helpers.
//
// Older database migrations and route queries include nullable shop_id columns.
// WrenchPro is a single-user, offline desktop application: request headers,
// accounts, memberships, and tenant selection never affect data visibility.
function requestedShopId() { return null; }
function hasRequestedShopId() { return false; }
function validateRequestedShopContext(req, res, next) { return next(); }
function resolveShopId() { return null; }
function customerTenantWhere() { return { shopId: null, clause: '1=1', values: [] }; }
function shopTenantWhere() { return { shopId: null, clause: '1=1', values: [] }; }

function getTenantCustomer(req, customerId, alias = '') {
  const tenant = customerTenantWhere();
  const prefix = alias ? `${alias}.` : '';
  const customer = db.prepare(`SELECT ${prefix || ''}* FROM customers ${alias ? alias : ''} WHERE ${prefix}id = ? AND ${prefix}deleted_at IS NULL AND ${tenant.clause}`)
    .get(customerId, ...tenant.values);
  return { customer, tenant };
}

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  return Boolean(db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId));
}

function inventoryItemsInTenant(req, items) {
  const ids = [...new Set((items || []).map(item => Number(item.inventory_id)).filter(Number.isInteger))];
  if (!ids.length) return true;
  const placeholders = ids.map(() => '?').join(',');
  const found = db.prepare(`SELECT COUNT(*) AS count FROM parts_inventory WHERE id IN (${placeholders})`).get(...ids).count;
  return found === ids.length;
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
