const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const port = String(6600 + Math.floor(Math.random() * 500));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-tenant-'));
const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test', WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP: 'true' },
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
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name) VALUES (?, 'tech-a@example.com', 'owner', 'Tech A')").run(shopA);
  db.prepare("INSERT INTO shop_memberships (shop_id, email, role, display_name) VALUES (?, 'tech-b@example.com', 'owner', 'Tech B')").run(shopB);
  db.close();

  const aHeaders = { 'x-wrenchpro-shop-id': String(shopA), 'x-wrenchpro-user-email': 'tech-a@example.com' };
  const bHeaders = { 'x-wrenchpro-shop-id': String(shopB), 'x-wrenchpro-user-email': 'tech-b@example.com' };

  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': 'bad' })).status, 400);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': '999999' })).status, 404);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA) })).status, 401);
  assert.strictEqual((await request('GET', '/api/customers', undefined, { 'x-wrenchpro-shop-id': String(shopA), 'x-wrenchpro-user-email': 'tech-b@example.com' })).status, 403);

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

  const desktopView = await request('GET', '/api/customers');
  assert.ok(desktopView.body.length >= 2, 'Desktop compatibility mode should still see local records without a shop header');

  console.log('Tenant membership QA passed:', JSON.stringify({ shopA, shopB, customerA: customerA.body.id, customerB: customerB.body.id }));
}

main().catch(error => { console.error(error); console.error(output); process.exitCode = 1; }).finally(() => child.kill());
