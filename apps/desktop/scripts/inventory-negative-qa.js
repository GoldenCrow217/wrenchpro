const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = String(6600 + Math.floor(Math.random() * 300));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-inventory-'));
const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const url = route => `http://127.0.0.1:${port}${route}`;

async function request(method, route, body) {
  const response = await fetch(url(route), {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  assert.match(response.headers.get('content-type') || '', /^application\/json\b/i);
  return { status: response.status, body: payload };
}

async function successful(method, route, body) {
  const result = await request(method, route, body);
  if (result.status >= 400) throw new Error(`${method} ${route}: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try { if ((await fetch(url('/api/health'))).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Server did not start:\n${output}`);
}

async function main() {
  await waitForServer();
  const fields = ['cost', 'retail_price', 'quantity', 'reorder_qty'];
  const invalidValues = [-0.01, '-2.5', 'NaN', 'Infinity', '-Infinity', 'not-a-number', {}, []];
  const initialCount = (await successful('GET', '/api/inventory')).length;

  for (const field of fields) {
    for (const value of invalidValues) {
      const result = await request('POST', '/api/inventory', { name: `Invalid ${field}`, [field]: value });
      assert.strictEqual(result.status, 400, `${field}=${JSON.stringify(value)}`);
      assert.strictEqual(result.body.field, field);
      assert.strictEqual(typeof result.body.error, 'string');
    }
  }
  assert.strictEqual((await successful('GET', '/api/inventory')).length, initialCount, 'rejected creates must not write records');

  const minimum = await successful('POST', '/api/inventory', { name: 'Minimum part' });
  const zero = await successful('POST', '/api/inventory', { name: 'Zero part', cost: 0, retail_price: 0, quantity: 0, reorder_qty: 0 });
  const fractional = await successful('POST', '/api/inventory', { name: 'Bulk fluid', part_number: 'FLUID-1', vendor: 'Supplier', cost: 1.275, retail_price: 2.555, quantity: 2.5, reorder_qty: 0.25, location: 'Shelf A', notes: 'Fractional stock' });
  assert.ok(minimum.id && zero.id && fractional.id);

  let stored = (await successful('GET', '/api/inventory')).find(item => item.id === fractional.id);
  assert.strictEqual(stored.cost, 1.275);
  assert.strictEqual(stored.retail_price, 2.555);
  assert.strictEqual(stored.quantity, 2.5);
  assert.strictEqual(stored.reorder_qty, 0.25);

  const snapshot = JSON.stringify(stored);
  for (const field of fields) {
    const update = { ...stored, [field]: '-1' };
    const result = await request('PUT', `/api/inventory/${fractional.id}`, update);
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.body.field, field);
    stored = (await successful('GET', '/api/inventory')).find(item => item.id === fractional.id);
    assert.strictEqual(JSON.stringify(stored), snapshot, 'rejected update must leave the record unchanged');
  }

  await successful('PUT', `/api/inventory/${fractional.id}`, { ...stored, cost: 1.5, retail_price: 3.25, quantity: 2.5, reorder_qty: 0.5 });
  stored = (await successful('GET', '/api/inventory')).find(item => item.id === fractional.id);
  assert.deepStrictEqual([stored.cost, stored.retail_price, stored.quantity, stored.reorder_qty], [1.5, 3.25, 2.5, 0.5]);

  const customer = await successful('POST', '/api/customers', { first: 'Inventory', last: 'QA' });
  const vehicle = await successful('POST', '/api/vehicles', { customer_id: customer.id, year: 2020, make: 'Test', model: 'Vehicle' });
  const estimate = await successful('POST', '/api/estimates', {
    customer_id: customer.id, vehicle_id: vehicle.id, date: '2026-08-03', status: 'Draft', total: 1.625,
    items: [{ type: 'part', description: 'Half unit', qty: 0.5, rate: 3.25, amount: 1.625, inventory_id: fractional.id }],
  });
  await successful('POST', `/api/estimates/${estimate.id}/convert`);
  stored = (await successful('GET', '/api/inventory')).find(item => item.id === fractional.id);
  assert.strictEqual(stored.quantity, 2, 'estimate conversion must continue deducting fractional quantities');

  console.log('Inventory non-negative value QA passed');
}

main().catch(error => { console.error(error); console.error(output); process.exitCode = 1; }).finally(() => child.kill());
