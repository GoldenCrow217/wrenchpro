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
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'mechanic-a@example.com', 'mechanic', 'Mechanic A', 'user-mechanic-a')").run(shopA);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'advisor-a@example.com', 'service_writer', 'Advisor A', 'user-advisor-a')").run(shopA);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'tech-b@example.com', 'owner', 'Tech B', 'user-b')").run(shopB);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'owner-suspended@example.com', 'owner', 'Suspended Owner', 'user-suspended')").run(suspendedShop);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'owner-expired@example.com', 'owner', 'Expired Trial Owner', 'user-expired')").run(expiredTrialShop);
  db.close();

  const tokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com' });
  const tokenB = signToken({ sub: 'user-b', email: 'tech-b@example.com' });
  const mechanicTokenA = signToken({ sub: 'user-mechanic-a', email: 'mechanic-a@example.com' });
  const serviceWriterTokenA = signToken({ sub: 'user-advisor-a', email: 'advisor-a@example.com' });
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
  const mechanicHeadersA = { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${mechanicTokenA}` };
  const serviceWriterHeadersA = { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${serviceWriterTokenA}` };
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

  const mechanicShopContextA = await request('GET', '/api/shop-context', undefined, mechanicHeadersA);
  assert.strictEqual(mechanicShopContextA.status, 200, JSON.stringify(mechanicShopContextA.body));
  assert.strictEqual(mechanicShopContextA.body.membership.role, 'mechanic');
  assert.strictEqual(mechanicShopContextA.body.shop.name, 'A Mobile Repair');
  assert.strictEqual(mechanicShopContextA.body.shop.trial_ends_at, '2099-12-31');
  assert.ok(!Object.prototype.hasOwnProperty.call(mechanicShopContextA.body.shop, 'owner_email'), 'Non-admin shop members must not see owner emails in shop context');
  assert.ok(!Object.prototype.hasOwnProperty.call(mechanicShopContextA.body.shop, 'billing_email'), 'Non-admin shop members must not see billing emails in shop context');
  assert.ok(!Object.prototype.hasOwnProperty.call(mechanicShopContextA.body.shop, 'plan_code'), 'Non-admin shop members must not see plan codes in shop context');
  assert.ok(!Object.prototype.hasOwnProperty.call(mechanicShopContextA.body.shop, 'current_period_ends_at'), 'Non-admin shop members must not see billing period details in shop context');

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

  const mechanicSettings = await request('PUT', '/api/settings', { business_name: 'Mechanic Edit Attempt', default_labor_rate: 125 }, mechanicHeadersA);
  assert.strictEqual(mechanicSettings.status, 403, 'Hosted mechanics must not be able to edit shop billing/settings data');
  assert.strictEqual(mechanicSettings.body.field, 'role');
  const mechanicEmployee = await request('POST', '/api/employees', { first: 'Unauthorized', last: 'Hire', role: 'Mechanic', hourly_rate: 20 }, mechanicHeadersA);
  assert.strictEqual(mechanicEmployee.status, 403, 'Hosted mechanics must not be able to manage staff records');
  const mechanicPayment = await request('POST', '/api/payments', {}, mechanicHeadersA);
  assert.strictEqual(mechanicPayment.status, 403, 'Hosted mechanics must not be able to record payments');
  const advisorPaymentValidation = await request('POST', '/api/payments', {}, serviceWriterHeadersA);
  assert.strictEqual(advisorPaymentValidation.status, 400, 'Hosted service writers should pass the payment role guard and then hit normal validation');
  const mechanicExpense = await request('POST', '/api/expenses', { date: '2026-09-29', description: 'Unauthorized parts run', category: 'Parts & supplies', amount: 42 }, mechanicHeadersA);
  assert.strictEqual(mechanicExpense.status, 403, 'Hosted mechanics must not be able to create expense records');
  const advisorExpense = await request('POST', '/api/expenses', { date: '2026-09-29', description: 'Unauthorized office expense', category: 'Supplies', amount: 12 }, serviceWriterHeadersA);
  assert.strictEqual(advisorExpense.status, 403, 'Hosted service writers must not be able to create expense records');
  const ownerExpenseValidation = await request('POST', '/api/expenses', {}, aHeaders);
  assert.strictEqual(ownerExpenseValidation.status, 400, 'Hosted owners should pass the expense role guard and then hit normal validation');
  const mechanicInventory = await request('POST', '/api/inventory', { name: 'Unauthorized filter', cost: 5, retail_price: 12, quantity: 1, reorder_qty: 1 }, mechanicHeadersA);
  assert.strictEqual(mechanicInventory.status, 403, 'Hosted mechanics must not manage inventory costs/stock');
  const advisorInventory = await request('POST', '/api/inventory', { name: 'Advisor filter', cost: 5, retail_price: 12, quantity: 1, reorder_qty: 1 }, serviceWriterHeadersA);
  assert.strictEqual(advisorInventory.status, 403, 'Hosted service writers must not manage inventory costs/stock');
  const ownerInventoryValidation = await request('POST', '/api/inventory', {}, aHeaders);
  assert.strictEqual(ownerInventoryValidation.status, 400, 'Hosted owners should pass the inventory role guard and then hit normal validation');
  const mechanicCatalog = await request('POST', '/api/catalog', { name: 'Unauthorized service', default_hours: 1, default_price: 99 }, mechanicHeadersA);
  assert.strictEqual(mechanicCatalog.status, 403, 'Hosted mechanics must not manage the service catalog');
  const advisorCatalog = await request('POST', '/api/catalog', { name: 'Advisor service', default_hours: 1, default_price: 99 }, serviceWriterHeadersA);
  assert.strictEqual(advisorCatalog.status, 403, 'Hosted service writers must not manage the service catalog');
  const ownerCatalogValidation = await request('POST', '/api/catalog', {}, aHeaders);
  assert.strictEqual(ownerCatalogValidation.status, 400, 'Hosted owners should pass the catalog role guard and then hit normal validation');
  const mechanicEstimate = await request('POST', '/api/estimates', { customer_id: customerA.body.id, vehicle_id: 1, date: '2026-09-29', status: 'Draft', total: 100 }, mechanicHeadersA);
  assert.strictEqual(mechanicEstimate.status, 403, 'Hosted mechanics must not create estimates or quote customer-facing prices');
  const advisorEstimateValidation = await request('POST', '/api/estimates', {}, serviceWriterHeadersA);
  assert.strictEqual(advisorEstimateValidation.status, 400, 'Hosted service writers should pass the estimate role guard and then hit normal validation');

  const roleDb = new Database(path.join(dataDir, 'wrenchpro.db'));
  const vehicleA = roleDb.prepare("INSERT INTO vehicles (customer_id, year, make, model, miles) VALUES (?, 2018, 'Toyota', 'Camry', 90000)").run(customerA.body.id).lastInsertRowid;
  const paidGuardJob = roleDb.prepare("INSERT INTO jobs (customer_id, vehicle_id, service, repair_order_number, date, labor, parts, status, invoice_status) VALUES (?, ?, 'Payment guard repair', 'RO-GUARD', '2026-09-29', 100, 20, 'Complete', 'Unpaid')").run(customerA.body.id, vehicleA).lastInsertRowid;
  const planGuard = roleDb.prepare("INSERT INTO payment_plans (customer_id, job_id, description, total, down_payment, installment_count, start_date) VALUES (?, ?, 'Guard plan', 120, 0, 1, '2026-09-29')").run(customerA.body.id, paidGuardJob).lastInsertRowid;
  const installmentGuard = roleDb.prepare("INSERT INTO installments (plan_id, due_date, amount, paid) VALUES (?, '2026-10-29', 120, 0)").run(planGuard).lastInsertRowid;
  roleDb.close();
  const mechanicQuickPaid = await request('POST', '/api/quick-entry', { first: 'Quick', last: 'Guard', make: 'Ford', model: 'F-150', service: 'Oil service', date: '2026-09-29', amount_paid: 25, payment_date: '2026-09-29' }, mechanicHeadersA);
  assert.strictEqual(mechanicQuickPaid.status, 403, 'Hosted mechanics must not record payments through quick entry');
  const mechanicPaidJobCreate = await request('POST', '/api/jobs', { customer_id: customerA.body.id, vehicle_id: vehicleA, service: 'Paid create guard', repair_order_number: 'RO-PAID-CREATE', date: '2026-09-29', labor: 50, parts: 0, status: 'Complete', invoice_status: 'Paid' }, mechanicHeadersA);
  assert.strictEqual(mechanicPaidJobCreate.status, 403, 'Hosted mechanics must not create paid repair orders that auto-record payments');
  const mechanicPaidJobUpdate = await request('PUT', `/api/jobs/${paidGuardJob}`, { invoice_status: 'Paid' }, mechanicHeadersA);
  assert.strictEqual(mechanicPaidJobUpdate.status, 403, 'Hosted mechanics must not mark repair orders paid and auto-record payments');
  const mechanicPlan = await request('POST', '/api/plans', { customer_id: customerA.body.id, job_id: paidGuardJob, description: 'Unauthorized plan', total: 120, down_payment: 0, installment_count: 1, start_date: '2026-09-29', installments: [{ due_date: '2026-10-29', amount: 120 }] }, mechanicHeadersA);
  assert.strictEqual(mechanicPlan.status, 403, 'Hosted mechanics must not create payment plans');
  const mechanicInstallmentPay = await request('PUT', `/api/plans/installment/${installmentGuard}/pay`, { date: '2026-09-29' }, mechanicHeadersA);
  assert.strictEqual(mechanicInstallmentPay.status, 403, 'Hosted mechanics must not record installment payments');
  const mechanicPlanLink = await request('PUT', `/api/plans/${planGuard}/link-job`, { job_id: paidGuardJob }, mechanicHeadersA);
  assert.strictEqual(mechanicPlanLink.status, 403, 'Hosted mechanics must not relink payment plans');
  const mechanicPlanDelete = await request('DELETE', `/api/plans/${planGuard}`, undefined, mechanicHeadersA);
  assert.strictEqual(mechanicPlanDelete.status, 403, 'Hosted mechanics must not delete payment plans');

  const settingsA = await request('PUT', '/api/settings', { business_name: 'A Mobile Repair', owner_name: 'Private Owner A', tax_id: 'PRIVATE-TAX-A', default_labor_rate: 125 }, aHeaders);
  assert.strictEqual(settingsA.status, 200, JSON.stringify(settingsA.body));
  assert.strictEqual(settingsA.body.owner_name, 'Private Owner A', 'Hosted owners should see private shop settings after saving');
  assert.strictEqual(settingsA.body.tax_id, 'PRIVATE-TAX-A', 'Hosted owners should see tax identifiers after saving');
  const mechanicSettingsView = await request('GET', '/api/settings', undefined, mechanicHeadersA);
  assert.strictEqual(mechanicSettingsView.status, 200, JSON.stringify(mechanicSettingsView.body));
  assert.strictEqual(mechanicSettingsView.body.business_name, 'A Mobile Repair', 'Hosted mechanics still need public shop settings for normal app rendering');
  assert.strictEqual(mechanicSettingsView.body.default_labor_rate, 125, 'Hosted mechanics still need operational rates for normal app calculations');
  assert.strictEqual(mechanicSettingsView.body.owner_name, '', 'Hosted mechanics must not see private owner identity in settings');
  assert.strictEqual(mechanicSettingsView.body.tax_id, '', 'Hosted mechanics must not see shop tax identifiers in settings');
  const settingsB = await request('GET', '/api/settings', undefined, bHeaders);
  assert.notStrictEqual(settingsB.body.business_name, 'A Mobile Repair');

  const operationsA = await request('GET','/api/operations',undefined,aHeaders);
  const operationsB = await request('GET','/api/operations',undefined,bHeaders);
  assert.strictEqual(operationsA.status,200,JSON.stringify(operationsA.body));
  assert.strictEqual(operationsB.status,200,JSON.stringify(operationsB.body));
  assert.strictEqual(operationsA.body.workflow_columns.length,9);
  assert.strictEqual(operationsB.body.workflow_columns.length,9);
  assert.strictEqual((await request('POST','/api/operations/workflow-columns',{name:'Unauthorized column'},mechanicHeadersA)).status,403,'Hosted mechanics must not change workflow configuration');
  assert.strictEqual((await request('POST','/api/operations/resources',{name:'Unauthorized bay',resource_type:'bay'},mechanicHeadersA)).status,403,'Hosted mechanics must not manage shop resources');
  assert.strictEqual((await request('POST','/api/operations/inspection-templates',{name:'Unauthorized template',items:[{item_name:'Brakes'}]},serviceWriterHeadersA)).status,403,'Hosted service writers must not manage inspection templates');
  assert.strictEqual((await request('POST','/api/operations/vendors',{name:'Unauthorized vendor'},mechanicHeadersA)).status,403,'Hosted mechanics must not manage vendors');
  assert.strictEqual((await request('POST','/api/operations/purchase-orders',{items:[]},mechanicHeadersA)).status,403,'Hosted mechanics must not create purchase orders or update inventory costs');
  assert.strictEqual((await request('POST','/api/operations/reservations',{inventory_id:1,job_id:paidGuardJob,quantity:1},mechanicHeadersA)).status,403,'Hosted mechanics must not reserve inventory stock');
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
