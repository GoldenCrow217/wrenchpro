const assert = require('assert');
const { freePortSync } = require('./qa-port');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const JWT_SECRET = 'tenant-qa-secret-not-production';
const SUPABASE_URL = 'https://xgqidqyctypfbuhhzwai.supabase.co';
const port = freePortSync();
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-tenant-'));
const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test', WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP: 'true', WRENCHPRO_SUPABASE_JWT_SECRET: JWT_SECRET, SUPABASE_URL },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });

const url = route => `http://127.0.0.1:${port}${route}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  for (let i = 0; i < 400; i += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try { if ((await fetch(url('/api/health'))).ok) return; } catch {}
    await sleep(50);
  }
  throw new Error(`Server did not start:\n${output}`);
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken(payload, options = {}) {
  const header = base64urlJson({ alg: options.alg || 'HS256', typ: 'JWT' });
  const defaults = options.skipDefaults ? {} : { iss: `${SUPABASE_URL}/auth/v1`, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 };
  const body = base64urlJson({ ...defaults, ...payload });
  const signature = options.badSignature ? 'bad-signature' : crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

async function request(method, route, body, headers = {}) {
  const response = await fetch(url(route), {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, ok: response.ok, body: parsed };
}

async function runOptionalMembershipQa() {
  const optionalPort = freePortSync();
  const optionalDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-tenant-optional-'));
  const optionalChild = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: optionalPort, WRENCHPRO_DATA: optionalDataDir, NODE_ENV: 'test', WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP: 'false', WRENCHPRO_SUPABASE_JWT_SECRET: JWT_SECRET, SUPABASE_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let optionalOutput = '';
  optionalChild.stdout.on('data', chunk => { optionalOutput += chunk; });
  optionalChild.stderr.on('data', chunk => { optionalOutput += chunk; });
  const optionalUrl = route => `http://127.0.0.1:${optionalPort}${route}`;
  try {
    for (let i = 0; i < 400; i += 1) {
      if (optionalChild.exitCode !== null) throw new Error(`Optional membership QA server exited early:\n${optionalOutput}`);
      try { if ((await fetch(optionalUrl('/api/health'))).ok) break; } catch {}
      await sleep(50);
      if (i === 99) throw new Error(`Optional membership QA server did not start:\n${optionalOutput}`);
    }
    const nullOriginHealth = await fetch(optionalUrl('/api/health'), { headers: { Origin: 'null' } });
    assert.strictEqual(nullOriginHealth.headers.get('access-control-allow-origin'), 'null', 'Desktop compatibility mode should still allow file/null origin clients');
    const optionalDb = new Database(path.join(optionalDataDir, 'wrenchpro.db'));
    const shop = optionalDb.prepare("INSERT INTO shops (name, owner_email) VALUES ('Optional Shop', 'owner@example.com')").run().lastInsertRowid;
    optionalDb.close();
    const response = await fetch(optionalUrl('/api/customers'), { headers: { 'x-wrenchpro-shop-id': String(shop) } });
    assert.strictEqual(response.status, 200, 'Configured Supabase secrets must not force bearer auth unless hosted membership enforcement is enabled');
    const desktopResponse = await fetch(optionalUrl('/api/customers'));
    assert.strictEqual(desktopResponse.status, 200, 'Desktop compatibility mode should remain available when hosted membership enforcement is disabled');
  } finally {
    optionalChild.kill();
  }
}

async function runHostedAuthConfigQa({ env, label, requestHeaders, assertion }) {
  const configPort = freePortSync();
  const configDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `wrenchpro-tenant-${label}-`));
  const configChild = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: configPort, WRENCHPRO_DATA: configDataDir, NODE_ENV: 'test', WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP: 'true', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let configOutput = '';
  configChild.stdout.on('data', chunk => { configOutput += chunk; });
  configChild.stderr.on('data', chunk => { configOutput += chunk; });
  const configUrl = route => `http://127.0.0.1:${configPort}${route}`;
  try {
    for (let i = 0; i < 400; i += 1) {
      if (configChild.exitCode !== null) throw new Error(`Config QA server exited early:\n${configOutput}`);
      try { if ((await fetch(configUrl('/api/health'))).ok) break; } catch {}
      await sleep(50);
      if (i === 99) throw new Error(`Config QA server did not start:\n${configOutput}`);
    }
    const configDb = new Database(path.join(configDataDir, 'wrenchpro.db'));
    const shop = configDb.prepare("INSERT INTO shops (name, owner_email) VALUES ('Misconfigured Shop', 'owner@example.com')").run().lastInsertRowid;
    configDb.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'owner@example.com', 'owner', 'Owner', 'user-config')").run(shop);
    configDb.close();
    const response = await fetch(configUrl('/api/customers'), { headers: { 'x-wrenchpro-shop-id': String(shop), ...requestHeaders(shop) } });
    assertion(response);
  } finally {
    configChild.kill();
  }
}

async function runMissingJwtSecretQa() {
  await runHostedAuthConfigQa({
    label: 'config-secret',
    env: { WRENCHPRO_SUPABASE_JWT_SECRET: '', SUPABASE_JWT_SECRET: '', SUPABASE_URL },
    requestHeaders: () => ({ 'x-wrenchpro-user-email': 'owner@example.com' }),
    assertion: response => assert.strictEqual(response.status, 503, 'Hosted membership enforcement must fail closed when no Supabase JWT secret is configured'),
  });
}

async function runMissingSupabaseUrlQa() {
  await runHostedAuthConfigQa({
    label: 'config-url',
    env: { WRENCHPRO_SUPABASE_JWT_SECRET: JWT_SECRET, SUPABASE_JWT_SECRET: '', SUPABASE_URL: '', WRENCHPRO_SUPABASE_URL: '' },
    requestHeaders: () => ({ authorization: `Bearer ${signToken({ sub: 'user-config', email: 'owner@example.com' })}` }),
    assertion: response => assert.strictEqual(response.status, 503, 'Hosted membership enforcement must fail closed when no Supabase project URL is configured'),
  });
}

async function main() {
  await waitForServer();

  const hostedNullOriginHealth = await fetch(url('/api/health'), { headers: { Origin: 'null' } });
  assert.strictEqual(hostedNullOriginHealth.headers.get('access-control-allow-origin'), null, 'Hosted SaaS mode must not allow browser CORS from file/null origins');

  const db = new Database(path.join(dataDir, 'wrenchpro.db'));
  const shopA = db.prepare("INSERT INTO shops (name, owner_email, billing_email, plan_code, trial_ends_at) VALUES ('A Mobile Repair', 'owner-a@example.com', 'billing-a@example.com', 'founding_mechanic', '2099-12-31')").run().lastInsertRowid;
  const shopB = db.prepare("INSERT INTO shops (name, owner_email) VALUES ('B Mobile Repair', 'owner-b@example.com')").run().lastInsertRowid;
  const suspendedShop = db.prepare("INSERT INTO shops (name, owner_email, plan_status) VALUES ('Suspended Mobile Repair', 'owner-suspended@example.com', 'suspended')").run().lastInsertRowid;
  const expiredTrialShop = db.prepare("INSERT INTO shops (name, owner_email, plan_status, trial_ends_at) VALUES ('Expired Trial Repair', 'owner-expired@example.com', 'trial', '2000-01-01')").run().lastInsertRowid;
  db.prepare("UPDATE settings SET business_name = 'Desktop Only Repair', owner_name = 'Desktop Owner', tax_id = 'LOCAL-TAX-123' WHERE id = 1").run();
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'tech-a@example.com', 'owner', 'Tech A', 'user-a')").run(shopA);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'tech-b@example.com', 'owner', 'Tech B', 'user-b')").run(shopB);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'owner-suspended@example.com', 'owner', 'Suspended Owner', 'user-suspended')").run(suspendedShop);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'owner-expired@example.com', 'owner', 'Expired Trial Owner', 'user-expired')").run(expiredTrialShop);
  db.close();

  const tokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com' });
  const tokenB = signToken({ sub: 'user-b', email: 'tech-b@example.com' });
  const suspendedToken = signToken({ sub: 'user-suspended', email: 'owner-suspended@example.com' });
  const expiredTrialToken = signToken({ sub: 'user-expired', email: 'owner-expired@example.com' });
  const expiredTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', exp: Math.floor(Date.now() / 1000) - 10 });
  const noSubjectTokenA = signToken({ email: 'tech-a@example.com' });
  const noExpiryTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com' }, { skipDefaults: true });
  const badAudienceTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', aud: 'anon' });
  const badIssuerTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', iss: 'https://evil.example/auth/v1' });
  const malformedNbfTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', nbf: 'soon' });
  const badSignatureTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com' }, { badSignature: true });
  const unsupportedAlgTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com' }, { alg: 'none' });
  const multiAudienceTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', aud: ['anon', 'authenticated'] });
  const noEmailTokenA = signToken({ sub: 'user-a' });
  const noEmailSpoofToken = signToken({ sub: 'user-spoof' });
  const linkedEmailSpoofToken = signToken({ sub: 'user-spoof', email: 'tech-a@example.com' });
  const aHeaders = { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${tokenA}` };
  const bHeaders = { 'x-wrenchpro-shop-id': String(shopB), authorization: `Bearer ${tokenB}` };

  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': 'bad' })).status, 400);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': '999999' })).status, 401, 'Unknown hosted shop IDs must not be enumerable before bearer auth succeeds');
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': '999999', authorization: `Bearer ${tokenA}` })).status, 404);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA) })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${expiredTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${noSubjectTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${noExpiryTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${badAudienceTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${badIssuerTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${malformedNbfTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${badSignatureTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${unsupportedAlgTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${multiAudienceTokenA}` })).status, 200);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${tokenB}` })).status, 403);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(suspendedShop) })).status, 401, 'Suspended shop status must not be exposed before bearer auth succeeds');
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(suspendedShop), authorization: `Bearer ${badSignatureTokenA}` })).status, 401, 'Suspended shop status must not be exposed to invalid bearer tokens');
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(suspendedShop), authorization: `Bearer ${tokenA}` })).status, 403, 'Suspended shop status must not be exposed to non-members');
  const suspendedResponse = await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(suspendedShop), authorization: `Bearer ${suspendedToken}` });
  assert.strictEqual(suspendedResponse.status, 403, 'Suspended/canceled SaaS shops must be blocked even with a valid member token');
  assert.strictEqual(suspendedResponse.body.field, 'plan_status');
  const expiredTrialResponse = await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(expiredTrialShop), authorization: `Bearer ${expiredTrialToken}` });
  assert.strictEqual(expiredTrialResponse.status, 403, 'Expired SaaS trials must be blocked even with a valid member token');
  assert.strictEqual(expiredTrialResponse.body.field, 'plan_status');
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), 'x-wrenchpro-user-email': 'tech-b@example.com', authorization: `Bearer ${tokenA}` })).status, 200);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${noEmailTokenA}` })).status, 200, 'Verified Supabase user IDs should authorize membership even without an email claim');
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), 'x-wrenchpro-user-email': 'tech-a@example.com', authorization: `Bearer ${noEmailSpoofToken}` })).status, 403, 'Bearer-authenticated requests must not trust spoofed membership email headers');
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${linkedEmailSpoofToken}` })).status, 403, 'Linked hosted memberships must require the matching Supabase user ID, not just a matching token email');

  const shopContextA = await request('GET', '/api/shop-context', undefined, aHeaders);
  assert.strictEqual(shopContextA.status, 200, JSON.stringify(shopContextA.body));
  assert.strictEqual(shopContextA.body.mode, 'shop');
  assert.strictEqual(shopContextA.body.shop.id, shopA);
  assert.strictEqual(shopContextA.body.shop.plan_code, 'founding_mechanic');
  assert.strictEqual(shopContextA.body.shop.billing_email, 'billing-a@example.com');
  assert.strictEqual(shopContextA.body.shop.trial_ends_at, '2099-12-31');
  assert.ok(!Object.prototype.hasOwnProperty.call(shopContextA.body.shop, 'supabase_org_id'), 'Shop context must not expose provider organization IDs');
  assert.strictEqual(shopContextA.body.membership.role, 'owner');
  assert.strictEqual(shopContextA.body.membership.email, 'tech-a@example.com');
  assert.ok(!Object.prototype.hasOwnProperty.call(shopContextA.body.membership, 'supabase_user_id'), 'Shop context must not expose provider user IDs');
  assert.ok(!Object.prototype.hasOwnProperty.call(shopContextA.body.membership, 'authorization'), 'Shop context must not expose bearer tokens');

  const customerA = await request('POST', '/api/customers', { first: 'Ada', last: 'Tenant' }, aHeaders);
  assert.strictEqual(customerA.status, 200, JSON.stringify(customerA.body));
  assert.strictEqual(customerA.body.shop_id, shopA);
  const customerB = await request('POST', '/api/customers', { first: 'Ben', last: 'Tenant' }, bHeaders);
  assert.strictEqual(customerB.status, 200, JSON.stringify(customerB.body));
  assert.strictEqual(customerB.body.shop_id, shopB);

  const visibleToA = await request('GET', '/api/customers', undefined, aHeaders);
  assert.deepStrictEqual(visibleToA.body.map(customer => customer.id), [customerA.body.id]);
  const visibleToB = await request('GET', '/api/customers', undefined, bHeaders);
  assert.deepStrictEqual(visibleToB.body.map(customer => customer.id), [customerB.body.id]);
  assert.strictEqual((await request('GET', `/api/customers/${customerB.body.id}`, undefined, aHeaders)).status, 404);

  const initialSettingsB = await request('GET', '/api/settings', undefined, bHeaders);
  assert.strictEqual(initialSettingsB.status, 200, JSON.stringify(initialSettingsB.body));
  assert.strictEqual(initialSettingsB.body.business_name, '', 'New hosted shops must not inherit or leak desktop/global settings');
  assert.strictEqual(initialSettingsB.body.owner_name, '', 'New hosted shops must not expose desktop owner identity');
  assert.strictEqual(initialSettingsB.body.tax_id, '', 'New hosted shops must not expose desktop tax identifiers');

  const settingsA = await request('PUT', '/api/settings', { business_name: 'A Mobile Repair', default_labor_rate: 125 }, aHeaders);
  assert.strictEqual(settingsA.status, 200, JSON.stringify(settingsA.body));
  const settingsB = await request('GET', '/api/settings', undefined, bHeaders);
  assert.notStrictEqual(settingsB.body.business_name, 'A Mobile Repair');

  const operationsA = await request('GET','/api/operations',undefined,aHeaders);
  const operationsB = await request('GET','/api/operations',undefined,bHeaders);
  assert.strictEqual(operationsA.status,200,JSON.stringify(operationsA.body));
  assert.strictEqual(operationsB.status,200,JSON.stringify(operationsB.body));
  assert.strictEqual(operationsA.body.workflow_columns.length,9);
  assert.strictEqual(operationsB.body.workflow_columns.length,9);
  const resourceA = await request('POST','/api/operations/resources',{name:'A Bay 1',resource_type:'bay',active:true},aHeaders);
  assert.strictEqual(resourceA.status,200,JSON.stringify(resourceA.body));
  const operationsBAfter = await request('GET','/api/operations',undefined,bHeaders);
  assert.ok(!operationsBAfter.body.resources.some(resource=>resource.id===resourceA.body.id),'Shop B must not see Shop A resources');
  assert.strictEqual((await request('PUT',`/api/operations/resources/${resourceA.body.id}`,{name:'Cross-tenant edit',resource_type:'bay',active:true},bHeaders)).status,404);
  const historyDb = new Database(path.join(dataDir, 'wrenchpro.db'));
  historyDb.prepare("INSERT INTO appointments (shop_id, resource_id, cust, service, date, time) VALUES (?, ?, 'Ada Tenant', 'Brake inspection', '2026-08-21', '09:00')").run(shopA, resourceA.body.id);
  historyDb.close();
  assert.strictEqual((await request('DELETE',`/api/operations/resources/${resourceA.body.id}`,undefined,bHeaders)).status,404,'Cross-tenant resource deletes must not reveal another shop scheduling history');
  assert.strictEqual((await request('DELETE',`/api/operations/resources/${resourceA.body.id}`,undefined,aHeaders)).status,409,'Own-shop resources with scheduling history should be protected');

  const hostedNoShopView = await request('GET', '/api/customers');
  assert.strictEqual(hostedNoShopView.status, 400, 'Hosted membership enforcement must not expose desktop compatibility data without a shop context');
  assert.strictEqual(hostedNoShopView.body.field, 'shop_id');
  const hostedNoShopContext = await request('GET', '/api/shop-context');
  assert.strictEqual(hostedNoShopContext.status, 400, 'Hosted shop context endpoint must require an explicit shop context');
  assert.strictEqual(hostedNoShopContext.body.field, 'shop_id');

  await runOptionalMembershipQa();
  await runMissingJwtSecretQa();
  await runMissingSupabaseUrlQa();

  console.log('Tenant membership QA passed:', JSON.stringify({ shopA, shopB, customerA: customerA.body.id, customerB: customerB.body.id }));
}

main().catch(error => { console.error(error); console.error(output); process.exitCode = 1; }).finally(() => child.kill());
