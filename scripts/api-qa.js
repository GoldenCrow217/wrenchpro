const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = process.env.QA_PORT || String(4300 + Math.floor(Math.random() * 1000));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-api-qa-'));
const serverPath = path.join(__dirname, '..', 'server', 'index.js');
const baseUrl = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, [serverPath], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function requestRaw(method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { ok: response.ok, status: response.status, body: parsed, text };
}

async function request(method, route, body) {
  const result = await requestRaw(method, route, body);
  if (!result.ok) throw new Error(`${method} ${route} failed: HTTP ${result.status} ${result.text}`);
  return result.body;
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) throw new Error(`Server exited early. Output:\n${output}`);
    try {
      const health = await request('GET', '/api/health');
      if (health.ok) return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`Timed out waiting for server. Output:\n${output}`);
}

(async () => {
  try {
    await waitForServer();

    const health = await request('GET', '/api/health');
    assert(health.ok && health.version, 'Desktop health response is incomplete');
    assert(!('authRequired' in health) && !('supabaseConfigured' in health), 'Health still exposes SaaS state');
    assert((await requestRaw('GET', '/api/auth/config')).status === 404, 'Removed auth API should stay unavailable');
    assert((await requestRaw('GET', '/api/shops')).status === 404, 'Removed multi-shop API should stay unavailable');

    const markupTiers = [
      { up_to: 1, markup: 125 }, { up_to: 5, markup: 75 },
      { up_to: 10, markup: 60 }, { up_to: null, markup: 15 },
    ];
    await request('PUT', '/api/settings', { parts_markup_tiers: JSON.stringify(markupTiers) });
    const savedSettings = await request('GET', '/api/settings');
    assert(JSON.stringify(JSON.parse(savedSettings.parts_markup_tiers)) === JSON.stringify(markupTiers), 'Parts markup settings did not persist');
    const invalidTiers = await requestRaw('PUT', '/api/settings', { parts_markup_tiers: '[{"up_to":1,"markup":-1}]' });
    assert(invalidTiers.status === 400 && invalidTiers.body.field === 'parts_markup_tiers', 'Invalid parts markup settings should return field-specific HTTP 400');

    const emptyCustomer = await requestRaw('POST', '/api/customers');
    assert(emptyCustomer.status === 400, `Empty JSON body should return 400, got ${emptyCustomer.status}`);

    const lead = await request('POST', '/api/leads', {
      first: 'Repeat',
      last: 'Lead',
      phone: '555-0100',
      vehicle_year: 2020,
      vehicle_make: 'Ford',
      vehicle_model: 'Transit',
      service_needed: 'Brakes',
    });
    const firstLeadConversion = await request('POST', `/api/leads/${lead.id}/convert`);
    const secondLeadConversion = await request('POST', `/api/leads/${lead.id}/convert`);
    assert(firstLeadConversion.customer_id === secondLeadConversion.customer_id, 'Repeat lead conversion created a second customer');
    assert(secondLeadConversion.already_converted === true, 'Repeat lead conversion was not identified as idempotent');

    const customer = await request('POST', '/api/customers', {
      first: 'Inventory',
      last: 'Check',
      phone: '555-0200',
    });
    const vehicle = await request('POST', '/api/vehicles', {
      customer_id: customer.id,
      year: 2019,
      make: 'Chevrolet',
      model: 'Express',
    });
    const inventory = await request('POST', '/api/inventory', {
      name: 'Brake Pad Set',
      quantity: 1,
      cost: 40,
      retail_price: 80,
    });
    const estimate = await request('POST', '/api/estimates', {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      date: '2026-07-29',
      status: 'Approved',
      customer_complaint: 'Brake noise',
      items: [{
        type: 'part',
        description: 'Brake pads',
        qty: 2,
        rate: 80,
        amount: 160,
        inventory_id: inventory.id,
      }],
    });
    const taxedEstimate = await request('POST', '/api/estimates', {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      date: '2026-07-29',
      tax_rate: 10,
      total: 999,
      items: [
        { type: 'labor', description: 'Labor', qty: 1, rate: 100, amount: 100 },
        { type: 'parts', description: 'Part', qty: 1, rate: 50, amount: 50 },
      ],
    });
    assert(taxedEstimate.total === 155, `Estimate should tax only parts and ignore a supplied total, got ${taxedEstimate.total}`);

    const insufficient = await requestRaw('POST', `/api/estimates/${estimate.id}/convert`);
    assert(insufficient.status === 409, `Insufficient inventory should return 409, got ${insufficient.status}`);
    let inventoryRows = await request('GET', '/api/inventory');
    assert(inventoryRows.find(row => row.id === inventory.id).quantity === 1, 'Rejected conversion changed inventory');

    await request('PUT', `/api/estimates/${estimate.id}`, {
      status: 'Approved',
      customer_complaint: 'Brake noise',
      items: [{
        type: 'part',
        description: 'Brake pads',
        qty: 1,
        rate: 80,
        amount: 80,
        inventory_id: inventory.id,
      }],
    });
    const firstEstimateConversion = await request('POST', `/api/estimates/${estimate.id}/convert`);
    const secondEstimateConversion = await request('POST', `/api/estimates/${estimate.id}/convert`);
    assert(firstEstimateConversion.job_id === secondEstimateConversion.job_id, 'Repeat estimate conversion created a second job');
    assert(secondEstimateConversion.already_converted === true, 'Repeat estimate conversion was not identified as idempotent');
    inventoryRows = await request('GET', '/api/inventory');
    assert(inventoryRows.find(row => row.id === inventory.id).quantity === 0, 'Successful conversion did not deduct inventory exactly once');

    await request('PUT', `/api/jobs/${firstEstimateConversion.job_id}`, {
      service: 'Brake pads',
      date: '2026-07-29',
      status: 'Complete',
      estimate_id: estimate.id,
      items: [{ type: 'part', description: 'Brake pads', qty: 1, rate: 80, amount: 80, taxable: 1 }],
    });
    let jobs = await request('GET', '/api/jobs');
    assert(jobs.find(job => job.id === firstEstimateConversion.job_id).closed_at, 'Completed job did not receive closed_at');

    await request('PUT', `/api/jobs/${firstEstimateConversion.job_id}`, {
      service: 'Brake pads',
      date: '2026-07-29',
      status: 'In Progress',
      estimate_id: estimate.id,
      items: [{ type: 'part', description: 'Brake pads', qty: 1, rate: 80, amount: 80, taxable: 1 }],
    });
    jobs = await request('GET', '/api/jobs');
    assert(jobs.find(job => job.id === firstEstimateConversion.job_id).closed_at === null, 'Reopened job retained closed_at');

    console.log('Local desktop API QA passed:', JSON.stringify({
      port,
      leadId: lead.id,
      customerId: customer.id,
      estimateId: estimate.id,
      jobId: firstEstimateConversion.job_id,
    }));
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
