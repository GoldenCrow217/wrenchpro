const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = process.env.SMOKE_PORT || String(3300 + Math.floor(Math.random() * 1000));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-smoke-'));
const serverPath = path.join(__dirname, '..', 'server', 'index.js');

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

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const startedAt = Date.now();

async function waitForDashboard() {
  const url = `http://localhost:${port}/api/dashboard`;
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}. Output:\n${output}`);
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        const expected = ['totalRevenue', 'totalExpenses', 'netProfit', 'activeJobs', 'totalCustomers', 'totalVehicles'];
        const missing = expected.filter(key => !(key in body));
        if (missing.length) {
          throw new Error(`Dashboard response missing keys: ${missing.join(', ')}`);
        }
        return body;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  throw new Error(`Smoke test timed out waiting for dashboard. Last error: ${lastError && lastError.message}\nOutput:\n${output}`);
}

(async () => {
  try {
    const body = await waitForDashboard();
    console.log('Smoke test passed:', JSON.stringify({
      port,
      dataDir,
      totalCustomers: body.totalCustomers,
      activeJobs: body.activeJobs,
    }));
  } finally {
    child.kill();
  }
})().catch(err => {
  child.kill();
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
