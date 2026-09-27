const assert = require('assert');
const path = require('path');
const asar = require('@electron/asar');

const archive = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'app.asar');
const files = asar.listPackage(archive).map(file=>file.replaceAll('\\','/'));
for (const expected of [
  '/server/routes/operations.js', '/public/index.html', '/server/database.js',
  // Brand assets must ship inside the app so the UI renders offline.
  '/public/favicon.svg', '/electron/assets/icon.ico',
  '/public/fonts/inter-tight-latin-wght-normal.woff2', '/public/fonts/jetbrains-mono-latin-wght-normal.woff2',
  '/public/fonts/OFL-InterTight.txt', '/public/fonts/OFL-JetBrainsMono.txt',
]) {
  assert.ok(files.includes(expected), `Packaged ASAR is missing ${expected}`);
}
const operations = asar.extractFile(archive, 'server\\routes\\operations.js').toString('utf8');
const html = asar.extractFile(archive, 'public\\index.html').toString('utf8');
assert.match(operations, /router\.post\('\/service-events'/, 'Packaged operations API is incomplete');
assert.match(html, /function renderWorkflowBoard\(\)/, 'Packaged workflow renderer is missing');
assert.match(html, /function openInspectionReport\(/, 'Packaged inspection reports are missing');
assert.match(html, /function openCustomerStatement\(/, 'Packaged customer statements are missing');
// The Windows build strips other platforms' SQLite binaries; make sure the one
// the app loads at startup is still unpacked next to the ASAR.
const fs = require('fs');
const unpacked = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3');
assert.ok(fs.existsSync(path.join(unpacked, 'prebuilds', 'win32-x64.node')), 'Packaged app is missing the win32-x64 SQLite binary');
assert.ok(fs.existsSync(path.join(unpacked, 'lib', 'binding.js')), 'Packaged app is missing better-sqlite3 runtime code');
console.log('Packaged ASAR QA passed: connected operations and printable reports are present');
