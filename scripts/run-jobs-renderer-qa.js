const { spawnSync } = require('child_process');
const electron = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-jobs-renderer-'));
const result = spawnSync(electron, ['--disable-gpu','--disable-software-rasterizer',`--user-data-dir=${userData}`, path.join(__dirname, 'jobs-renderer-qa.js')], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});
fs.rmSync(userData, { recursive: true, force: true });
process.exit(result.status === null ? 1 : result.status);
