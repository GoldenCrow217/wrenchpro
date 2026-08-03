const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const port = String(6100 + Math.floor(Math.random() * 500));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-validation-'));
const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const url = route => `http://127.0.0.1:${port}${route}`;

async function request(method, route, body, raw = false) {
  const response = await fetch(url(route), {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
  });
  assert.match(response.headers.get('content-type') || '', /^application\/json\b/i);
  return { status: response.status, body: await response.json() };
}

async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try { if ((await fetch(url('/api/health'))).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Server did not start:\n${output}`);
}

async function expect400(method, route, body, field, raw = false) {
  const result = await request(method, route, body, raw);
  assert.strictEqual(result.status, 400, `${method} ${route}: ${JSON.stringify(result.body)}`);
  assert.strictEqual(result.body.field, field);
  assert.strictEqual(typeof result.body.error, 'string');
  assert.ok(!/sqlite|constraint|insert into|update |\\|\/users\//i.test(result.body.error));
}

async function main() {
  await waitForServer();
  const resources = ['/api/leads', '/api/inventory', '/api/appointments', '/api/expenses'];
  const before = {};
  for (const route of resources) before[route] = (await request('GET', route)).body.length;

  await expect400('POST', '/api/leads', {}, 'first');
  await expect400('POST', '/api/leads', { first: '   ' }, 'first');
  await expect400('POST', '/api/leads', { first: 'A', estimated_value: 'NaN' }, 'estimated_value');
  await expect400('POST', '/api/leads', '{"first":"A","estimated_value":"Infinity"}', 'estimated_value', true);

  await expect400('POST', '/api/inventory', {}, 'name');
  await expect400('POST', '/api/inventory', { name: '   ' }, 'name');
  for (const field of ['cost', 'retail_price', 'quantity', 'reorder_qty']) await expect400('POST', '/api/inventory', { name: 'Part', [field]: 'NaN' }, field);

  await expect400('POST', '/api/appointments', {}, 'date');
  await expect400('POST', '/api/appointments', { date: '2026-02-30' }, 'date');
  await expect400('POST', '/api/appointments', { date: '2026-08-03', time: '25:00' }, 'time');
  await expect400('POST', '/api/appointments', { date: '2026-08-03', customer_id: 'bad' }, 'customer_id');
  const missingRelation = await request('POST', '/api/appointments', { date: '2026-08-03', customer_id: 999999 });
  assert.strictEqual(missingRelation.status, 404);
  assert.strictEqual(missingRelation.body.field, 'customer_id');

  for (const field of ['date', 'description', 'category', 'amount']) {
    const valid = { date: '2026-08-03', description: 'Shop supplies', category: 'Supplies', amount: 1 };
    delete valid[field];
    await expect400('POST', '/api/expenses', valid, field);
  }
  await expect400('POST', '/api/expenses', { date: '2026-08-03', description: ' ', category: 'Supplies', amount: 1 }, 'description');
  for (const value of ['NaN', 'Infinity', '-Infinity']) await expect400('POST', '/api/expenses', { date: '2026-08-03', description: 'Fuel', category: 'Fuel', amount: value }, 'amount');

  for (const route of resources) assert.strictEqual((await request('GET', route)).body.length, before[route], `${route} must not contain partial records`);

  const lead = await request('POST', '/api/leads', { first: '  Ada  ' });
  assert.strictEqual(lead.status, 200); assert.strictEqual(lead.body.first, 'Ada');
  const part = await request('POST', '/api/inventory', { name: ' Filter ', cost: 1.25, retail_price: 2.5, quantity: 3, reorder_qty: 1 });
  assert.strictEqual(part.status, 200);
  const appt = await request('POST', '/api/appointments', { cust: 'Walk-in', date: '2026-08-03', time: '09:30', service: 'Check' });
  assert.strictEqual(appt.status, 200);
  const expense = await request('POST', '/api/expenses', { date: '2026-08-03', description: 'Fuel', category: 'Fuel', amount: 12.5 });
  assert.strictEqual(expense.status, 200);

  await expect400('PUT', `/api/leads/${lead.body.id}`, { first: ' ' }, 'first');
  await expect400('PUT', `/api/inventory/${part.body.id}`, { name: 'Part', cost: 'Infinity' }, 'cost');
  await expect400('PUT', `/api/appointments/${appt.body.id}`, { date: 'bad' }, 'date');
  await expect400('PUT', `/api/expenses/${expense.body.id}`, { date: '2026-08-03', description: 'Fuel', category: 'Fuel', amount: 'NaN' }, 'amount');
  await expect400('PUT', '/api/expenses/not-an-id', { date: '2026-08-03', description: 'Fuel', category: 'Fuel', amount: 1 }, 'id');
  assert.strictEqual((await request('PUT', '/api/expenses/999999', { date: '2026-08-03', description: 'Fuel', category: 'Fuel', amount: 1 })).status, 404);

  const db = new Database(path.join(dataDir, 'wrenchpro.db'));
  db.exec("CREATE TRIGGER validation_failure BEFORE INSERT ON expenses BEGIN SELECT RAISE(FAIL, 'secret sqlite injected failure'); END");
  db.close();
  const injected = await request('POST', '/api/expenses', { date: '2026-08-03', description: 'Valid', category: 'Test', amount: 1 });
  assert.strictEqual(injected.status, 500);
  assert.deepStrictEqual(injected.body, { error: 'Internal server error' });

  console.log('API validation QA passed');
}

main().catch(error => { console.error(error); console.error(output); process.exitCode = 1; }).finally(() => child.kill());
