// Runs every QA script in package.json (smoke, qa:*, test:*) one after another
// and prints a pass/fail summary. Used by `npm run test:all` and CI.
// qa:package is skipped because it inspects a built installer in dist/.
const { spawnSync } = require('child_process');
const pkg = require('../package.json');

const SKIP = new Set(['qa:package', 'test:all']);
const scripts = Object.keys(pkg.scripts).filter(name => (name === 'smoke' || /^(qa|test):/.test(name)) && !SKIP.has(name));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const results = [];
for (const name of scripts) {
  const started = Date.now();
  console.log(`\n▶ ${name}`);
  const result = spawnSync(npm, ['run', '-s', name], { stdio: 'inherit', shell: process.platform === 'win32' });
  results.push({ name, ok: result.status === 0, seconds: ((Date.now() - started) / 1000).toFixed(1) });
}

console.log('\nQA summary');
results.forEach(({ name, ok, seconds }) => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (${seconds}s)`));
const failed = results.filter(result => !result.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} QA scripts failed.` : `\nAll ${results.length} QA scripts passed.`);
process.exit(failed.length ? 1 : 0);
