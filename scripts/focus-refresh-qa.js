const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const apiStart = html.indexOf('async function api(');
const apiEnd = html.indexOf('\nfunction setVersionLabels(', apiStart);
const loadStart = html.indexOf('async function loadAll(');
const loadEnd = html.indexOf('\nfunction updateSidebarFoot(', loadStart);
assert.ok(apiStart >= 0 && apiEnd > apiStart && loadStart >= 0 && loadEnd > loadStart);

const state = {
  customers: [{ id: 99 }], vehicles: [{ id: 99 }], jobs: [{ id: 99 }], payments: [{ id: 99 }], plans: [{ id: 99 }],
  expenses: [{ id: 99 }], settings: { existing: true }, appts: [{ id: 99 }], employees: [{ id: 99 }], interactions: [{ id: 99 }],
  followups: [{ id: 99 }], serviceReminders: [{ id: 99 }], estimates: [{ id: 99 }], inventory: [{ id: 99 }], catalog: [{ id: 99 }],
  inspections: [{ id: 99 }], warranties: [{ id: 99 }], timeLogs: [{ id: 99 }], leads: [{ id: 99 }],
};
const warnings = [];
const errors = [];
let fetchImpl;
const context = {
  state,
  fetch: (...args) => fetchImpl(...args),
  toast: (message, duration) => warnings.push({ message, duration }),
  shopContextHeaders: () => ({}),
  console: { error: (...args) => errors.push(args) },
  window: { addEventListener: () => {} },
  clearTimeout,
  setTimeout,
  updateSidebarFoot: () => {},
  renderPage: () => {},
};
vm.runInNewContext(`const API='';let currentPage='dashboard';${html.slice(apiStart, apiEnd)}${html.slice(loadStart, loadEnd)};globalThis.qa={refreshOnFocus,loadAll};`, context);

const ok = value => ({ ok: true, json: async () => value });
const failed = message => ({ ok: false, json: async () => ({ error: message }) });

async function main() {
  fetchImpl = async url => ok(url === '/api/settings' ? { refreshed: true } : [{ path: url }]);
  await context.qa.refreshOnFocus();
  assert.strictEqual(state.customers[0].path, '/api/customers');
  assert.strictEqual(state.settings.refreshed, true);
  assert.strictEqual(warnings.length, 0);

  const snapshot = JSON.stringify(state);
  fetchImpl = async url => url === '/api/jobs' ? failed('jobs unavailable') : ok(url === '/api/settings' ? {} : []);
  await context.qa.refreshOnFocus();
  assert.strictEqual(JSON.stringify(state), snapshot, 'one failed endpoint must preserve all visible state');
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(warnings[0].duration, 8000);
  assert.match(warnings[0].message, /existing information is still available/i);
  assert.strictEqual(errors.length, 1, 'one refresh attempt must log one concise error');

  warnings.length = 0;
  errors.length = 0;
  fetchImpl = async url => ['/api/jobs', '/api/payments', '/api/leads'].includes(url) ? failed('unavailable') : ok(url === '/api/settings' ? {} : []);
  await context.qa.refreshOnFocus();
  assert.strictEqual(JSON.stringify(state), snapshot, 'several failures must preserve all visible state');
  assert.strictEqual(warnings.length, 1, 'several endpoint failures must produce one warning');
  assert.strictEqual(errors.length, 1);

  let requests = 0;
  let releases = [];
  fetchImpl = url => { requests += 1; return new Promise(resolve => releases.push(() => resolve(ok(url === '/api/settings' ? {} : [])))); };
  const first = context.qa.refreshOnFocus();
  const overlap = context.qa.refreshOnFocus();
  await overlap;
  assert.strictEqual(requests, 19, 'overlapping focus refresh must not start another request batch');
  releases.forEach(release => release());
  await first;

  fetchImpl = async url => ok(url === '/api/settings' ? { later: true } : [{ later: url }]);
  await context.qa.refreshOnFocus();
  assert.strictEqual(state.settings.later, true, 'a later successful refresh must run normally');
  assert.strictEqual(state.customers[0].later, '/api/customers');

  const existingJobs = JSON.stringify(state.jobs);
  fetchImpl = async url => url === '/api/jobs' ? failed('jobs unavailable') : ok(url === '/api/settings' ? { partial: true } : [{ partial: url }]);
  const failures = await context.qa.loadAll({ silentErrors: true, allowPartial: true });
  assert.strictEqual(failures.length, 1, 'partial startup must report one failed resource');
  assert.strictEqual(failures[0].resource, 'jobs');
  assert.strictEqual(JSON.stringify(state.jobs), existingJobs, 'partial startup must preserve the failed resource state');
  assert.strictEqual(state.customers[0].partial, '/api/customers', 'partial startup must apply successful resources');
  assert.strictEqual(state.settings.partial, true);
  console.log('Focus refresh reliability QA passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
