const { spawnSync } = require('child_process');
const electron = require('electron');
const path = require('path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [path.join(__dirname, 'render-security.js')], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});
process.exit(result.status === null ? 1 : result.status);
