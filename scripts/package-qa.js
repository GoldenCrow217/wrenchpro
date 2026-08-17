const assert = require('assert');
const path = require('path');
const asar = require('@electron/asar');

const archive = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'app.asar');
const files = asar.listPackage(archive).map(file=>file.replaceAll('\\','/'));
for (const expected of ['/server/routes/operations.js', '/public/index.html', '/server/database.js']) {
  assert.ok(files.includes(expected), `Packaged ASAR is missing ${expected}`);
}
const operations = asar.extractFile(archive, 'server\\routes\\operations.js').toString('utf8');
const html = asar.extractFile(archive, 'public\\index.html').toString('utf8');
assert.match(operations, /router\.post\('\/service-events'/, 'Packaged operations API is incomplete');
assert.match(html, /function renderWorkflowBoard\(\)/, 'Packaged workflow renderer is missing');
assert.match(html, /function openInspectionReport\(/, 'Packaged inspection reports are missing');
assert.match(html, /function openCustomerStatement\(/, 'Packaged customer statements are missing');
console.log('Packaged ASAR QA passed: connected operations and printable reports are present');
