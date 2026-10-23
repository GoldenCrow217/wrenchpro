const assert = require('assert');
const { freePortSync } = require('./qa-port');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function startServer(envOverrides, label) {
  const port = freePortSync();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `wrenchpro-hosted-security-${label}-`));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test', ...envOverrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 400; i += 1) {
    if (child.exitCode !== null) throw new Error(`${label} server exited early:\n${output}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return { child, baseUrl, output: () => output }; } catch {}
    await sleep(50);
  }
  child.kill();
  throw new Error(`${label} server did not start:\n${output}`);
}

async function corsHeader(baseUrl, origin, route = '/api/health') {
  const response = await fetch(`${baseUrl}${route}`, { headers: { Origin: origin } });
  return {
    status: response.status,
    allowOrigin: response.headers.get('access-control-allow-origin'),
    noStore: response.headers.get('cache-control'),
    nosniff: response.headers.get('x-content-type-options'),
    frameOptions: response.headers.get('x-frame-options'),
    referrerPolicy: response.headers.get('referrer-policy'),
    permissionsPolicy: response.headers.get('permissions-policy'),
    csp: response.headers.get('content-security-policy'),
  };
}

async function corsPreflight(baseUrl, origin, route = '/api/customers') {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,x-wrenchpro-shop-id,content-type',
    },
  });
  return {
    status: response.status,
    allowOrigin: response.headers.get('access-control-allow-origin'),
    allowHeaders: response.headers.get('access-control-allow-headers'),
    vary: response.headers.get('vary'),
  };
}

// fetch() cannot override Host, so use http.request to simulate traffic that
// arrives through a hosted domain (e.g. behind a reverse proxy).
function requestWithHost(baseUrl, host, route) {
  const { port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = require('http').request({ host: '127.0.0.1', port, path: route, headers: { Host: host } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const hosted = await startServer({
    WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP: 'true',
    WRENCHPRO_ALLOWED_ORIGINS: 'https://app.wrenchpro.test/, http://not-allowed.test, https://portal.wrenchpro.test:8443',
  }, 'hosted');
  try {
    const trusted = await corsHeader(hosted.baseUrl, 'https://app.wrenchpro.test');
    assert.strictEqual(trusted.status, 200);
    assert.strictEqual(trusted.allowOrigin, 'https://app.wrenchpro.test', 'Configured HTTPS hosted origins should be allowed with trailing slash normalized');
    assert.strictEqual(trusted.noStore, 'no-store', 'API responses must not be browser cached');
    assert.strictEqual(trusted.nosniff, 'nosniff', 'API responses should include nosniff');
    assert.strictEqual(trusted.frameOptions, 'DENY', 'Hosted responses should not be frameable by arbitrary origins');
    assert.strictEqual(trusted.referrerPolicy, 'no-referrer', 'Hosted responses should not leak referrers');
    assert.match(trusted.permissionsPolicy || '', /camera=\(\)/, 'Dangerous browser permissions should be disabled');
    assert.match(trusted.csp || '', /frame-ancestors 'none'/, 'CSP should forbid framing');

    assert.strictEqual((await corsHeader(hosted.baseUrl, 'https://portal.wrenchpro.test:8443')).allowOrigin, 'https://portal.wrenchpro.test:8443', 'Configured HTTPS ports should be allowed');
    assert.strictEqual((await corsHeader(hosted.baseUrl, 'http://not-allowed.test')).allowOrigin, null, 'Configured non-HTTPS origins must be ignored');
    assert.strictEqual((await corsHeader(hosted.baseUrl, 'https://evil.example')).allowOrigin, null, 'Unconfigured HTTPS origins must not receive CORS access');
    assert.strictEqual((await corsHeader(hosted.baseUrl, 'null')).allowOrigin, null, 'Hosted SaaS mode must reject file/null browser origins');
    assert.strictEqual((await corsHeader(hosted.baseUrl, 'http://localhost:5173')).allowOrigin, 'http://localhost:5173', 'Localhost development origins should remain allowed');
    assert.strictEqual((await corsHeader(hosted.baseUrl, 'http://localhost.evil.test')).allowOrigin, null, 'Lookalike localhost origins must not be allowed');

    const trustedPreflight = await corsPreflight(hosted.baseUrl, 'https://app.wrenchpro.test');
    assert.strictEqual(trustedPreflight.status, 204, 'Trusted hosted origins should pass API preflight requests');
    assert.strictEqual(trustedPreflight.allowOrigin, 'https://app.wrenchpro.test');
    assert.match(trustedPreflight.allowHeaders || '', /authorization/i, 'Preflight must allow bearer auth headers for hosted sessions');
    assert.match(trustedPreflight.allowHeaders || '', /x-wrenchpro-shop-id/i, 'Preflight must allow shop context headers for hosted sessions');
    assert.match(trustedPreflight.vary || '', /Origin/i, 'CORS responses must vary by Origin to avoid cache confusion');
    assert.strictEqual((await corsPreflight(hosted.baseUrl, 'https://evil.example')).allowOrigin, null, 'Untrusted hosted preflight requests must not receive CORS access');

    // A correctly configured hosted server accepts its domain and then applies
    // membership rules (no shop context → 400, not data).
    assert.strictEqual((await requestWithHost(hosted.baseUrl, 'app.wrenchpro.test', '/api/health')).status, 200, 'Configured hosted domains should reach the API');
    assert.strictEqual((await requestWithHost(hosted.baseUrl, 'app.wrenchpro.test', '/api/customers')).status, 400, 'Hosted API requests without a shop context must be rejected');
  } finally {
    hosted.child.kill();
  }

  // Fail closed (ADR-0004): a hosted domain configured WITHOUT membership
  // enforcement must refuse hosted traffic instead of serving desktop-mode data.
  const misconfigured = await startServer({
    WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP: 'false',
    WRENCHPRO_ALLOWED_ORIGINS: 'https://app.wrenchpro.test',
  }, 'misconfigured');
  try {
    const refused = await requestWithHost(misconfigured.baseUrl, 'app.wrenchpro.test', '/api/customers');
    assert.strictEqual(refused.status, 503, 'Hosted traffic must be refused when membership enforcement is off');
    assert.ok(!refused.body.includes('"first"'), 'A refused hosted request must not include customer data');
    assert.strictEqual((await requestWithHost(misconfigured.baseUrl, 'app.wrenchpro.test', '/')).status, 503, 'The hosted UI must not be served either');
    assert.strictEqual((await requestWithHost(misconfigured.baseUrl, `127.0.0.1:${new URL(misconfigured.baseUrl).port}`, '/api/customers')).status, 200, 'Local desktop access must keep working');
  } finally {
    misconfigured.child.kill();
  }

  const desktop = await startServer({ WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP: 'false' }, 'desktop');
  try {
    assert.strictEqual((await corsHeader(desktop.baseUrl, 'null')).allowOrigin, 'null', 'Desktop compatibility mode should still support Electron/file null origins');
    assert.strictEqual((await corsHeader(desktop.baseUrl, 'https://evil.example')).allowOrigin, null, 'Desktop mode should not allow arbitrary web origins');
  } finally {
    desktop.child.kill();
  }

  console.log('Hosted security QA passed');
}

main().catch(error => { console.error(error.stack || error.message || String(error)); process.exitCode = 1; });
