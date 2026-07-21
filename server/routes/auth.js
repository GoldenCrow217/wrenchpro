const express = require('express');
const router = express.Router();
const db = require('../database');
const { requestedShopId, resolveShopId } = require('../tenant');
const { isAuthRequired, listMembershipsForUser, publicAuthConfig, publicSessionPayload, requestSupabaseToken } = require('../auth');

router.use((req, res, next) => {
  // Auth/session responses can contain account context and bearer-session data.
  // Keep browsers, proxies, and dev tools cache layers from reusing them across
  // users or shop contexts.
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get('/config', (req, res) => {
  res.json(publicAuthConfig());
});

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = Number(process.env.WRENCHPRO_LOGIN_MAX_ATTEMPTS || 10);
const REFRESH_MAX_ATTEMPTS = Number(process.env.WRENCHPRO_REFRESH_MAX_ATTEMPTS || 30);
const loginAttempts = new Map();
const refreshAttempts = new Map();

function requestIp(req) {
  // Do not trust caller-supplied forwarding headers for brute-force throttling.
  // If the hosted app later runs behind a trusted proxy, Express should be
  // configured with app.set('trust proxy', ...) and req.ip will be normalized.
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function authAttemptKey(req, scope) {
  return `${scope}:${requestIp(req)}`;
}

function loginRateLimitKey(req, email) {
  return `${authAttemptKey(req, 'login')}:${email || 'unknown'}`;
}

function enforceAttemptLimit(store, key, maxAttempts, message, res, next) {
  const now = Date.now();
  const entry = store.get(key) || { count: 0, resetAt: now + AUTH_WINDOW_MS };

  if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + AUTH_WINDOW_MS;
  }

  entry.count += 1;
  store.set(key, entry);

  if (entry.count > maxAttempts) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: message });
  }

  return next();
}

function enforceLoginRateLimit(req, res, next) {
  const email = normalizeEmail((req.body || {}).email);
  return enforceAttemptLimit(loginAttempts, loginRateLimitKey(req, email), LOGIN_MAX_ATTEMPTS, 'Too many sign-in attempts. Try again later.', res, next);
}

function enforceRefreshRateLimit(req, res, next) {
  // Refresh tokens are bearer secrets, so keep the key IP-scoped instead of
  // storing token-derived material in process memory.
  return enforceAttemptLimit(refreshAttempts, authAttemptKey(req, 'refresh'), REFRESH_MAX_ATTEMPTS, 'Too many session refresh attempts. Sign in again later.', res, next);
}

function clearLoginRateLimit(req, email) {
  loginAttempts.delete(loginRateLimitKey(req, email));
}

function clearRefreshRateLimit(req) {
  refreshAttempts.delete(authAttemptKey(req, 'refresh'));
}

router.post('/login', enforceLoginRateLimit, async (req, res, next) => {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const session = await requestSupabaseToken('password', { email, password });
    clearLoginRateLimit(req, email);
    res.json(publicSessionPayload(session));
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', enforceRefreshRateLimit, async (req, res, next) => {
  const body = req.body || {};
  const refreshToken = String(body.refresh_token || body.refreshToken || '').trim();
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' });

  try {
    const session = await requestSupabaseToken('refresh_token', { refresh_token: refreshToken });
    clearRefreshRateLimit(req);
    res.json(publicSessionPayload(session));
  } catch (error) {
    next(error);
  }
});

router.get('/session', (req, res) => {
  const memberships = isAuthRequired() && req.authUser
    ? listMembershipsForUser(req.authUser)
    : [];

  let selectedMembership = req.shopMembership || null;
  let shopId = selectedMembership?.shop_id || null;

  if (isAuthRequired() && req.authUser) {
    const requested = requestedShopId(req);
    if (req.get('x-wrenchpro-shop-id') || req.query.shop_id) {
      if (!requested && memberships.length) return res.status(400).json({ error: 'Invalid shop context' });
      if (requested && memberships.length) {
        selectedMembership = memberships.find(m => Number(m.shop_id) === Number(requested)) || null;
        if (!selectedMembership) return res.status(403).json({ error: 'Shop membership required' });
      }
    } else {
      selectedMembership = memberships[0] || null;
    }
    shopId = selectedMembership?.shop_id || null;
  } else {
    shopId = resolveShopId(req);
  }

  const shop = shopId
    ? db.prepare('SELECT id, name, owner_email, plan_status, created_at FROM shops WHERE id = ?').get(shopId)
    : null;
  const canViewShopRoster = !isAuthRequired() || ['owner', 'admin'].includes(selectedMembership?.role);
  const shopMembers = shop && canViewShopRoster
    ? db.prepare('SELECT id, shop_id, email, role, display_name, created_at FROM shop_memberships WHERE shop_id = ? ORDER BY role, email').all(shop.id)
    : [];
  const visibleMemberships = isAuthRequired() && req.authUser
    ? memberships
    : shopMembers;

  res.json({
    mode: publicAuthConfig().mode,
    authenticated: Boolean(req.authUser),
    user: req.authUser || null,
    membership: selectedMembership || null,
    shop: shop || null,
    // memberships are the signed-in user's shop contexts for switching; shopMembers
    // is the active shop roster for owners/admins managing invites in Settings.
    memberships: visibleMemberships,
    shopMembers,
  });
});

module.exports = router;
