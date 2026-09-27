const { contextBridge, ipcRenderer } = require('electron');

const MENU_COMMANDS = new Set([
  'navigate:dashboard',
  'navigate:customers',
  'navigate:vehicles',
  'navigate:jobs',
  'navigate:schedule',
  'navigate:inventory',
  'action:new-customer',
  'action:new-job',
  'action:new-appointment',
  'action:quick-entry',
  'action:new-lead',
  'action:new-payment',
  'action:open-settings',
]);

// Expose a minimal, safe API to the renderer (index.html).
// Nothing sensitive — just read-only metadata.
contextBridge.exposeInMainWorld('electronAPI', {
  version:  ipcRenderer.sendSync('app:get-version'),
  platform: process.platform,
  printDocument(payload) {
    if (!payload || typeof payload.html !== 'string') return Promise.reject(new Error('Invalid print request'));
    return ipcRenderer.invoke('document:print', { html: payload.html, title: payload.title, filename: payload.filename });
  },
  savePdf(payload) {
    if (!payload || typeof payload.html !== 'string') return Promise.reject(new Error('Invalid PDF request'));
    return ipcRenderer.invoke('document:save-pdf', { html: payload.html, title: payload.title, filename: payload.filename });
  },
  // Backup actions take no arguments: every file/folder choice is made in a
  // native dialog owned by the main process.
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    backupNow: () => ipcRenderer.invoke('backup:now'),
    saveAs: () => ipcRenderer.invoke('backup:save-as'),
    chooseFolder: () => ipcRenderer.invoke('backup:choose-folder'),
    useDefaultFolder: () => ipcRenderer.invoke('backup:use-default-folder'),
    openFolder: () => ipcRenderer.invoke('backup:open-folder'),
    restore: () => ipcRenderer.invoke('backup:restore'),
  },
  onMenuCommand(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, command) => {
      if (!MENU_COMMANDS.has(command)) {
        console.warn('Ignored unknown menu command:', command);
        return;
      }
      callback(command);
    };
    ipcRenderer.on('menu-command', listener);
    return () => ipcRenderer.removeListener('menu-command', listener);
  },
});
