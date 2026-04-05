const { contextBridge } = require('electron');

// Expose a minimal, safe API to the renderer (index.html).
// Nothing sensitive — just read-only metadata.
contextBridge.exposeInMainWorld('electronAPI', {
  version:  require('../package.json').version,
  platform: process.platform,
});
