const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const JWT_SECRET = 'tenant-qa-secret-not-production';
const SUPABASE_URL = 'https://xgqidqyctypfbuhhzwai.supabase.co';
const port = String(6600 + Math.floor(Math.random() * 500));
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
  for (let i = 0; i < 100; i += 1) {
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
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
  const defaults = options.skipDefaults ? {} : { iss: `${SUPABASE_URL}/auth/v1`, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 };
  const body = base64urlJson({ ...defaults, ...payload });
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
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

async function main() {
  await waitForServer();

  const db = new Database(path.join(dataDir, 'wrenchpro.db'));
  const shopA = db.prepare("INSERT INTO shops (name, owner_email) VALUES ('A Mobile Repair', 'owner-a@example.com')").run().lastInsertRowid;
  const shopB = db.prepare("INSERT INTO shops (name, owner_email) VALUES ('B Mobile Repair', 'owner-b@example.com')").run().lastInsertRowid;
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'tech-a@example.com', 'owner', 'Tech A', 'user-a')").run(shopA);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id) VALUES (?, 'tech-b@example.com', 'owner', 'Tech B', 'user-b')").run(shopB);
  db.close();

  const tokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com' });
  const tokenB = signToken({ sub: 'user-b', email: 'tech-b@example.com' });
  const expiredTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', exp: Math.floor(Date.now() / 1000) - 10 });
  const noSubjectTokenA = signToken({ email: 'tech-a@example.com' });
  const noExpiryTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com' }, { skipDefaults: true });
  const badAudienceTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', aud: 'anon' });
  const badIssuerTokenA = signToken({ sub: 'user-a', email: 'tech-a@example.com', iss: 'https://evil.example/auth/v1' });
  const aHeaders = { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${tokenA}` };
  const bHeaders = { 'x-wrenchpro-shop-id': String(shopB), authorization: `Bearer ${tokenB}` };

  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': 'bad' })).status, 400);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': '999999' })).status, 404);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA) })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${expiredTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${noSubjectTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${noExpiryTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${badAudienceTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${badIssuerTokenA}` })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), authorization: `Bearer ${tokenB}` })).status, 403);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), 'x-wrenchpro-user-email': 'tech-b@example.com', authorization: `Bearer ${tokenA}` })).status, 200);

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

  const desktopView = await request('GET', '/api/customers');
  assert.ok(desktopView.body.length >= 2, 'Desktop compatibility mode should still see local records without a shop header');

  console.log('Tenant membership QA passed:', JSON.stringify({ shopA, shopB, customerA: customerA.body.id, customerB: customerB.body.id }));
}

main().catch(error => { console.error(error); console.error(output); process.exitCode = 1; }).finally(() => child.kill());
