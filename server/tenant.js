const db = require('./database');

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

function employeeInTenant() { return true; }
function inventoryItemsInTenant() { return true; }

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
