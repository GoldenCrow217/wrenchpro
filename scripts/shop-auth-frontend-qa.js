const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const helperMatch = source.match(/function cleanBearerToken\(value\)\{[\s\S]*?function shopContextHeaders\(\)\{[\s\S]*?\n\}/);
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
  SHOP_REJECTED_TOKEN_STORAGE_KEY: 'wrenchpro.rejectedSupabaseAccessToken',
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

context.sessionStorage.setItem('wrenchpro.supabaseAccessToken', valid);
context.localStorage.setItem('wrenchpro.supabaseAccessToken', valid);
context.saveShopContext({ shopId: 42, email: 'fallback@example.com', accessToken: expired });
assert.strictEqual(context.shopContext.accessToken, '', 'Expired tokens provided during shop context saves should be discarded');
assert.strictEqual(context.sessionStorage.getItem('wrenchpro.supabaseAccessToken'), null, 'Expired tokens should not be persisted as hosted sessions');
assert.strictEqual(context.localStorage.getItem('wrenchpro.supabaseAccessToken'), null, 'Expired provided tokens should clear stale primary hosted sessions instead of falling back to them');
assert.strictEqual(context.usableSupabaseAccessToken(expired), '', 'Expired provided tokens should be remembered as rejected for this tab');

context.sessionStorage.removeItem('wrenchpro.rejectedSupabaseAccessToken');
context.sessionStorage.setItem('sb-xgqidqyctypfbuhhzwai-auth-token', JSON.stringify({ currentSession: { access_token: expired } }));
context.localStorage.setItem('sb-xgqidqyctypfbuhhzwai-auth-token', JSON.stringify({ currentSession: { access_token: valid } }));
assert.strictEqual(context.storedSupabaseAccessToken(), valid, 'Storage scan should skip expired tokens and find an active hosted session');

context.shopContext = { shopId: 42, email: 'fallback@example.com', accessToken: valid };
let headers = context.shopContextHeaders();
assert.strictEqual(headers['X-WrenchPro-Shop-Id'], '42', 'Shop context header should be sent');
assert.strictEqual(headers.Authorization, `Bearer ${valid}`, 'Active hosted sessions should send Authorization');
context.rememberRejectedSupabaseAccessToken(valid);
assert.strictEqual(context.usableSupabaseAccessToken(valid), '', 'Rejected tokens should not be retried in the same tab');
context.localStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.sessionStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.shopContext = { shopId: 42, email: 'fallback@example.com', accessToken: expired };
headers = context.shopContextHeaders();
assert.strictEqual(headers['X-WrenchPro-Shop-Id'], '42', 'Shop context header should still be sent without a usable token');
assert.strictEqual(headers['X-WrenchPro-User-Email'], 'fallback@example.com', 'Expired tokens should fall back to membership email only when no active session exists');
assert.ok(!headers.Authorization, 'Expired tokens must not be sent as Authorization');

console.log('Shop auth frontend QA passed');
