const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const port = process.env.QA_PORT || String(4300 + Math.floor(Math.random() * 1000));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-api-qa-'));
const serverPath = path.join(__dirname, '..', 'server', 'index.js');
const baseUrl = `http://localhost:${port}`;

const child = spawn(process.execPath, [serverPath], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    PORT: port,
    WRENCHPRO_DATA: dataDir,
    NODE_ENV: 'test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestRaw(method, route, body, headers = {}) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body ? { 'content-type': 'application/json', ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { ok: res.ok, status: res.status, body: parsed, text };
}

async function request(method, route, body, headers) {
  const result = await requestRaw(method, route, body, headers);
  if (!result.ok) {
    throw new Error(`${method} ${route} failed: HTTP ${result.status} ${result.text}`);
  }
  return result.body;
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}. Output:\n${output}`);
    }
    try {
      await request('GET', '/api/dashboard');
      return;
    } catch {
      await sleep(300);
    }
  }
  throw new Error(`Timed out waiting for server. Output:\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runAuthRequiredGateCheck() {
  const authPort = String(5300 + Math.floor(Math.random() * 1000));
  const authDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-auth-qa-'));
  const authBaseUrl = `http://localhost:${authPort}`;
  const readJsonBody = req => new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
  const sendMockSupabaseJson = (res, status, payload) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(payload));
  };
  const mockSupabase = http.createServer(async (req, res) => {
    if (req.url === '/auth/v1/user' && req.headers.authorization === 'Bearer qa-valid-token') {
      return sendMockSupabaseJson(res, 200, { id: 'qa-user-1', email: 'owner@example.test' });
    }
    if (req.url === '/auth/v1/user' && req.headers.authorization === 'Bearer qa-mechanic-token') {
      return sendMockSupabaseJson(res, 200, { id: 'qa-user-2', email: 'mechanic@example.test' });
    }
    if (req.url === '/auth/v1/user' && req.headers.authorization === 'Bearer qa-admin-token') {
      return sendMockSupabaseJson(res, 200, { id: 'qa-user-3', email: 'admin@example.test' });
    }
    if (req.url === '/auth/v1/user' && req.headers.authorization === 'Bearer qa-bootstrap-token') {
      return sendMockSupabaseJson(res, 200, { id: 'qa-bootstrap-user', email: 'bootstrap@example.test' });
    }
    if (req.url === '/auth/v1/user' && req.headers.authorization === 'Bearer qa-login-token') {
      return sendMockSupabaseJson(res, 200, { id: 'qa-login-user', email: 'login@example.test' });
    }
    if (req.method === 'POST' && req.url === '/auth/v1/token?grant_type=password') {
      const body = await readJsonBody(req);
      if (body.email === 'login@example.test' && body.password === 'correct-password') {
        return sendMockSupabaseJson(res, 200, {
          access_token: 'qa-login-token',
          refresh_token: 'qa-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'qa-login-user', email: 'login@example.test' },
        });
      }
      return sendMockSupabaseJson(res, 401, { msg: 'Invalid login credentials' });
    }
    if (req.method === 'POST' && req.url === '/auth/v1/token?grant_type=refresh_token') {
      const body = await readJsonBody(req);
      if (body.refresh_token === 'qa-refresh-token') {
        return sendMockSupabaseJson(res, 200, {
          access_token: 'qa-login-token',
          refresh_token: 'qa-refresh-token-rotated',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'qa-login-user', email: 'login@example.test' },
        });
      }
      return sendMockSupabaseJson(res, 401, { msg: 'Invalid refresh token' });
    }
    return sendMockSupabaseJson(res, 401, { msg: 'Invalid token' });
  });
  await new Promise(resolve => mockSupabase.listen(0, '127.0.0.1', resolve));
  const mockSupabaseUrl = `http://127.0.0.1:${mockSupabase.address().port}`;

  const authChild = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: authPort,
      WRENCHPRO_DATA: authDataDir,
      NODE_ENV: 'test',
      WRENCHPRO_AUTH_REQUIRED: 'true',
      WRENCHPRO_LOGIN_MAX_ATTEMPTS: '2',
      WRENCHPRO_REFRESH_MAX_ATTEMPTS: '2',
      WRENCHPRO_ALLOWED_ORIGINS: 'https://app.wrenchpro.test, http://insecure.example.test, https://invalid.example.test/path',
      SUPABASE_URL: mockSupabaseUrl,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'qa-placeholder-anon-key',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let authOutput = '';
  authChild.stdout.on('data', chunk => { authOutput += chunk.toString(); });
  authChild.stderr.on('data', chunk => { authOutput += chunk.toString(); });

  async function authRequestRaw(method, route, body, headers = {}) {
    const res = await fetch(`${authBaseUrl}${route}`, {
      method,
      headers: body ? { 'content-type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { ok: res.ok, status: res.status, body: parsed, text, headers: res.headers };
  }

  try {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      if (authChild.exitCode !== null) {
        throw new Error(`Auth-required server exited early with code ${authChild.exitCode}. Output:\n${authOutput}`);
      }
      try {
        const config = await authRequestRaw('GET', '/api/auth/config');
        if (config.ok) break;
      } catch {
        await sleep(300);
      }
    }

    const config = await authRequestRaw('GET', '/api/auth/config');
    assert(config.ok, `Auth config should remain public in auth-required mode: HTTP ${config.status}`);
    assert(config.body && config.body.authRequired === true, 'Auth config should report authRequired=true');
    assert(!('supabaseAnonKey' in config.body), 'Auth config must not expose Supabase anon key value in auth-required mode');
    assert(config.headers.get('cache-control') === 'no-store', 'Auth config should disable caching of auth/session context');
    assert(!config.headers.get('x-powered-by'), 'Hosted auth responses should not expose Express x-powered-by fingerprinting');

    const staleContextConfig = await authRequestRaw('GET', '/api/auth/config', undefined, { 'x-wrenchpro-shop-id': '999999' });
    assert(staleContextConfig.ok, `Auth config must ignore stale browser shop context during bootstrap: HTTP ${staleContextConfig.status}`);

    const hostedHealth = await authRequestRaw('GET', '/api/health', undefined, { 'x-wrenchpro-shop-id': '999999' });
    assert(hostedHealth.ok, `Health probe should stay public in auth-required mode and ignore stale shop context: HTTP ${hostedHealth.status}`);
    assert(hostedHealth.headers.get('cache-control') === 'no-store', 'Health probe should be no-store');
    assert(hostedHealth.body && hostedHealth.body.ok === true && hostedHealth.body.authRequired === true, 'Health probe should expose only readiness/auth-required status');
    assert(hostedHealth.body.supabaseConfigured === true, 'Health probe should report Supabase configured without exposing URL/key values');
    assert(!('supabaseUrl' in hostedHealth.body) && !('supabaseAnonKey' in hostedHealth.body), 'Health probe must not expose Supabase connection details');

    const hostedLocalhostCors = await authRequestRaw('GET', '/api/health', undefined, { origin: 'http://localhost:3000' });
    assert(hostedLocalhostCors.headers.get('access-control-allow-origin') === 'http://localhost:3000', 'Hosted mode should allow localhost browser/Electron API origins');
    const hostedNullCors = await authRequestRaw('GET', '/api/health', undefined, { origin: 'null' });
    assert(!hostedNullCors.headers.get('access-control-allow-origin'), 'Hosted auth-required mode must not allow null/file origins through CORS');
    const hostedConfiguredCors = await authRequestRaw('GET', '/api/health', undefined, { origin: 'https://app.wrenchpro.test' });
    assert(hostedConfiguredCors.headers.get('access-control-allow-origin') === 'https://app.wrenchpro.test', 'Hosted mode should allow exact configured HTTPS frontend origins');
    const hostedConfiguredCorsWithSlash = await authRequestRaw('GET', '/api/health', undefined, { origin: 'https://app.wrenchpro.test/' });
    assert(hostedConfiguredCorsWithSlash.headers.get('access-control-allow-origin') === 'https://app.wrenchpro.test/', 'Hosted mode should normalize configured origins while echoing the browser origin');
    const hostedInsecureConfiguredCors = await authRequestRaw('GET', '/api/health', undefined, { origin: 'http://insecure.example.test' });
    assert(!hostedInsecureConfiguredCors.headers.get('access-control-allow-origin'), 'Hosted configured CORS origins must require HTTPS outside localhost');
    const hostedPathConfiguredCors = await authRequestRaw('GET', '/api/health', undefined, { origin: 'https://invalid.example.test/path' });
    assert(!hostedPathConfiguredCors.headers.get('access-control-allow-origin'), 'Hosted configured CORS origins must be exact origins, not URL paths');

    const staleContextLogin = await authRequestRaw('POST', '/api/auth/login', { email: 'qa@example.test' }, { 'x-wrenchpro-shop-id': '999999' });
    assert(staleContextLogin.status === 400, 'Auth login should ignore stale shop context and validate credentials instead');

    const missingLoginFields = await authRequestRaw('POST', '/api/auth/login', { email: 'qa@example.test' });
    assert(missingLoginFields.status === 400, 'Auth login should remain public but validate missing credentials');
    const emptyLoginBody = await authRequestRaw('POST', '/api/auth/login');
    assert(emptyLoginBody.status === 400, 'Auth login should handle an empty request body without a server error');

    const missingRefreshToken = await authRequestRaw('POST', '/api/auth/refresh', {});
    assert(missingRefreshToken.status === 400, 'Auth refresh should remain public but validate missing refresh token');

    const successfulLogin = await authRequestRaw('POST', '/api/auth/login', { email: 'login@example.test', password: 'correct-password' });
    assert(successfulLogin.ok, `Valid login should return a public session payload: HTTP ${successfulLogin.status} ${successfulLogin.text}`);
    assert(successfulLogin.body.accessToken === 'qa-login-token', 'Valid login should return access token under frontend-consumed accessToken key');
    assert(successfulLogin.body.refreshToken === 'qa-refresh-token', 'Valid login should return refresh token under frontend-consumed refreshToken key');
    assert(successfulLogin.body.user && successfulLogin.body.user.email === 'login@example.test', 'Valid login should include safe public user identity');
    assert(!('access_token' in successfulLogin.body) && !('refresh_token' in successfulLogin.body), 'Valid login should not leak raw Supabase snake_case token fields');

    const successfulRefresh = await authRequestRaw('POST', '/api/auth/refresh', { refresh_token: successfulLogin.body.refreshToken });
    assert(successfulRefresh.ok, `Valid refresh should return a rotated public session payload: HTTP ${successfulRefresh.status} ${successfulRefresh.text}`);
    assert(successfulRefresh.body.accessToken === 'qa-login-token', 'Valid refresh should return frontend-consumed accessToken key');
    assert(successfulRefresh.body.refreshToken === 'qa-refresh-token-rotated', 'Valid refresh should return frontend-consumed refreshToken key');

    const invalidRefreshOne = await authRequestRaw('POST', '/api/auth/refresh', { refresh_token: 'bad-refresh-token' });
    assert(invalidRefreshOne.status === 401, 'First invalid refresh should reach Supabase auth and fail normally');
    const invalidRefreshTwo = await authRequestRaw('POST', '/api/auth/refresh', { refresh_token: 'bad-refresh-token' });
    assert(invalidRefreshTwo.status === 401, 'Second invalid refresh should still reach Supabase auth below the rate limit');
    const rateLimitedRefresh = await authRequestRaw('POST', '/api/auth/refresh', { refresh_token: 'bad-refresh-token' });
    assert(rateLimitedRefresh.status === 429, 'Repeated invalid refresh attempts should be rate limited before Supabase auth');
    const spoofedForwardedForRefresh = await authRequestRaw('POST', '/api/auth/refresh', { refresh_token: 'bad-refresh-token' }, { 'x-forwarded-for': '203.0.113.42' });
    assert(spoofedForwardedForRefresh.status === 429, 'Caller-supplied x-forwarded-for must not bypass refresh rate limits');

    const invalidLoginOne = await authRequestRaw('POST', '/api/auth/login', { email: 'rate@example.test', password: 'bad-password' });
    assert(invalidLoginOne.status === 401, 'First invalid login should reach Supabase auth and fail normally');
    const invalidLoginTwo = await authRequestRaw('POST', '/api/auth/login', { email: 'rate@example.test', password: 'bad-password' });
    assert(invalidLoginTwo.status === 401, 'Second invalid login should still reach Supabase auth below the rate limit');
    const rateLimitedLogin = await authRequestRaw('POST', '/api/auth/login', { email: 'rate@example.test', password: 'bad-password' });
    assert(rateLimitedLogin.status === 429, 'Repeated invalid login attempts should be rate limited before Supabase auth');
    assert(rateLimitedLogin.body && /too many sign-in attempts/i.test(rateLimitedLogin.body.error || ''), 'Rate limited login should return a safe public error');
    const spoofedForwardedForLogin = await authRequestRaw('POST', '/api/auth/login', { email: 'rate@example.test', password: 'bad-password' }, { 'x-forwarded-for': '203.0.113.42' });
    assert(spoofedForwardedForLogin.status === 429, 'Caller-supplied x-forwarded-for must not bypass login rate limits');

    const protectedRoute = await authRequestRaw('GET', '/api/dashboard');
    assert(protectedRoute.status === 401, 'Protected API route should require Authorization bearer token when auth is required');
    const unauthenticatedUnknownShop = await authRequestRaw('GET', '/api/dashboard', undefined, { 'x-wrenchpro-shop-id': '999999' });
    assert(unauthenticatedUnknownShop.status === 401, 'Unauthenticated hosted requests must not reveal whether a requested shop context exists');
    const unauthenticatedMalformedShop = await authRequestRaw('GET', '/api/dashboard', undefined, { 'x-wrenchpro-shop-id': 'not-a-shop-id' });
    assert(unauthenticatedMalformedShop.status === 401, 'Unauthenticated hosted requests with malformed shop context should still fail at auth first');

    const unauthenticatedShopCreate = await authRequestRaw('POST', '/api/shops', {
      name: 'Unauthenticated Shop',
      owner_email: 'nope@example.test',
    });
    assert(unauthenticatedShopCreate.status === 401, 'Hosted shop bootstrap should still require a valid Supabase bearer token');

    const preBootstrapSession = await authRequestRaw('GET', '/api/auth/session', undefined, {
      authorization: 'Bearer qa-bootstrap-token',
      'x-wrenchpro-shop-id': '999999',
    });
    assert(preBootstrapSession.ok, `Signed-in hosted user without membership should reach session bootstrap despite stale shop context: HTTP ${preBootstrapSession.status} ${preBootstrapSession.text}`);
    assert(preBootstrapSession.body.authenticated === true, 'Pre-bootstrap session should report authenticated=true');
    assert(preBootstrapSession.body.shop === null, 'Pre-bootstrap session should not invent a shop context');
    assert(Array.isArray(preBootstrapSession.body.memberships) && preBootstrapSession.body.memberships.length === 0, 'Pre-bootstrap session should return no memberships');

    const preBootstrapShops = await authRequestRaw('GET', '/api/shops', undefined, {
      authorization: 'Bearer qa-bootstrap-token',
      'x-wrenchpro-shop-id': '999999',
    });
    assert(preBootstrapShops.ok, `Signed-in hosted user without membership should be able to list zero shops despite stale shop context: HTTP ${preBootstrapShops.status} ${preBootstrapShops.text}`);
    assert(Array.isArray(preBootstrapShops.body) && preBootstrapShops.body.length === 0, 'Pre-bootstrap shop list should be empty');

    const bootstrapShop = await authRequestRaw('POST', '/api/shops', {
      name: 'Bootstrap Mobile Shop',
      plan_status: 'active',
    }, {
      authorization: 'Bearer qa-bootstrap-token',
      'x-wrenchpro-shop-id': '999999',
    });
    assert(bootstrapShop.ok, `Hosted user without membership should be able to create first shop despite stale local shop context: HTTP ${bootstrapShop.status} ${bootstrapShop.text}`);
    assert(bootstrapShop.body.owner_email === 'bootstrap@example.test', 'Hosted first shop should default owner email from Supabase user');
    assert(bootstrapShop.body.plan_status === 'trial', 'Hosted shop bootstrap must not let users self-assign paid plan status');

    const authDb = new Database(path.join(authDataDir, 'wrenchpro.db'));
    const bootstrapOwner = authDb.prepare('SELECT email, role, supabase_user_id FROM shop_memberships WHERE shop_id = ?').get(bootstrapShop.body.id);
    assert(bootstrapOwner && bootstrapOwner.email === 'bootstrap@example.test' && bootstrapOwner.role === 'owner', 'Hosted first shop should create an owner membership automatically');
    assert(bootstrapOwner.supabase_user_id === 'qa-bootstrap-user', 'Hosted first shop owner membership should bind the Supabase user id server-side');
    const userShop = authDb.prepare("INSERT INTO shops (name, owner_email) VALUES (?, ?)").run('Auth User Shop', 'owner@example.test').lastInsertRowid;
    const otherShop = authDb.prepare("INSERT INTO shops (name, owner_email) VALUES (?, ?)").run('Other Latest Shop', 'other@example.test').lastInsertRowid;
    const ownerMembershipId = authDb.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, ?, ?, ?, ?)").run(userShop, 'owner@example.test', 'owner', 'QA Owner', 'qa-user-1').lastInsertRowid;
    authDb.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name) VALUES (?, ?, ?, ?)").run(userShop, 'mechanic@example.test', 'mechanic', 'QA Mechanic');
    authDb.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name) VALUES (?, ?, ?, ?)").run(userShop, 'admin@example.test', 'admin', 'QA Admin');
    authDb.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, ?, ?, ?, ?)").run(otherShop, 'owner@example.test', 'owner', 'Wrong Linked Owner', 'qa-different-user');
    authDb.close();

    const defaultSession = await authRequestRaw('GET', '/api/auth/session', undefined, { authorization: 'Bearer qa-valid-token' });
    assert(defaultSession.ok, `Valid hosted user should resolve their shop without a preselected shop: HTTP ${defaultSession.status} ${defaultSession.text}`);
    assert(defaultSession.body.shop && defaultSession.body.shop.id === userShop, 'Hosted auth should default to the signed-in user membership, not the latest shop');

    const malformedSessionContext = await authRequestRaw('GET', '/api/auth/session', undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': 'not-a-shop-id',
    });
    assert(malformedSessionContext.status === 400, 'Hosted auth session should reject malformed saved shop context instead of falling back to another shop');

    const missingSessionContext = await authRequestRaw('GET', '/api/auth/session', undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': '999999',
    });
    assert(missingSessionContext.status === 403, 'Hosted auth session should reject unknown saved shop context for users who already have memberships');

    const explicitOtherShop = await authRequestRaw('GET', '/api/auth/session', undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(otherShop),
    });
    assert(explicitOtherShop.status === 403, 'Hosted auth should reject explicit shop contexts without membership');

    const ownerCanCreateAdditionalShop = await authRequestRaw('POST', '/api/shops', {
      name: 'Owner Second Shop',
      owner_email: 'owner@example.test',
      plan_status: 'founding',
    }, {
      authorization: 'Bearer qa-valid-token',
    });
    assert(ownerCanCreateAdditionalShop.ok, `Hosted owner/admin should be able to create an additional managed shop: HTTP ${ownerCanCreateAdditionalShop.status} ${ownerCanCreateAdditionalShop.text}`);
    assert(ownerCanCreateAdditionalShop.body.plan_status === 'trial', 'Hosted additional shop creation must ignore client-supplied plan status');

    const explicitSecondShopSession = await authRequestRaw('GET', '/api/auth/session', undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(ownerCanCreateAdditionalShop.body.id),
    });
    assert(explicitSecondShopSession.ok, `Hosted owner should be able to switch session context to another owned shop: HTTP ${explicitSecondShopSession.status} ${explicitSecondShopSession.text}`);
    assert(explicitSecondShopSession.body.shop && explicitSecondShopSession.body.shop.id === ownerCanCreateAdditionalShop.body.id, 'Hosted session should honor an explicit owned shop context');
    assert(explicitSecondShopSession.body.membership && explicitSecondShopSession.body.membership.shop_id === ownerCanCreateAdditionalShop.body.id, 'Hosted session should return the selected shop membership');

    const mechanicCannotCreateShop = await authRequestRaw('POST', '/api/shops', {
      name: 'Mechanic Rogue Shop',
      owner_email: 'mechanic@example.test',
    }, {
      authorization: 'Bearer qa-mechanic-token',
    });
    assert(mechanicCannotCreateShop.status === 403, 'Hosted mechanic should not create additional shops after they already belong to a shop');

    const mechanicCanRead = await authRequestRaw('GET', '/api/customers', undefined, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicCanRead.ok, `Hosted mechanic should retain data access inside their shop: HTTP ${mechanicCanRead.status}`);

    const mechanicCannotListMembers = await authRequestRaw('GET', `/api/shops/${userShop}/memberships`, undefined, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicCannotListMembers.status === 403, 'Hosted mechanic should not list the full shop roster');

    const mechanicSession = await authRequestRaw('GET', '/api/auth/session', undefined, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicSession.ok, `Hosted mechanic session should still load: HTTP ${mechanicSession.status} ${mechanicSession.text}`);
    assert(Array.isArray(mechanicSession.body.shopMembers) && mechanicSession.body.shopMembers.length === 0, 'Hosted mechanic session should not expose the full shop roster');

    const membershipBindDb = new Database(path.join(authDataDir, 'wrenchpro.db'));
    const boundMechanic = membershipBindDb.prepare('SELECT supabase_user_id FROM shop_memberships WHERE shop_id = ? AND email = ?').get(userShop, 'mechanic@example.test');
    membershipBindDb.close();
    assert(boundMechanic && boundMechanic.supabase_user_id === 'qa-user-2', 'Hosted email-invited members should bind to Supabase user id after first verified access');

    const mechanicCannotEditSettings = await authRequestRaw('PUT', '/api/settings', {
      business_name: 'Mechanic Settings Attempt',
      default_labor_rate: 999,
    }, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicCannotEditSettings.status === 403, 'Hosted mechanic should not edit shop billing/profile settings');

    const ownerCanEditSettings = await authRequestRaw('PUT', '/api/settings', {
      business_name: 'Owner Managed Shop',
      default_labor_rate: 145,
      tax_rate: 8.25,
    }, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerCanEditSettings.ok, `Hosted owner/admin should be able to edit shop settings: HTTP ${ownerCanEditSettings.status} ${ownerCanEditSettings.text}`);

    const ownerCannotSelfUpgradePlan = await authRequestRaw('PUT', `/api/shops/${userShop}`, {
      name: 'Owner Rename Without Billing Upgrade',
      owner_email: 'owner@example.test',
      plan_status: 'active',
    }, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerCannotSelfUpgradePlan.ok, `Hosted owner should be able to edit shop profile without changing plan status: HTTP ${ownerCannotSelfUpgradePlan.status} ${ownerCannotSelfUpgradePlan.text}`);
    assert(ownerCannotSelfUpgradePlan.body.plan_status === 'trial', 'Hosted shop profile edits must preserve server-owned plan status');

    const mechanicCannotEditShop = await authRequestRaw('PUT', `/api/shops/${userShop}`, {
      name: 'Mechanic Rename Attempt',
      owner_email: 'mechanic@example.test',
      plan_status: 'trial',
    }, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicCannotEditShop.status === 403, 'Hosted mechanic should not edit shop profile');

    const mechanicCannotInvite = await authRequestRaw('POST', `/api/shops/${userShop}/memberships`, {
      email: 'helper@example.test',
      role: 'mechanic',
      display_name: 'Helper',
    }, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicCannotInvite.status === 403, 'Hosted mechanic should not manage shop memberships');

    const ownerInvitesHelper = await authRequestRaw('POST', `/api/shops/${userShop}/memberships`, {
      email: 'helper@example.test',
      role: 'mechanic',
      display_name: 'Helper',
    }, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerInvitesHelper.ok, `Hosted owner should be able to add removable helper: HTTP ${ownerInvitesHelper.status} ${ownerInvitesHelper.text}`);

    const mechanicCannotUpdateMember = await authRequestRaw('PUT', `/api/shops/${userShop}/memberships/${ownerInvitesHelper.body.id}`, {
      email: 'helper@example.test',
      role: 'advisor',
      display_name: 'Helper Advisor',
    }, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicCannotUpdateMember.status === 403, 'Hosted mechanic should not edit shop memberships');

    const ownerUpdatesHelper = await authRequestRaw('PUT', `/api/shops/${userShop}/memberships/${ownerInvitesHelper.body.id}`, {
      email: 'helper@example.test',
      role: 'advisor',
      display_name: 'Helper Advisor',
    }, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerUpdatesHelper.ok, `Hosted owner should be able to update helper membership: HTTP ${ownerUpdatesHelper.status} ${ownerUpdatesHelper.text}`);
    assert(ownerUpdatesHelper.body.role === 'advisor' && ownerUpdatesHelper.body.display_name === 'Helper Advisor', 'Hosted membership update should persist safe role/display fields');
    assert(!('supabase_user_id' in ownerUpdatesHelper.body), 'Hosted membership update must not expose Supabase user id');

    const adminUpdatesHelper = await authRequestRaw('PUT', `/api/shops/${userShop}/memberships/${ownerInvitesHelper.body.id}`, {
      email: 'helper@example.test',
      role: 'mechanic',
      display_name: 'Helper Mechanic Again',
    }, {
      authorization: 'Bearer qa-admin-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(adminUpdatesHelper.ok, `Hosted admin should manage non-owner team members: HTTP ${adminUpdatesHelper.status} ${adminUpdatesHelper.text}`);

    const adminCannotCreateOwner = await authRequestRaw('POST', `/api/shops/${userShop}/memberships`, {
      email: 'admin-created-owner@example.test',
      role: 'owner',
      display_name: 'Admin Created Owner',
    }, {
      authorization: 'Bearer qa-admin-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(adminCannotCreateOwner.status === 403, 'Hosted admin should not create owner memberships');

    const ownerCreatesCoOwner = await authRequestRaw('POST', `/api/shops/${userShop}/memberships`, {
      email: 'co-owner@example.test',
      role: 'owner',
      display_name: 'Co Owner',
    }, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerCreatesCoOwner.ok, `Hosted owner should be able to add another owner: HTTP ${ownerCreatesCoOwner.status} ${ownerCreatesCoOwner.text}`);

    const adminCannotDemoteOwner = await authRequestRaw('PUT', `/api/shops/${userShop}/memberships/${ownerCreatesCoOwner.body.id}`, {
      email: 'co-owner@example.test',
      role: 'admin',
      display_name: 'Co Owner Demoted By Admin',
    }, {
      authorization: 'Bearer qa-admin-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(adminCannotDemoteOwner.status === 403, 'Hosted admin should not edit or demote owner memberships');

    const adminCannotDeleteOwner = await authRequestRaw('DELETE', `/api/shops/${userShop}/memberships/${ownerCreatesCoOwner.body.id}`, undefined, {
      authorization: 'Bearer qa-admin-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(adminCannotDeleteOwner.status === 403, 'Hosted admin should not delete owner memberships');

    const ownerDeletesCoOwner = await authRequestRaw('DELETE', `/api/shops/${userShop}/memberships/${ownerCreatesCoOwner.body.id}`, undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerDeletesCoOwner.ok, `Hosted owner should be able to remove extra owner membership: HTTP ${ownerDeletesCoOwner.status} ${ownerDeletesCoOwner.text}`);

    const hostedRosterSession = await authRequestRaw('GET', '/api/auth/session', undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(hostedRosterSession.ok, `Hosted owner session should load after adding invited helper: HTTP ${hostedRosterSession.status} ${hostedRosterSession.text}`);
    assert(hostedRosterSession.body.memberships.some(m => m.email === 'owner@example.test'), 'Hosted session memberships should retain signed-in user shop contexts for shop switching');
    assert(hostedRosterSession.body.shopMembers.some(m => m.email === 'helper@example.test'), 'Hosted session should expose the active shop roster for Settings team management');
    assert(hostedRosterSession.body.shopMembers.every(m => !('supabase_user_id' in m)), 'Hosted shop roster must not expose Supabase user ids');

    const ownerCannotChangeLinkedEmail = await authRequestRaw('PUT', `/api/shops/${userShop}/memberships/${ownerMembershipId}`, {
      email: 'new-owner@example.test',
      role: 'owner',
      display_name: 'QA Owner',
    }, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerCannotChangeLinkedEmail.status === 400, 'Hosted Supabase-linked member email should be immutable to prevent orphaned logins');

    const mechanicCannotDelete = await authRequestRaw('DELETE', `/api/shops/${userShop}/memberships/${ownerInvitesHelper.body.id}`, undefined, {
      authorization: 'Bearer qa-mechanic-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(mechanicCannotDelete.status === 403, 'Hosted mechanic should not remove shop memberships');

    const ownerDeletesHelper = await authRequestRaw('DELETE', `/api/shops/${userShop}/memberships/${ownerInvitesHelper.body.id}`, undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerDeletesHelper.ok, `Hosted owner should be able to remove helper membership: HTTP ${ownerDeletesHelper.status} ${ownerDeletesHelper.text}`);

    const ownerCannotRemoveLastOwner = await authRequestRaw('DELETE', `/api/shops/${userShop}/memberships/${ownerMembershipId}`, undefined, {
      authorization: 'Bearer qa-valid-token',
      'x-wrenchpro-shop-id': String(userShop),
    });
    assert(ownerCannotRemoveLastOwner.status === 400, 'Hosted shop should prevent deleting the last owner membership');
  } finally {
    if (authChild.exitCode === null) {
      authChild.kill();
      await new Promise(resolve => authChild.once('exit', resolve));
    }
    await new Promise(resolve => mockSupabase.close(resolve));
    fs.rmSync(authDataDir, { recursive: true, force: true });
  }
}

(async () => {
  try {
    await waitForServer();

    const missingRoute = await requestRaw('GET', '/api/does-not-exist');
    assert(missingRoute.status === 404, 'Unknown API route should return HTTP 404');
    assert(missingRoute.body && missingRoute.body.error === 'API route not found', 'Unknown API route should return sanitized JSON error');

    const authConfig = await request('GET', '/api/auth/config');
    assert(authConfig.mode, 'Auth config did not return mode');
    assert(typeof authConfig.supabaseAnonKeyConfigured === 'boolean', 'Auth config did not return public anon-key configured flag');
    assert(!('supabaseAnonKey' in authConfig), 'Auth config must not expose Supabase anon key value');

    const staleContextAuthConfig = await requestRaw('GET', '/api/auth/config', undefined, { 'x-wrenchpro-shop-id': '999999' });
    assert(staleContextAuthConfig.ok, 'Auth config should remain available with stale browser shop context');

    const malformedShopContext = await requestRaw('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': 'abc' });
    assert(malformedShopContext.status === 400, 'Malformed shop context should return HTTP 400');

    const unknownShopContext = await requestRaw('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': '999999' });
    assert(unknownShopContext.status === 404, 'Unknown shop context should return HTTP 404 instead of falling back to legacy data');

    await request('PUT', '/api/settings', {
      business_name: 'Legacy Local Shop',
      owner_name: 'Legacy Owner',
      phone: '555-0000',
      email: 'legacy@example.test',
      default_labor_rate: 110,
      default_pay_method: 'Card',
      tax_rate: 8.25,
      oil_warn_miles: 1500,
      currency_symbol: '$',
    });
    const legacyCustomer = await request('POST', '/api/customers', {
      first: 'Legacy',
      last: 'Customer',
      phone: '555-0101',
    });
    const legacyExpense = await request('POST', '/api/expenses', {
      date: '2026-04-27',
      description: 'Legacy unscoped supplies',
      category: 'Supplies',
      amount: 12.5,
    });

    const shop = await request('POST', '/api/shops', {
      name: 'QA Mobile Auto',
      owner_email: 'owner@example.test',
    });
    assert(shop.id, 'Shop did not return id');

    const linkedLegacyCustomers = await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(linkedLegacyCustomers.some(c => c.id === legacyCustomer.id), 'Creating first local shop should link legacy customers into the selected shop');
    const linkedLegacyExpenses = await request('GET', '/api/expenses', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(linkedLegacyExpenses.some(e => e.id === legacyExpense.id), 'Creating first local shop should link legacy expenses into the selected shop');
    const linkedLegacySettings = await request('GET', '/api/settings', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(linkedLegacySettings.business_name === 'Legacy Local Shop', 'Creating first local shop should copy legacy settings into shop settings');

    const member = await request('POST', `/api/shops/${shop.id}/memberships`, {
      email: 'tech@example.test',
      role: 'mechanic',
      display_name: 'QA Tech',
    });
    assert(member.id && member.shop_id === shop.id, 'Shop membership did not return expected payload');
    assert(!('supabase_user_id' in member), 'Shop membership response must not expose Supabase user id');

    const duplicateMember = await requestRaw('POST', `/api/shops/${shop.id}/memberships`, {
      email: 'TECH@example.test',
      role: 'mechanic',
      display_name: 'Duplicate QA Tech',
    });
    assert(duplicateMember.status === 409, 'Duplicate shop membership should return HTTP 409');

    const invalidMember = await requestRaw('POST', `/api/shops/${shop.id}/memberships`, {
      email: 'not-an-email',
      role: 'mechanic',
    });
    assert(invalidMember.status === 400, 'Invalid membership email should return HTTP 400');

    const invalidRole = await requestRaw('POST', `/api/shops/${shop.id}/memberships`, {
      email: 'helper@example.test',
      role: 'superuser',
    });
    assert(invalidRole.status === 400, 'Invalid membership role should return HTTP 400');

    const updatedMember = await request('PUT', `/api/shops/${shop.id}/memberships/${member.id}`, {
      email: 'tech@example.test',
      role: 'advisor',
      display_name: 'QA Advisor',
    });
    assert(updatedMember.role === 'advisor' && updatedMember.display_name === 'QA Advisor', 'Local shop membership update should persist role/display changes');
    assert(!('supabase_user_id' in updatedMember), 'Shop membership update response must not expose Supabase user id');

    const secondMember = await request('POST', `/api/shops/${shop.id}/memberships`, {
      email: 'second-tech@example.test',
      role: 'mechanic',
      display_name: 'Second QA Tech',
    });
    const duplicateMemberUpdate = await requestRaw('PUT', `/api/shops/${shop.id}/memberships/${secondMember.id}`, {
      email: 'TECH@example.test',
      role: 'mechanic',
      display_name: 'Duplicate Rename',
    });
    assert(duplicateMemberUpdate.status === 409, 'Updating a shop membership to an existing email should return HTTP 409');

    const invalidMemberUpdate = await requestRaw('PUT', `/api/shops/${shop.id}/memberships/${member.id}`, {
      email: 'not-an-email',
      role: 'advisor',
    });
    assert(invalidMemberUpdate.status === 400, 'Invalid membership update email should return HTTP 400');

    const removableMember = await request('POST', `/api/shops/${shop.id}/memberships`, {
      email: 'remove-me@example.test',
      role: 'advisor',
      display_name: 'Remove Me',
    });
    const deleteMember = await requestRaw('DELETE', `/api/shops/${shop.id}/memberships/${removableMember.id}`);
    assert(deleteMember.ok, 'Local shop manager should be able to remove a team member');
    const deletedMembers = await request('GET', `/api/shops/${shop.id}/memberships`);
    assert(!deletedMembers.some(m => m.id === removableMember.id), 'Deleted shop member should not be listed');

    const session = await request('GET', '/api/auth/session');
    assert(session.shop && session.shop.id === shop.id, 'Auth session did not return seeded shop context');
    assert(session.memberships.some(m => m.email === 'tech@example.test'), 'Auth session did not include shop membership');
    assert(session.memberships.every(m => !('supabase_user_id' in m)), 'Auth session must not expose Supabase user ids');
    assert(session.shopMembers.some(m => m.email === 'tech@example.test'), 'Auth session did not include active shop roster');
    assert(session.shopMembers.every(m => !('supabase_user_id' in m)), 'Auth session shop roster must not expose Supabase user ids');

    const shopCustomer = await request('POST', '/api/customers', {
      first: 'ShopOne',
      last: 'Tenant',
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopCustomer.shop_id === shop.id, 'Customer should be stamped with active shop id');

    const shopTwo = await request('POST', '/api/shops', {
      name: 'QA Second Shop',
      owner_email: 'owner2@example.test',
    });
    const shopTwoCustomer = await request('POST', '/api/customers', {
      first: 'ShopTwo',
      last: 'Tenant',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopTwoCustomer.shop_id === shopTwo.id, 'Second shop customer should be stamped with second shop id');
    const shopTwoVehicle = await request('POST', '/api/vehicles', {
      customer_id: shopTwoCustomer.id,
      year: 2022,
      make: 'Ram',
      model: 'ProMaster',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });

    const shopOneCustomers = await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoCustomers = await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneCustomers.some(c => c.id === shopCustomer.id), 'First shop customer should be visible in first shop context');
    assert(!shopOneCustomers.some(c => c.id === shopTwoCustomer.id), 'Second shop customer leaked into first shop context');
    assert(shopTwoCustomers.some(c => c.id === shopTwoCustomer.id), 'Second shop customer should be visible in second shop context');
    assert(!shopTwoCustomers.some(c => c.id === shopCustomer.id), 'First shop customer leaked into second shop context');

    const shopOneVehicle = await request('POST', '/api/vehicles', {
      customer_id: shopCustomer.id,
      year: 2020,
      make: 'Ford',
      model: 'Transit',
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    const crossShopVehicle = await requestRaw('POST', '/api/vehicles', {
      customer_id: shopCustomer.id,
      year: 2021,
      make: 'Chevrolet',
      model: 'Express',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopVehicle.status === 400, 'Cross-shop vehicle creation should be rejected');

    const shopOneVehicles = await request('GET', '/api/vehicles', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoVehicles = await request('GET', '/api/vehicles', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneVehicles.some(v => v.id === shopOneVehicle.id), 'First shop vehicle should be visible in first shop context');
    assert(!shopTwoVehicles.some(v => v.id === shopOneVehicle.id), 'First shop vehicle leaked into second shop context');

    const shopOneEstimate = await request('POST', '/api/estimates', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      date: '2026-04-28',
      status: 'Draft',
      customer_complaint: 'Tenant isolation check',
      total: 50,
      items: [{ type: 'labor', description: 'Isolation diagnostic', qty: 1, rate: 50, amount: 50 }],
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    const crossShopEstimate = await requestRaw('POST', '/api/estimates', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      date: '2026-04-28',
      total: 50,
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopEstimate.status === 400, 'Cross-shop estimate creation should be rejected');

    const shopOneEstimates = await request('GET', '/api/estimates', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoEstimates = await request('GET', '/api/estimates', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneEstimates.some(e => e.id === shopOneEstimate.id), 'First shop estimate should be visible in first shop context');
    assert(!shopTwoEstimates.some(e => e.id === shopOneEstimate.id), 'First shop estimate leaked into second shop context');

    const shopOneJob = await request('POST', '/api/jobs', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      service: 'Tenant isolation job',
      date: '2026-04-28',
      labor: 50,
      parts: 0,
      status: 'Pending',
      estimate_id: shopOneEstimate.id,
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    const crossShopJob = await requestRaw('POST', '/api/jobs', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      service: 'Cross-shop job',
      date: '2026-04-28',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopJob.status === 400, 'Cross-shop job creation should be rejected');

    const shopOneJobs = await request('GET', '/api/jobs', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoJobs = await request('GET', '/api/jobs', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneJobs.some(j => j.id === shopOneJob.id), 'First shop job should be visible in first shop context');
    assert(!shopTwoJobs.some(j => j.id === shopOneJob.id), 'First shop job leaked into second shop context');

    const shopOnePlan = await request('POST', '/api/plans', {
      customer_id: shopCustomer.id,
      job_id: shopOneJob.id,
      description: 'Tenant scoped payment plan',
      total: 100,
      down_payment: 25,
      start_date: '2026-04-28',
      installments: [{ due_date: '2026-05-28', amount: 75 }],
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    const crossShopPlan = await requestRaw('POST', '/api/plans', {
      customer_id: shopCustomer.id,
      job_id: shopOneJob.id,
      description: 'Cross-shop payment plan',
      total: 100,
      start_date: '2026-04-28',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopPlan.status === 400, 'Cross-shop payment plan creation should be rejected');

    const shopOnePlans = await request('GET', '/api/plans', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoPlans = await request('GET', '/api/plans', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOnePlans.some(p => p.id === shopOnePlan.id), 'First shop payment plan should be visible in first shop context');
    assert(!shopTwoPlans.some(p => p.id === shopOnePlan.id), 'First shop payment plan leaked into second shop context');

    const shopOnePayment = await request('POST', '/api/payments', {
      customer_id: shopCustomer.id,
      plan_id: shopOnePlan.id,
      job_id: shopOneJob.id,
      description: 'Tenant isolation deposit',
      amount: 25,
      method: 'Cash',
      date: '2026-04-28',
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    const crossShopPayment = await requestRaw('POST', '/api/payments', {
      customer_id: shopCustomer.id,
      job_id: shopOneJob.id,
      description: 'Cross-shop payment',
      amount: 25,
      method: 'Cash',
      date: '2026-04-28',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopPayment.status === 400, 'Cross-shop payment creation should be rejected');

    const shopOnePayments = await request('GET', '/api/payments', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoPayments = await request('GET', '/api/payments', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOnePayments.some(p => p.id === shopOnePayment.id), 'First shop payment should be visible in first shop context');
    assert(!shopTwoPayments.some(p => p.id === shopOnePayment.id), 'First shop payment leaked into second shop context');

    const shopOneInspection = await request('POST', '/api/inspections', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      job_id: shopOneJob.id,
      date: '2026-04-28',
      status: 'Draft',
      notes: 'Tenant scoped inspection',
      items: [{ category: 'Safety', item_name: 'Brakes', condition: 'pass', notes: 'OK' }],
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    const crossShopInspection = await requestRaw('POST', '/api/inspections', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      job_id: shopOneJob.id,
      date: '2026-04-28',
      status: 'Draft',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopInspection.status === 400, 'Cross-shop inspection creation should be rejected');

    const shopOneInspections = await request('GET', '/api/inspections', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoInspections = await request('GET', '/api/inspections', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneInspections.some(i => i.id === shopOneInspection.id), 'First shop inspection should be visible in first shop context');
    assert(!shopTwoInspections.some(i => i.id === shopOneInspection.id), 'First shop inspection leaked into second shop context');

    const shopOneWarranty = await request('POST', '/api/warranties', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      job_id: shopOneJob.id,
      description: 'Tenant scoped warranty',
      start_date: '2026-04-28',
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    const crossShopWarranty = await requestRaw('POST', '/api/warranties', {
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
      job_id: shopOneJob.id,
      description: 'Cross-shop warranty',
      start_date: '2026-04-28',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopWarranty.status === 400, 'Cross-shop warranty creation should be rejected');

    const shopOneWarranties = await request('GET', '/api/warranties', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoWarranties = await request('GET', '/api/warranties', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneWarranties.some(w => w.id === shopOneWarranty.id), 'First shop warranty should be visible in first shop context');
    assert(!shopTwoWarranties.some(w => w.id === shopOneWarranty.id), 'First shop warranty leaked into second shop context');

    const shopOneDashboard = await request('GET', '/api/dashboard', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoDashboard = await request('GET', '/api/dashboard', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneDashboard.totalRevenue >= 25, 'First shop dashboard should include first shop payment revenue');
    assert(shopTwoDashboard.totalRevenue === 0, 'First shop payment revenue leaked into second shop dashboard');
    assert(shopOneDashboard.recentJobs.some(j => j.id === shopOneJob.id), 'First shop dashboard should include first shop job');
    assert(!shopTwoDashboard.recentJobs.some(j => j.id === shopOneJob.id), 'First shop job leaked into second shop dashboard');

    const corruptPaymentDb = new Database(path.join(dataDir, 'wrenchpro.db'));
    corruptPaymentDb.prepare(`
      INSERT INTO payments (customer_id, job_id, description, amount, method, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(shopTwoCustomer.id, shopOneJob.id, 'Corrupt cross-shop balance payment', 999, 'Cash', '2026-04-28');
    corruptPaymentDb.close();
    const shopOneBalance = await request('GET', `/api/jobs/${shopOneJob.id}/balance`, undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopOneBalance.paid === shopOnePayment.amount, 'Job balance paid total should exclude cross-shop payment rows with corrupted job refs');

    const shopOneExpense = await request('POST', '/api/expenses', {
      date: '2026-04-28',
      description: 'Tenant scoped shop supplies',
      category: 'Supplies',
      amount: 19.95,
      note: 'QA expense isolation',
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopOneExpense.shop_id === shop.id, 'Expense should be stamped with active shop id');

    const shopOneExpenses = await request('GET', '/api/expenses', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoExpenses = await request('GET', '/api/expenses', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneExpenses.some(e => e.id === shopOneExpense.id), 'First shop expense should be visible in first shop context');
    assert(!shopTwoExpenses.some(e => e.id === shopOneExpense.id), 'First shop expense leaked into second shop context');

    const shopOneDashboardAfterExpense = await request('GET', '/api/dashboard', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoDashboardAfterExpense = await request('GET', '/api/dashboard', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneDashboardAfterExpense.totalExpenses >= 19.95, 'First shop dashboard should include first shop expenses');
    assert(shopTwoDashboardAfterExpense.totalExpenses === 0, 'First shop expenses leaked into second shop dashboard');

    const shopOneEmployee = await request('POST', '/api/employees', {
      first: 'Tenant',
      last: 'Tech',
      email: 'tenant.tech@example.test',
      role: 'Mechanic',
      hourly_rate: 35,
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopOneEmployee.shop_id === shop.id, 'Employee should be stamped with active shop id');

    const shopOneEmployees = await request('GET', '/api/employees', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoEmployees = await request('GET', '/api/employees', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneEmployees.some(e => e.id === shopOneEmployee.id), 'First shop employee should be visible in first shop context');
    assert(!shopTwoEmployees.some(e => e.id === shopOneEmployee.id), 'First shop employee leaked into second shop context');

    const crossShopEmployeeJob = await requestRaw('POST', '/api/jobs', {
      customer_id: shopTwoCustomer.id,
      vehicle_id: shopTwoVehicle.id,
      service: 'Cross-shop employee assignment',
      date: '2026-04-29',
      employee_id: shopOneEmployee.id,
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopEmployeeJob.status === 400, 'Cross-shop employee assignment should be rejected on jobs');

    const crossShopEmployeeInspection = await requestRaw('POST', '/api/inspections', {
      customer_id: shopTwoCustomer.id,
      vehicle_id: shopTwoVehicle.id,
      date: '2026-04-29',
      status: 'Draft',
      employee_id: shopOneEmployee.id,
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopEmployeeInspection.status === 400, 'Cross-shop employee assignment should be rejected on inspections');

    const shopOneInventory = await request('POST', '/api/inventory', {
      name: 'Tenant Brake Pads',
      part_number: 'TBP-1',
      vendor: 'QA Vendor',
      cost: 20,
      retail_price: 50,
      quantity: 4,
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopOneInventory.shop_id === shop.id, 'Inventory item should be stamped with active shop id');

    const shopOneCatalog = await request('POST', '/api/catalog', {
      name: 'Tenant Brake Service',
      category: 'Brakes',
      default_hours: 1.5,
      default_price: 180,
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopOneCatalog.shop_id === shop.id, 'Catalog item should be stamped with active shop id');

    const shopOneInventoryList = await request('GET', '/api/inventory', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoInventoryList = await request('GET', '/api/inventory', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneInventoryList.some(i => i.id === shopOneInventory.id), 'First shop inventory should be visible in first shop context');
    assert(!shopTwoInventoryList.some(i => i.id === shopOneInventory.id), 'First shop inventory leaked into second shop context');

    const shopOneCatalogList = await request('GET', '/api/catalog', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoCatalogList = await request('GET', '/api/catalog', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneCatalogList.some(i => i.id === shopOneCatalog.id), 'First shop catalog should be visible in first shop context');
    assert(!shopTwoCatalogList.some(i => i.id === shopOneCatalog.id), 'First shop catalog leaked into second shop context');

    const crossShopInventoryEstimate = await requestRaw('POST', '/api/estimates', {
      customer_id: shopTwoCustomer.id,
      vehicle_id: shopTwoVehicle.id,
      date: '2026-04-29',
      total: 50,
      items: [{ type: 'part', description: 'Cross-shop inventory part', qty: 1, rate: 50, amount: 50, inventory_id: shopOneInventory.id }],
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopInventoryEstimate.status === 400, 'Cross-shop inventory item should be rejected on estimates');

    const shopOneAppointment = await request('POST', '/api/appointments', {
      cust: 'ShopOne Tenant',
      phone: '555-1010',
      service: 'Tenant appointment',
      date: '2026-04-30',
      time: '09:00',
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopOneAppointment.shop_id === shop.id, 'Appointment should be stamped with active shop id');
    const crossShopAppointment = await requestRaw('POST', '/api/appointments', {
      cust: 'Cross Shop',
      service: 'Cross-shop appointment',
      date: '2026-04-30',
      customer_id: shopCustomer.id,
      vehicle_id: shopOneVehicle.id,
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopAppointment.status === 400, 'Cross-shop appointment creation should be rejected');
    const crossShopEstimateAppointment = await requestRaw('POST', '/api/appointments', {
      cust: 'Cross Shop Estimate',
      service: 'Cross-shop estimate appointment',
      date: '2026-04-30',
      customer_id: shopTwoCustomer.id,
      vehicle_id: shopTwoVehicle.id,
      estimate_id: shopOneEstimate.id,
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopEstimateAppointment.status === 400, 'Cross-shop appointment estimate reference should be rejected');

    const corruptAppointmentDb = new Database(path.join(dataDir, 'wrenchpro.db'));
    const corruptAppointmentId = corruptAppointmentDb.prepare(`
      INSERT INTO appointments (shop_id, cust, service, date, customer_id, vehicle_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(shop.id, 'Corrupt Cross Ref', 'Should not expose cross-shop customer/vehicle', '2026-04-30', shopTwoCustomer.id, shopTwoVehicle.id).lastInsertRowid;
    corruptAppointmentDb.close();

    const shopOneAppointments = await request('GET', '/api/appointments', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoAppointments = await request('GET', '/api/appointments', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneAppointments.some(a => a.id === shopOneAppointment.id), 'First shop appointment should be visible in first shop context');
    assert(!shopTwoAppointments.some(a => a.id === shopOneAppointment.id), 'First shop appointment leaked into second shop context');
    const corruptAppointment = shopOneAppointments.find(a => a.id === corruptAppointmentId);
    assert(corruptAppointment, 'Corrupt-but-current-shop appointment should still be listed for repair/cleanup visibility');
    assert(!corruptAppointment.cust_first && !corruptAppointment.veh_make, 'Appointment list must not expose cross-shop customer/vehicle details from corrupted refs');

    const shopOneTimeLog = await request('POST', '/api/time', {
      employee_id: shopOneEmployee.id,
      job_id: shopOneJob.id,
      type: 'job',
      clock_in: '2026-04-30T09:00:00.000Z',
      clock_out: '2026-04-30T10:00:00.000Z',
      notes: 'Tenant time log',
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(shopOneTimeLog.id, 'Time log did not return id');
    const crossShopTimeLog = await requestRaw('POST', '/api/time', {
      employee_id: shopOneEmployee.id,
      job_id: shopOneJob.id,
      type: 'job',
      clock_in: '2026-04-30T09:00:00.000Z',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopTimeLog.status === 400, 'Cross-shop time log creation should be rejected');

    const corruptTimeDb = new Database(path.join(dataDir, 'wrenchpro.db'));
    const corruptOtherShopJobId = corruptTimeDb.prepare(`
      INSERT INTO jobs (customer_id, vehicle_id, service, date, status)
      VALUES (?, ?, ?, ?, 'Canceled')
    `).run(shopTwoCustomer.id, shopTwoVehicle.id, 'Should not expose cross-shop job service', '2026-04-30').lastInsertRowid;
    const corruptTimeLogId = corruptTimeDb.prepare(`
      INSERT INTO time_logs (employee_id, job_id, type, clock_in, notes)
      VALUES (?, ?, 'job', ?, ?)
    `).run(shopOneEmployee.id, corruptOtherShopJobId, '2026-04-30T11:00:00.000Z', 'Corrupt cross-shop job ref').lastInsertRowid;
    corruptTimeDb.close();

    const shopOneTimeLogs = await request('GET', '/api/time', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoTimeLogs = await request('GET', '/api/time', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneTimeLogs.some(t => t.id === shopOneTimeLog.id), 'First shop time log should be visible in first shop context');
    assert(!shopTwoTimeLogs.some(t => t.id === shopOneTimeLog.id), 'First shop time log leaked into second shop context');
    const corruptTimeLog = shopOneTimeLogs.find(t => t.id === corruptTimeLogId);
    assert(corruptTimeLog, 'Corrupt-but-current-shop time log should still be listed for repair/cleanup visibility');
    assert(!corruptTimeLog.job_service, 'Time log list must not expose cross-shop job service from corrupted refs');

    const crossShopCrmInteraction = await requestRaw('POST', '/api/crm/interactions', {
      customer_id: shopTwoCustomer.id,
      type: 'Call',
      summary: 'Cross-shop employee CRM leak check',
      employee_id: shopOneEmployee.id,
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopCrmInteraction.status === 400, 'Cross-shop employee CRM interaction should be rejected');

    const crossShopServiceReminder = await requestRaw('POST', '/api/crm/service-reminders', {
      customer_id: shopTwoCustomer.id,
      vehicle_id: shopOneVehicle.id,
      service_type: 'Oil Change',
      reminder_date: '2026-05-15',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopServiceReminder.status === 400, 'Cross-shop service reminder vehicle should be rejected');

    await request('PUT', '/api/settings', {
      business_name: 'Shop One SaaS Settings',
      owner_name: 'Owner One',
      phone: '555-1111',
      email: 'owner@example.test',
      address: '1 Tenant Way',
      service_area: 'Dallas metro 30 miles',
      default_labor_rate: 125,
      default_pay_method: 'Card',
      tax_rate: 8.25,
      oil_warn_miles: 1500,
      currency_symbol: '$',
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    await request('PUT', '/api/settings', {
      business_name: 'Shop Two SaaS Settings',
      owner_name: 'Owner Two',
      phone: '555-2222',
      email: 'owner2@example.test',
      address: '2 Tenant Way',
      service_area: 'Fort Worth metro 20 miles',
      default_labor_rate: 95,
      default_pay_method: 'Cash',
      tax_rate: 7,
      oil_warn_miles: 1200,
      currency_symbol: '$',
    }, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    const shopOneSettings = await request('GET', '/api/settings', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const shopTwoSettings = await request('GET', '/api/settings', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(shopOneSettings.business_name === 'Shop One SaaS Settings', 'First shop settings did not persist');
    assert(shopOneSettings.service_area === 'Dallas metro 30 miles', 'First shop service area did not persist');
    assert(shopTwoSettings.business_name === 'Shop Two SaaS Settings', 'Second shop settings did not persist');
    assert(shopTwoSettings.service_area === 'Fort Worth metro 20 miles', 'Second shop service area did not persist');

    const lead = await request('POST', '/api/leads', {
      first: 'QA',
      last: 'Lead',
      phone: '555-0001',
      source: 'QA',
      vehicle_year: 2015,
      vehicle_make: 'Ford',
      vehicle_model: 'F-150',
      service_needed: 'Brake inspection',
      estimated_value: 250,
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(lead.id, 'Lead did not return id');
    assert(lead.shop_id === shop.id, 'Lead should be stamped with active shop id');

    const shopTwoLeads = await request('GET', '/api/leads', undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(!shopTwoLeads.some(l => l.id === lead.id), 'First shop lead leaked into second shop context');
    const crossShopLeadConvert = await requestRaw('POST', `/api/leads/${lead.id}/convert`, undefined, { 'x-wrenchpro-shop-id': String(shopTwo.id) });
    assert(crossShopLeadConvert.status === 404, 'Cross-shop lead conversion should be rejected');

    const converted = await request('POST', `/api/leads/${lead.id}/convert`, undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(converted.customer_id, 'Lead conversion did not return customer_id');

    const customers = await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(customers.some(c => c.id === converted.customer_id), 'Converted customer not found');

    const vehicles = await request('GET', '/api/vehicles', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    const vehicle = vehicles.find(v => v.customer_id === converted.customer_id);
    assert(vehicle && vehicle.id, 'Converted vehicle not found');

    const estimate = await request('POST', '/api/estimates', {
      customer_id: converted.customer_id,
      vehicle_id: vehicle.id,
      date: '2026-04-29',
      status: 'Draft',
      customer_complaint: 'Brake noise',
      notes: 'QA estimate',
      total: 300,
      items: [
        { type: 'labor', description: 'Brake diagnostic', qty: 1, rate: 100, amount: 100 },
        { type: 'parts', description: 'Brake pads', qty: 1, rate: 200, amount: 200 },
      ],
    }, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(estimate.id, 'Estimate did not return id');

    const jobFromEstimate = await request('POST', `/api/estimates/${estimate.id}/convert`, undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(jobFromEstimate.job_id, 'Estimate conversion did not return job_id');

    const jobs = await request('GET', '/api/jobs', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(jobs.some(j => j.id === jobFromEstimate.job_id), 'Converted job not found');

    await request('PUT', `/api/jobs/${jobFromEstimate.job_id}`, {
      service: 'Brake diagnostic, Brake pads',
      date: '2026-04-29',
      miles: 123456,
      labor: 100,
      labor_hours: 1,
      labor_rate: 100,
      parts: 200,
      status: 'Done',
      notes: 'QA completed',
      complaint: 'Brake noise',
      diagnosis: 'Pads worn',
      invoice_status: 'Paid',
      estimate_id: estimate.id,
    }, { 'x-wrenchpro-shop-id': String(shop.id) });

    const dashboard = await request('GET', '/api/dashboard', undefined, { 'x-wrenchpro-shop-id': String(shop.id) });
    assert(dashboard.totalCustomers >= 1, 'Dashboard totalCustomers did not update');
    assert(Array.isArray(dashboard.recentJobs), 'Dashboard recentJobs is not an array');

    await runAuthRequiredGateCheck();

    console.log('API QA passed:', JSON.stringify({
      port,
      dataDir,
      leadId: lead.id,
      customerId: converted.customer_id,
      vehicleId: vehicle.id,
      estimateId: estimate.id,
      jobId: jobFromEstimate.job_id,
      shopId: shop.id,
      memberId: member.id,
      authRequiredGate: true,
    }));
  } finally {
    child.kill();
  }
})().catch(err => {
  child.kill();
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});


