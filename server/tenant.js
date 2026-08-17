const crypto = require('crypto');
const db = require('./database');

// Tenant helpers for the desktop-to-SaaS bridge.
//
// Desktop/local mode intentionally stays permissive when no shop context is
// requested so existing offline users keep seeing their local records. When a
// request does opt into a shop context, all shop-scoped reads/writes are
// filtered to that shop and the selected shop must exist. Hosted/SaaS mode can
// additionally require a verified Supabase JWT before membership is trusted;
// this prevents a browser from spoofing membership headers against the API.
const SHOP_HEADER = 'x-wrenchpro-shop-id';
const EMAIL_HEADER = 'x-wrenchpro-user-email';
const REQUIRE_MEMBERSHIP = String(process.env.WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP || '').toLowerCase() === 'true';
const SUPABASE_JWT_SECRET = String(process.env.WRENCHPRO_SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '').trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.WRENCHPRO_SUPABASE_URL || '').replace(/\/$/, '');
const ACTIVE_ROLES = new Set(['owner', 'admin', 'mechanic', 'service_writer']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifiedBearerPayload(req) {
  if (!SUPABASE_JWT_SECRET) return null;
  const auth = String(req?.headers?.authorization || '').trim();
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Authorization bearer token is required');
    error.status = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, signature] = match[1].split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    const error = new Error('Invalid authorization token');
    error.status = 401;
    throw error;
  }

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch (_) {
    const error = new Error('Invalid authorization token');
    error.status = 401;
    throw error;
  }

  if (String(header.alg || '').toUpperCase() !== 'HS256') {
    const error = new Error('Unsupported authorization token algorithm');
    error.status = 401;
    throw error;
  }

  const expected = crypto
    .createHmac('sha256', SUPABASE_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  if (!timingSafeEqualText(signature, expected)) {
    const error = new Error('Invalid authorization token signature');
    error.status = 401;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub) {
    const error = new Error('Authorization token subject is required');
    error.status = 401;
    throw error;
  }
  if (!payload.exp || !Number.isFinite(Number(payload.exp))) {
    const error = new Error('Authorization token expiration is required');
    error.status = 401;
    throw error;
  }
  if (Number(payload.exp) <= now) {
    const error = new Error('Authorization token has expired');
    error.status = 401;
    throw error;
  }
  if (payload.nbf && Number(payload.nbf) > now) {
    const error = new Error('Authorization token is not active yet');
    error.status = 401;
    throw error;
  }
  const audience = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud || '')];
  if (!audience.includes('authenticated')) {
    const error = new Error('Authorization token audience is not trusted');
    error.status = 401;
    throw error;
  }
  if (SUPABASE_URL && String(payload.iss || '').replace(/\/$/, '') !== `${SUPABASE_URL}/auth/v1`) {
    const error = new Error('Authorization token issuer is not trusted');
    error.status = 401;
    throw error;
  }

  return payload;
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
  if (req?.authUser?.email) return normalizeEmail(req.authUser.email);
  return normalizeEmail(req?.headers?.[EMAIL_HEADER]);
}

function shopExists(shopId) {
  if (!shopId) return false;
  return Boolean(db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId));
}

function membershipFor(shopId, email, userId = '') {
  if (!shopId || (!email && !userId)) return null;
  const membership = userId
    ? db.prepare(`
      SELECT * FROM shop_memberships
      WHERE shop_id = ? AND (supabase_user_id = ? OR (? <> '' AND lower(email) = lower(?)))
    `).get(shopId, userId, email, email)
    : db.prepare(`
      SELECT * FROM shop_memberships
      WHERE shop_id = ? AND lower(email) = lower(?)
    `).get(shopId, email);
  if (!membership) return null;
  const role = String(membership.role || '').toLowerCase();
  return ACTIVE_ROLES.has(role) ? membership : null;
}

function validateRequestedShopContext(req, res, next) {
  try {
    const rawShopHeader = req?.headers?.[SHOP_HEADER];
    if (rawShopHeader !== undefined && rawShopHeader !== '' && !parsePositiveInteger(rawShopHeader)) {
      return res.status(400).json({ error: 'Shop context must be a positive integer', field: 'shop_id' });
    }

    const shopId = requestedShopId(req);
    if (!shopId) return next();
    if (!shopExists(shopId)) return res.status(404).json({ error: 'Shop context not found', field: 'shop_id' });

    const authPayload = verifiedBearerPayload(req);
    if (authPayload) {
      req.authUser = {
        id: String(authPayload.sub || ''),
        email: normalizeEmail(authPayload.email || authPayload.user_metadata?.email),
        role: String(authPayload.role || ''),
      };
    }

    const email = requestedUserEmail(req);
    const userId = String(req.authUser?.id || '');
    if (REQUIRE_MEMBERSHIP && !email && !userId) {
      return res.status(401).json({ error: 'Shop membership identity is required' });
    }

    const membership = (email || userId) ? membershipFor(shopId, email, userId) : null;
    if ((email || userId) && !membership) {
      return res.status(403).json({ error: 'User is not an active member of the selected shop' });
    }

    req.shopId = shopId;
    req.shopMembership = membership;
    return next();
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Shop context validation failed' });
  }
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
  return Boolean(db.prepare(`SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL AND ${tenant.clause}`).get(employeeId, ...tenant.values));
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
