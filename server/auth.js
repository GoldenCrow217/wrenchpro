const db = require('./database');
const { hasRequestedShopId, requestedShopId, resolveShopId } = require('./tenant');

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}

function getSupabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

function isAuthRequired() {
  return process.env.WRENCHPRO_AUTH_REQUIRED === 'true';
}

function publicAuthConfig() {
  return {
    mode: getSupabaseUrl() && getSupabaseAnonKey() ? 'supabase-configured' : 'local-desktop',
    supabaseUrl: getSupabaseUrl(),
    supabaseAnonKeyConfigured: Boolean(getSupabaseAnonKey()),
    authRequired: isAuthRequired(),
  };
}

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function assertSupabaseConfigured() {
  const supabaseUrl = getSupabaseUrl().replace(/\/$/, '');
  const anonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    const error = new Error('Supabase auth is not configured');
    error.status = 503;
    throw error;
  }
  return { supabaseUrl, anonKey };
}

async function fetchSupabaseUser(token) {
  const { supabaseUrl, anonKey } = assertSupabaseConfigured();

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    const error = new Error('Invalid or expired session');
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Unable to verify session');
    error.status = 503;
    throw error;
  }

  return response.json();
}

async function requestSupabaseToken(grantType, payload) {
  const { supabaseUrl, anonKey } = assertSupabaseConfigured();
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=${encodeURIComponent(grantType)}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    const error = new Error(data.error_description || data.msg || 'Invalid email or password');
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Unable to start Supabase session');
    error.status = 503;
    throw error;
  }
  return data;
}

function publicSessionPayload(session) {
  return {
    accessToken: session.access_token || '',
    refreshToken: session.refresh_token || '',
    expiresIn: session.expires_in || 0,
    tokenType: session.token_type || 'bearer',
    user: session.user ? {
      id: session.user.id || '',
      email: session.user.email || '',
    } : null,
  };
}

const MEMBERSHIP_FIELDS = 'id, shop_id, email, role, display_name, created_at';

function membershipUserWhere(user) {
  const clauses = [];
  const values = [];
  const email = String(user?.email || '').trim().toLowerCase();
  const supabaseUserId = String(user?.id || '').trim();

  if (supabaseUserId) {
    clauses.push('supabase_user_id = ?');
    values.push(supabaseUserId);
  }
  if (email) {
    clauses.push("((supabase_user_id IS NULL OR supabase_user_id = '') AND lower(email) = ?)");
    values.push(email);
  }

  return { clause: clauses.length ? `(${clauses.join(' OR ')})` : '', values };
}

function findMembership(shopId, user) {
  if (!shopId || !user) return null;
  const where = membershipUserWhere(user);
  if (!where.clause) return null;
  return db.prepare(`
    SELECT ${MEMBERSHIP_FIELDS}
    FROM shop_memberships
    WHERE shop_id = ? AND ${where.clause}
    ORDER BY role = 'owner' DESC, role = 'admin' DESC, id ASC
    LIMIT 1
  `).get(shopId, ...where.values) || null;
}

function bindInvitedMembershipsToSupabaseUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const supabaseUserId = String(user?.id || '').trim();
  if (!email || !supabaseUserId) return;

  // Once an invited member signs in, bind matching email invites to the
  // verified Supabase user id. This prevents an owner/admin from later
  // changing that linked member email and orphaning or hijacking access.
  db.prepare(`
    UPDATE shop_memberships
    SET supabase_user_id = ?
    WHERE lower(email) = ?
      AND (supabase_user_id IS NULL OR supabase_user_id = '')
  `).run(supabaseUserId, email);
}

function listMembershipsForUser(user) {
  const where = membershipUserWhere(user);
  if (!where.clause) return [];
  bindInvitedMembershipsToSupabaseUser(user);
  return db.prepare(`
    SELECT ${MEMBERSHIP_FIELDS}
    FROM shop_memberships
    WHERE ${where.clause}
    ORDER BY role = 'owner' DESC, role = 'admin' DESC, shop_id ASC, email ASC
  `).all(...where.values);
}

function defaultMembershipForUser(user) {
  return listMembershipsForUser(user)[0] || null;
}

function requireShopMembership() {
  return async (req, res, next) => {
    if (!isAuthRequired()) return next();

    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
      const user = await fetchSupabaseUser(token);
      bindInvitedMembershipsToSupabaseUser(user);
      let membership;
      if (hasRequestedShopId(req)) {
        const parsedShopId = requestedShopId(req);
        if (!parsedShopId) return res.status(400).json({ error: 'Invalid shop context' });
        membership = findMembership(parsedShopId, user);
      } else {
        membership = defaultMembershipForUser(user);
      }
      if (!membership) return res.status(403).json({ error: 'Shop membership required' });

      req.authUser = {
        id: user.id || '',
        email: user.email || '',
      };
      req.shopMembership = membership;
      req.activeShopId = membership.shop_id;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireSupabaseUser() {
  return async (req, res, next) => {
    if (!isAuthRequired()) return next();

    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
      const user = await fetchSupabaseUser(token);
      bindInvitedMembershipsToSupabaseUser(user);
      req.authUser = {
        id: user.id || '',
        email: user.email || '',
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  bearerToken,
  bindInvitedMembershipsToSupabaseUser,
  findMembership,
  isAuthRequired,
  listMembershipsForUser,
  publicAuthConfig,
  publicSessionPayload,
  requestSupabaseToken,
  requireShopMembership,
  requireSupabaseUser,
};
