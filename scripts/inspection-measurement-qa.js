const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-inspection-measurement-qa-'));
const dbPath = path.join(dataDir, 'wrenchpro.db');
const port = String(6100 + Math.floor(Math.random() * 300));
const baseUrl = `http://127.0.0.1:${port}`;
let child;
let output = '';

const legacyDb = new Database(dbPath);
legacyDb.exec(`
  CREATE TABLE inspection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER NOT NULL,
    category TEXT DEFAULT '',
    item_name TEXT DEFAULT '',
    condition TEXT DEFAULT 'pass',
    notes TEXT DEFAULT ''
  )
`);
legacyDb.close();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function raw(method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, ok: response.ok, body: parsed, text };
}
async function request(method, route, body) {
  const result = await raw(method, route, body);
  if (!result.ok) throw new Error(`${method} ${route}: HTTP ${result.status} ${result.text}`);
  return result.body;
}
async function start() {
  child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  for (let attempt = 0; attempt < 75; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try { if ((await request('GET', '/api/health')).ok) return; } catch { await sleep(100); }
  }
  throw new Error(`Server did not start:\n${output}`);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
}

(async () => {
  try {
    await start();
    const schemaDb = new Database(dbPath, { readonly: true });
    const itemColumns = schemaDb.prepare('PRAGMA table_info(inspection_items)').all().map(column => column.name);
    schemaDb.close();
    assert(itemColumns.includes('measurement_value') && itemColumns.includes('measurement_unit'), 'Legacy inspection schema did not migrate measurement columns');

    const customer = await request('POST', '/api/customers', { first: 'Measurement', last: 'Tester' });
    const vehicle = await request('POST', '/api/vehicles', { customer_id: customer.id, year: 2022, make: 'Ford', model: 'Transit' });
    const inspection = await request('POST', '/api/inspections', {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      date: '2026-08-16',
      status: 'Draft',
      items: [
        { category: 'Brakes', item_name: 'Brake pad thickness — LF', condition: 'pass', measurement_value: 6.5, measurement_unit: 'mm' },
        { category: 'Brakes', item_name: 'Rotor thickness — LF', condition: 'advisory', measurement_value: 23.4, measurement_unit: 'mm' },
        { category: 'Tires', item_name: 'Tread depth — LF', condition: 'pass', measurement_value: 7, measurement_unit: '32nds' },
        { category: 'Fluids', item_name: 'Engine oil', condition: 'pass' },
      ],
    });
    const saved = (await request('GET', '/api/inspections')).find(row => row.id === inspection.id);
    assert.deepStrictEqual(saved.items.slice(0, 3).map(item => [item.measurement_value, item.measurement_unit]), [[6.5, 'mm'], [23.4, 'mm'], [7, '32nds']], 'Inspection measurements did not persist');
    assert.strictEqual(saved.items[3].measurement_value, null, 'An ordinary checklist item should not invent a measurement');

    await request('PUT', `/api/inspections/${inspection.id}`, {
      notes: 'Measurements rechecked',
      status: 'Complete',
      items: saved.items.map(item => item.item_name.includes('Brake pad') ? { ...item, measurement_value: 5.5, condition: 'advisory' } : item),
    });
    const updated = (await request('GET', '/api/inspections')).find(row => row.id === inspection.id);
    assert.strictEqual(updated.items[0].measurement_value, 5.5, 'Edited brake measurement did not persist');
    assert.strictEqual(updated.items[0].condition, 'advisory', 'Measurement edit did not preserve the selected condition');

    for (const [item, field] of [
      [{ category: 'Brakes', item_name: 'Bad negative', condition: 'fail', measurement_value: -1, measurement_unit: 'mm' }, 'measurement_value'],
      [{ category: 'Brakes', item_name: 'Bad text', condition: 'fail', measurement_value: 'not-a-number', measurement_unit: 'mm' }, 'measurement_value'],
      [{ category: 'Brakes', item_name: 'Bad unit', condition: 'fail', measurement_value: 1, measurement_unit: 'inches' }, 'measurement_unit'],
      [{ category: 'Brakes', item_name: 'Bad condition', condition: 'broken', measurement_value: 1, measurement_unit: 'mm' }, 'condition'],
    ]) {
      const rejected = await raw('PUT', `/api/inspections/${inspection.id}`, { notes: 'Must not save', status: 'Complete', items: [item] });
      assert.strictEqual(rejected.status, 400, `Invalid ${field} did not return HTTP 400`);
      assert.strictEqual(rejected.body.field, field, `Invalid ${field} did not return a field-specific error`);
    }
    const unchanged = (await request('GET', '/api/inspections')).find(row => row.id === inspection.id);
    assert.strictEqual(unchanged.items[0].measurement_value, 5.5, 'Rejected measurement update changed the saved inspection');

    const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
    for (const marker of ['Brake pad thickness — LF', 'Rotor thickness — RR', 'Tread depth — RF', 'Tire pressure — LR']) {
      assert(html.includes(marker), `Inspection template is missing ${marker}`);
    }
    assert.match(html, /setInspMeasurement\(\$\{idx\},this\.value\)/, 'Inspection checklist does not expose measurement inputs');
    console.log('Inspection measurement QA passed: migration, persistence, editing, validation, and per-corner template');
  } finally {
    await stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
