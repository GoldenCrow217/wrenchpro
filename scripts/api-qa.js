const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = process.env.QA_PORT || String(4300 + Math.floor(Math.random() * 1000));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-api-qa-'));
const serverPath = path.join(__dirname, '..', 'server', 'index.js');
const baseUrl = `http://localhost:${port}`;

const child = spawn(process.execPath, [serverPath], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    PORT: port,
    WRENCHPRO_DATA: dataDir,
    NODE_ENV: 'test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(method, route, body) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    throw new Error(`${method} ${route} failed: HTTP ${res.status} ${text}`);
  }
  return parsed;
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}. Output:\n${output}`);
    }
    try {
      await request('GET', '/api/dashboard');
      return;
    } catch {
      await sleep(300);
    }
  }
  throw new Error(`Timed out waiting for server. Output:\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  try {
    await waitForServer();

    const lead = await request('POST', '/api/leads', {
      first: 'QA',
      last: 'Lead',
      phone: '555-0001',
      source: 'QA',
      vehicle_year: 2015,
      vehicle_make: 'Ford',
      vehicle_model: 'F-150',
      service_needed: 'Brake inspection',
      estimated_value: 250,
    });
    assert(lead.id, 'Lead did not return id');

    const converted = await request('POST', `/api/leads/${lead.id}/convert`);
    assert(converted.customer_id, 'Lead conversion did not return customer_id');

    const customers = await request('GET', '/api/customers');
    assert(customers.some(c => c.id === converted.customer_id), 'Converted customer not found');

    const vehicles = await request('GET', '/api/vehicles');
    const vehicle = vehicles.find(v => v.customer_id === converted.customer_id);
    assert(vehicle && vehicle.id, 'Converted vehicle not found');

    const estimate = await request('POST', '/api/estimates', {
      customer_id: converted.customer_id,
      vehicle_id: vehicle.id,
      date: '2026-04-29',
      status: 'Draft',
      customer_complaint: 'Brake noise',
      notes: 'QA estimate',
      total: 300,
      items: [
        { type: 'labor', description: 'Brake diagnostic', qty: 1, rate: 100, amount: 100 },
        { type: 'parts', description: 'Brake pads', qty: 1, rate: 200, amount: 200 },
      ],
    });
    assert(estimate.id, 'Estimate did not return id');

    const jobFromEstimate = await request('POST', `/api/estimates/${estimate.id}/convert`);
    assert(jobFromEstimate.job_id, 'Estimate conversion did not return job_id');

    const jobs = await request('GET', '/api/jobs');
    assert(jobs.some(j => j.id === jobFromEstimate.job_id), 'Converted job not found');

    await request('PUT', `/api/jobs/${jobFromEstimate.job_id}`, {
      service: 'Brake diagnostic, Brake pads',
      date: '2026-04-29',
      miles: 123456,
      labor: 100,
      labor_hours: 1,
      labor_rate: 100,
      parts: 200,
      status: 'Done',
      notes: 'QA completed',
      complaint: 'Brake noise',
      diagnosis: 'Pads worn',
      invoice_status: 'Paid',
      estimate_id: estimate.id,
    });

    const dashboard = await request('GET', '/api/dashboard');
    assert(dashboard.totalCustomers >= 1, 'Dashboard totalCustomers did not update');
    assert(Array.isArray(dashboard.recentJobs), 'Dashboard recentJobs is not an array');

    console.log('API QA passed:', JSON.stringify({
      port,
      dataDir,
      leadId: lead.id,
      customerId: converted.customer_id,
      vehicleId: vehicle.id,
      estimateId: estimate.id,
      jobId: jobFromEstimate.job_id,
    }));
  } finally {
    child.kill();
  }
})().catch(err => {
  child.kill();
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
