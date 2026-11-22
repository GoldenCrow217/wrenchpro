const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const helperMatch = source.match(/function cleanBearerToken\(value\)\{[\s\S]*?function shopRoleActionMessage\(action\)\{[\s\S]*?\n\}/);
if (!helperMatch) throw new Error('Shop auth frontend helpers were not found');

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
function unsignedToken(payload) {
  const encodedPayload = base64urlJson(payload);
  return `${base64urlJson({ alg: 'HS256', typ: 'JWT' })}.${encodedPayload}.sig-${encodedPayload.slice(-12)}`;
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
  shopContextDetails: { mode: 'shop', shop: { id: 42, name: 'QA Shop' }, membership: { role: 'mechanic', email: 'mechanic@example.com' } },
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
assert.match(context.shopAuthErrorMessage(503, 'Shop membership authentication is not configured'), /hosted authentication is not configured/, 'Hosted auth misconfiguration should show a support/configuration recovery message');
assert.strictEqual(context.canManageShopSettings(), false, 'Hosted mechanics should not see settings as editable');
assert.strictEqual(context.canManageEmployees(), false, 'Hosted mechanics should not see employee management as editable');
assert.strictEqual(context.canManageInventory(), false, 'Hosted mechanics should not see inventory management as editable');
assert.strictEqual(context.canManageCatalog(), false, 'Hosted mechanics should not see catalog management as editable');
assert.strictEqual(context.canManageOperationsSetup(), false, 'Hosted mechanics should not see workflow setup, resource, template, or purchasing actions as editable');
assert.strictEqual(context.canManageEstimates(), false, 'Hosted mechanics should not see estimate creation or approval actions as editable');
assert.strictEqual(context.canRecordPayments(), false, 'Hosted mechanics should not see payment actions as available');
assert.strictEqual(context.shouldRestrictPaidJobStatus(), true, 'Hosted mechanics should not be able to mark repair orders paid from the frontend');
context.shopContextDetails.membership.role = 'service_writer';
assert.strictEqual(context.canRecordPayments(), true, 'Hosted service writers should see payment actions as available');
assert.strictEqual(context.shouldRestrictPaidJobStatus(), false, 'Hosted service writers should be able to mark paid repair orders when allowed by payment guards');
assert.strictEqual(context.canManageEmployees(), false, 'Hosted service writers should not see employee management as editable');
assert.strictEqual(context.canManageInventory(), false, 'Hosted service writers should not see inventory management as editable');
assert.strictEqual(context.canManageCatalog(), false, 'Hosted service writers should not see catalog management as editable');
assert.strictEqual(context.canManageOperationsSetup(), false, 'Hosted service writers should not see workflow setup, resource, template, or purchasing actions as editable');
assert.strictEqual(context.canManageEstimates(), true, 'Hosted service writers should see estimate creation and approval actions as editable');
context.shopContextDetails.membership.role = 'owner';
assert.strictEqual(context.canManageShopSettings(), true, 'Hosted owners should see settings as editable');
assert.strictEqual(context.canManageEmployees(), true, 'Hosted owners should see employee management as editable');
assert.strictEqual(context.canManageInventory(), true, 'Hosted owners should see inventory management as editable');
assert.strictEqual(context.canManageCatalog(), true, 'Hosted owners should see catalog management as editable');
assert.strictEqual(context.canManageOperationsSetup(), true, 'Hosted owners should see workflow setup, resource, template, and purchasing actions as editable');
assert.strictEqual(context.canManageEstimates(), true, 'Hosted owners should see estimate creation and approval actions as editable');
assert.strictEqual(context.shouldRestrictPaidJobStatus(), false, 'Hosted owners should be able to mark paid repair orders');
context.shopContext = { shopId: null, email: '', accessToken: '' };
assert.strictEqual(context.canManageEmployees(), true, 'Desktop mode should keep local employee management available');
assert.strictEqual(context.canManageInventory(), true, 'Desktop mode should keep local inventory management available');
assert.strictEqual(context.canManageCatalog(), true, 'Desktop mode should keep local catalog management available');
assert.strictEqual(context.canManageOperationsSetup(), true, 'Desktop mode should keep local workflow setup, resource, template, and purchasing actions available');
assert.strictEqual(context.canManageEstimates(), true, 'Desktop mode should keep local estimate actions available');
assert.strictEqual(context.shouldRestrictPaidJobStatus(), false, 'Desktop mode should keep paid repair-order status available');
assert.match(source, /operationsTab==='deferred'\|\|\(\['resources','templates','purchasing'\]\.includes\(operationsTab\)&&!canManageOperationsSetup\(\)\)/, 'Workflow setup primary actions should be hidden from non-admin hosted roles');
assert.match(source, /openWorkflowColumnModal\(id=null\)\{\s*if\(!canManageOperationsSetup\(\)\)/, 'Workflow column modal should be guarded on the frontend');
assert.match(source, /openResourceModal\(id=null\)\{if\(!canManageOperationsSetup\(\)\)/, 'Shop resource modal should be guarded on the frontend');
assert.match(source, /openInspectionTemplateModal\(id=null\)\{if\(!canManageOperationsSetup\(\)\)/, 'Inspection template modal should be guarded on the frontend');
assert.match(source, /openPurchaseOrderModal\(id=null\)\{if\(!canManageOperationsSetup\(\)\)/, 'Purchase order modal should be guarded on the frontend');
assert.match(source, /openInventoryReservation\(\)\{\s*if\(!canManageOperationsSetup\(\)\)/, 'Inventory reservations should be guarded on the frontend');
assert.match(source, /invoiceStatus==='Paid'&&!canRecordPayments\(\)/, 'Repair-order paid status should be guarded on the frontend');
assert.match(source, /id==='estimates'\)\{pri\.textContent='\+ New Estimate'; if\(!canManageEstimates\(\)\)pri\.style\.display='none';\}/, 'Estimate creation primary action should be hidden from non-estimator hosted roles');
assert.match(source, /openEstimateModal\(id\)\{\s*if\(!canManageEstimates\(\)\)/, 'Estimate modal should be guarded on the frontend');
assert.match(source, /convertEstToJob\(\)\{\s*if\(!canManageEstimates\(\)\)/, 'Estimate conversion should be guarded on the frontend');
assert.match(source, /\['qf-paid','qf-method','qf-pay-date'\]\.forEach\(id=>\{const input=document\.getElementById\(id\);if\(input\)input\.disabled=!canRecordPayments\(\);\}\)/, 'Quick-entry payment fields should be disabled for non-payment hosted roles');
assert.match(source, /record payments through quick entry/, 'Quick-entry payment save path should be guarded on the frontend');
context.shopContext = { shopId: 42, email: 'fallback@example.com', accessToken: '' };
context.shopContextDetails.membership.role = 'mechanic';
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
context.saveShopContext({ shopId: 42, email: 'fallback@example.com', accessToken: valid });
assert.strictEqual(context.shopContext.accessToken, '', 'Saving the same rejected hosted token must not clear the retry guard');
assert.strictEqual(context.sessionStorage.getItem('wrenchpro.supabaseAccessToken'), null, 'Rejected hosted tokens must not be persisted again by saveShopContext');
const replacementToken = unsignedToken({ sub: 'user-a', email: 'tech@example.com', iss: trustedIssuer, aud: 'authenticated', exp: now + 7200 });
context.saveShopContext({ shopId: 42, email: 'fallback@example.com', accessToken: replacementToken });
assert.strictEqual(context.shopContext.accessToken, replacementToken, 'A fresh active hosted token should replace a rejected session token');
assert.strictEqual(context.rejectedSupabaseAccessToken(), '', 'Accepting a fresh hosted token should clear the rejected-token retry guard');
context.localStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.sessionStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.sessionStorage.removeItem('wrenchpro.supabaseAccessToken');
context.sessionStorage.removeItem('wrenchpro.rejectedSupabaseAccessTokenFingerprint');
context.sessionStorage.setItem('sb-xgqidqyctypfbuhhzwai-auth-token', JSON.stringify({ currentSession: { access_token: valid } }));
context.shopContext = { shopId: 42, email: 'fallback@example.com', accessToken: '' };
headers = context.shopContextHeaders();
assert.strictEqual(headers.Authorization, `Bearer ${valid}`, 'Supabase-managed hosted session tokens should be sent when shop context has no direct token');
context.clearStoredShopAccessToken();
assert.strictEqual(context.usableSupabaseAccessToken(valid), '', 'Rejected Supabase-managed hosted session tokens should not be retried after a 401');
headers = context.shopContextHeaders();
assert.strictEqual(headers['X-WrenchPro-Shop-Id'], '42', 'Shop context header should still be sent after a hosted token rejection');
assert.strictEqual(headers['X-WrenchPro-User-Email'], 'fallback@example.com', 'Rejected hosted tokens should fall back to membership email instead of retrying Authorization');
assert.ok(!headers.Authorization, 'Rejected hosted tokens must not be sent again as Authorization');
context.localStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.sessionStorage.removeItem('sb-xgqidqyctypfbuhhzwai-auth-token');
context.shopContext = { shopId: 42, email: 'fallback@example.com', accessToken: expired };
headers = context.shopContextHeaders();
assert.strictEqual(headers['X-WrenchPro-Shop-Id'], '42', 'Shop context header should still be sent without a usable token');
assert.strictEqual(headers['X-WrenchPro-User-Email'], 'fallback@example.com', 'Expired tokens should fall back to membership email only when no active session exists');
assert.ok(!headers.Authorization, 'Expired tokens must not be sent as Authorization');

console.log('Shop auth frontend QA passed');
