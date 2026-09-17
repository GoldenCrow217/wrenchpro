const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const helperMatch = source.match(/function cleanBearerToken\(value\)\{[\s\S]*?function shopAuthErrorMessage\(status,msg,field\)\{[\s\S]*?\n\}/);
if (!helperMatch) throw new Error('Shop auth frontend helpers were not found');

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
function unsignedToken(payload) {
  return `${base64urlJson({ alg: 'HS256', typ: 'JWT' })}.${base64urlJson(payload)}.signature`;
}
function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
  };
}

const now = Math.floor(Date.now() / 1000);
const trustedIssuer = 'https://xgqidqyctypfbuhhzwai.supabase.co/auth/v1';
const valid = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: 'authenticated', exp: now + 3600 });
const expired = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: 'authenticated', exp: now - 10 });
const notYetValid = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: 'authenticated', exp: now + 3600, nbf: now + 3600 });
const malformedNbf = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: 'authenticated', exp: now + 3600, nbf: 'soon' });
const noExpiry = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: 'authenticated' });
const anonAudience = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: 'anon', exp: now + 3600 });
const badIssuer = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: 'https://wrong-project.supabase.co/auth/v1', aud: 'authenticated', exp: now + 3600 });
const multiAudience = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: ['anon', 'authenticated'], exp: now + 3600 });

const context = {
  SHOP_CONTEXT_STORAGE_KEY: 'wrenchpro.shopContext',
  SHOP_REJECTED_TOKEN_STORAGE_KEY: 'wrenchpro.rejectedSupabaseAccessTokenFingerprint',
  SUPABASE_AUTH_ISSUER: trustedIssuer,
  shopContext: { shopId: 42, email: 'fallback@example.com', accessToken: '' },
  sessionStorage: createStorage(),
  localStorage: createStorage(),
  atob(value) { return Buffer.from(value, 'base64').toString('binary'); },
  Date,
  JSON,
  Number,
  String,
  Math,
  decodeURIComponent,
  URLSearchParams,
  document: { title: 'WrenchPro QA' },
};
context.window = {
  WrenchProShopContext: null,
  location: { search: '', hash: '', pathname: '/app' },
  history: { replaced: '', replaceState(_state, _title, url) { this.replaced = url; } },
};
vm.createContext(context);
vm.runInContext(helperMatch[0], context);

assert.strictEqual(context.cleanBearerToken(`Bearer ${valid}`), valid, 'Bearer prefix should be stripped');
assert.strictEqual(context.cleanBearerToken('not-a-jwt'), '', 'Malformed tokens must not be used');
assert.strictEqual(context.usableSupabaseAccessToken(valid), valid, 'Active tokens should be usable');
assert.strictEqual(context.usableSupabaseAccessToken(expired), '', 'Expired tokens should not be reused by the frontend');
assert.strictEqual(context.usableSupabaseAccessToken(noExpiry), '', 'Tokens without exp should not be reused by the frontend');
assert.strictEqual(context.usableSupabaseAccessToken(notYetValid), '', 'Future nbf tokens should not be reused by the frontend');
assert.strictEqual(context.usableSupabaseAccessToken(malformedNbf), '', 'Malformed nbf tokens should not be reused by the frontend');
assert.strictEqual(context.usableSupabaseAccessToken(anonAudience), '', 'Anon/non-authenticated Supabase tokens should not be reused by the frontend');
assert.strictEqual(context.usableSupabaseAccessToken(badIssuer), '', 'Tokens from another Supabase project should not be reused by the frontend');
assert.strictEqual(context.usableSupabaseAccessToken(multiAudience), multiAudience, 'Supabase audience arrays that include authenticated should be usable');
assert.match(context.shopAuthErrorMessage(401, 'server said no'), /session expired or is missing/, 'Hosted 401s should guide users back to the hosted shell sign-in');
assert.match(context.shopAuthErrorMessage(403, 'Shop account is not active', 'plan_status'), /shop account is not active/, 'Blocked SaaS accounts should get a subscription/account-status recovery message');
assert.match(context.shopAuthErrorMessage(403, 'User is not an active member'), /not an active member/, 'Membership 403s should keep their membership recovery message');
const normalizedHostedContext = context.normalizeHostedShopContext({ shop_id: '42', shop_email: 'TECH@EXAMPLE.COM', access_token: valid });
assert.strictEqual(normalizedHostedContext.shopId, 42, 'Hosted shell context should normalize snake_case shop IDs');
assert.strictEqual(normalizedHostedContext.email, 'tech@example.com', 'Hosted shell context should normalize snake_case emails');
assert.strictEqual(normalizedHostedContext.accessToken, valid, 'Hosted shell context should normalize snake_case access tokens');
context.window.WrenchProShopContext = { shopId: 43, userEmail: 'Owner@Example.com', supabaseAccessToken: valid };
let bootstrappedContext = context.hostShopContextBootstrap();
assert.strictEqual(bootstrappedContext.shopId, 43, 'Hosted shell global should bootstrap shop ID');
assert.strictEqual(bootstrappedContext.email, 'owner@example.com', 'Hosted shell global should bootstrap membership email');
assert.strictEqual(bootstrappedContext.accessToken, valid, 'Hosted shell global should bootstrap active session token');
assert.strictEqual(context.window.WrenchProShopContext.supabaseAccessToken, '', 'Hosted shell handoff token should be scrubbed after bootstrap');
context.window.WrenchProShopContext = { shopId: 45, userEmail: 'Owner@Example.com', accessToken: expired, refreshToken: 'refresh-secret' };
bootstrappedContext = context.hostShopContextBootstrap();
assert.strictEqual(bootstrappedContext.accessToken, '', 'Expired hosted shell access tokens should not bootstrap');
assert.strictEqual(context.window.WrenchProShopContext.accessToken, '', 'Expired hosted shell access tokens should still be scrubbed after bootstrap');
assert.strictEqual(context.window.WrenchProShopContext.refreshToken, '', 'Hosted shell refresh tokens should never remain in window context');
context.window.WrenchProShopContext = { shopId: 43, userEmail: 'Owner@Example.com', supabaseAccessToken: valid };
context.window.location = { search: `?shop_id=44&user_email=url@example.com&access_token=${valid}&refresh_token=secret`, hash: '#token_type=bearer', pathname: '/hosted' };
context.window.history.replaced = '';
bootstrappedContext = context.hostShopContextBootstrap();
assert.strictEqual(bootstrappedContext.shopId, 44, 'URL bootstrap should override stale hosted shell shop ID');
assert.strictEqual(bootstrappedContext.email, 'url@example.com', 'URL bootstrap should override stale hosted shell email');
assert.strictEqual(bootstrappedContext.accessToken, valid, 'URL bootstrap should override stale hosted shell access token');
assert.ok(!context.window.history.replaced.includes('access_token='), 'URL access tokens must be scrubbed from browser history');
assert.ok(!context.window.history.replaced.includes('refresh_token='), 'URL refresh tokens must be scrubbed from browser history');
context.window.location = { search: '?refresh_token=secret&token_type=bearer', hash: '#expires_in=3600', pathname: '/hosted' };
context.window.history.replaced = '';
bootstrappedContext = context.hostShopContextBootstrap();
assert.ok(!context.window.history.replaced.includes('refresh_token='), 'Refresh-token-only URLs must still be scrubbed from browser history');
assert.ok(!context.window.history.replaced.includes('expires_in='), 'Token metadata must be scrubbed even when no access token is usable');

context.window.location = { search: '', hash: '', pathname: '/app' };
context.window.WrenchProShopContext = null;
context.sessionStorage.setItem('wrenchpro.supabaseAccessToken', valid);
context.localStorage.setItem('wrenchpro.supabaseAccessToken', valid);
context.saveShopContext({ shopId: 42, email: 'fallback@example.com', accessToken: expired });
assert.strictEqual(context.shopContext.accessToken, '', 'Expired tokens provided during shop context saves should be discarded');
assert.strictEqual(context.sessionStorage.getItem('wrenchpro.supabaseAccessToken'), null, 'Expired tokens should not be persisted as hosted sessions');
assert.strictEqual(context.localStorage.getItem('wrenchpro.supabaseAccessToken'), null, 'Expired provided tokens should clear stale primary hosted sessions instead of falling back to them');
assert.strictEqual(context.usableSupabaseAccessToken(expired), '', 'Expired provided tokens should be remembered as rejected for this tab');

context.sessionStorage.removeItem('wrenchpro.rejectedSupabaseAccessTokenFingerprint');
context.localStorage.setItem('wrenchpro.supabaseAccessToken', valid);
assert.strictEqual(context.storedSupabaseAccessToken(), valid, 'Legacy WrenchPro localStorage tokens should be discoverable during migration');
assert.strictEqual(context.sessionStorage.getItem('wrenchpro.supabaseAccessToken'), valid, 'Legacy WrenchPro localStorage tokens should be migrated to session storage');
assert.strictEqual(context.localStorage.getItem('wrenchpro.supabaseAccessToken'), null, 'Legacy WrenchPro localStorage tokens should be removed after session migration');
context.sessionStorage.removeItem('wrenchpro.supabaseAccessToken');
context.sessionStorage.setItem('sb-xgqidqyctypfbuhhzwai-auth-token', JSON.stringify({ currentSession: { access_token: expired } }));
context.localStorage.setItem('sb-xgqidqyctypfbuhhzwai-auth-token', JSON.stringify({ currentSession: { access_token: valid } }));
assert.strictEqual(context.storedSupabaseAccessToken(), valid, 'Storage scan should skip expired tokens and find an active hosted session');

context.shopContext = { shopId: 42, email: 'fallback@example.com', accessToken: valid };
let headers = context.shopContextHeaders();
assert.strictEqual(headers['X-WrenchPro-Shop-Id'], '42', 'Shop context header should be sent');
assert.strictEqual(headers.Authorization, `Bearer ${valid}`, 'Active hosted sessions should send Authorization');
context.rememberRejectedSupabaseAccessToken(valid);
assert.strictEqual(context.usableSupabaseAccessToken(valid), '', 'Rejected tokens should not be retried in the same tab');
assert.notStrictEqual(context.rejectedSupabaseAccessToken(), valid, 'Rejected-token retry guard must not store the bearer token itself');
assert.match(context.rejectedSupabaseAccessToken(), /^sig:/, 'Rejected-token retry guard should store only a non-bearer token fingerprint');
context.localStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.sessionStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.shopContext = { shopId: 42, email: 'fallback@example.com', accessToken: expired };
headers = context.shopContextHeaders();
assert.strictEqual(headers['X-WrenchPro-Shop-Id'], '42', 'Shop context header should still be sent without a usable token');
assert.strictEqual(headers['X-WrenchPro-User-Email'], 'fallback@example.com', 'Expired tokens should fall back to membership email only when no active session exists');
assert.ok(!headers.Authorization, 'Expired tokens must not be sent as Authorization');

console.log('Shop auth frontend QA passed');
