const { app, BrowserWindow, dialog, shell, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { findFreePort } = require('./find-free-port');
const { createBackupManager } = require('./backup');

let mainWindow = null;
let appPort    = 3000;
let _autoUpdater = null;
let _manualCheck = false;
let backups = null;
let autoBackupTimer = null;

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

// ── Helpers ─────────────────────────────────────────────────────────────────
function waitForServer(port, attempts = 30) {
  return new Promise((resolve, reject) => {
    const try_ = (n) => {
      http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
        response.resume();
        resolve();
      })
        .on('error', () => {
          if (n <= 0) return reject(new Error('Express server did not start in time.'));
          setTimeout(() => try_(n - 1), 300);
        });
    };
    try_(attempts);
  });
}

function validatePrintPayload(event, payload) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Print request was not sent by the WrenchPro window');
  }
  if (!payload || typeof payload.html !== 'string' || !payload.html.trim() || payload.html.length > 5_000_000) {
    throw new Error('Printable document is missing or too large');
  }
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim().slice(0, 120) : 'WrenchPro Document';
  const requestedName = typeof payload.filename === 'string' ? payload.filename : `${title}.pdf`;
  const safeName = requestedName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 160);
  return { html: payload.html, title, filename: safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf` };
}

async function createPrintableWindow(document) {
  const printWindow = new BrowserWindow({
    show: false,
    parent: mainWindow,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false,
    },
  });
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(document.html)}`);
  return printWindow;
}

ipcMain.on('app:get-version', (event) => {
  event.returnValue = app.getVersion();
});

ipcMain.handle('document:print', async (event, payload) => {
  const document = validatePrintPayload(event, payload);
  const printWindow = await createPrintableWindow(document);
  try {
    return await new Promise((resolve) => {
      printWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        resolve({ success, canceled: !success && /cancel/i.test(failureReason || ''), error: success ? '' : (failureReason || 'Printing was canceled or unavailable') });
      });
    });
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
});

ipcMain.handle('document:save-pdf', async (event, payload) => {
  const document = validatePrintPayload(event, payload);
  const selection = await dialog.showSaveDialog(mainWindow, {
    title: `Save ${document.title} as PDF`,
    defaultPath: path.join(app.getPath('documents'), document.filename),
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (selection.canceled || !selection.filePath) return { success: false, canceled: true };
  const printWindow = await createPrintableWindow(document);
  try {
    const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'Letter', preferCSSPageSize: true });
    await fs.promises.writeFile(selection.filePath, pdf);
    return { success: true, filePath: selection.filePath };
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
});

// ── Backups ──────────────────────────────────────────────────────────────────
// All file-system choices happen here through native dialogs; the renderer can
// only ask for an action, never pass a path.
let backupQueue = Promise.resolve();
function serializedBackup(task) {
  const run = backupQueue.then(task, task);
  backupQueue = run.catch(() => {});
  return run;
}

function requireMainWindowSender(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Backup request was not sent by the WrenchPro window');
  }
}

async function runAutoBackup() {
  if (!backups) return;
  try {
    const file = await serializedBackup(() => backups.runAutoBackupIfDue());
    if (file) console.log('Automatic backup saved:', file);
  } catch (err) {
    console.error('Automatic backup failed:', err.message);
  }
}

function startAutoBackups() {
  setTimeout(runAutoBackup, 60 * 1000);
  autoBackupTimer = setInterval(runAutoBackup, 60 * 60 * 1000);
}

function backupNow() {
  return serializedBackup(async () => ({ success: true, filePath: await backups.backupNow(), status: backups.status() }));
}

async function saveBackupAs() {
  const selection = await dialog.showSaveDialog(mainWindow, {
    title: 'Save a copy of your WrenchPro data',
    defaultPath: path.join(app.getPath('documents'), `WrenchPro-backup-${new Date().toISOString().slice(0, 10)}.db`),
    filters: [{ name: 'WrenchPro backup', extensions: ['db'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (selection.canceled || !selection.filePath) return { success: false, canceled: true };
  const filePath = await serializedBackup(() => backups.saveCopyTo(selection.filePath));
  return { success: true, filePath, status: backups.status() };
}

async function chooseBackupFolder() {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose where automatic backups are saved',
    defaultPath: backups.folder(),
    buttonLabel: 'Use this folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (selection.canceled || !selection.filePaths?.[0]) return { success: false, canceled: true };
  backups.setFolder(selection.filePaths[0]);
  // Back up straight away so the user knows the new location works.
  return backupNow();
}

async function useDefaultBackupFolder() {
  backups.setFolder(backups.defaultFolder);
  return { success: true, status: backups.status() };
}

async function openBackupFolder() {
  fs.mkdirSync(backups.folder(), { recursive: true });
  const error = await shell.openPath(backups.folder());
  return error ? { success: false, error } : { success: true };
}

async function restoreFromBackup() {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore WrenchPro data from a backup',
    defaultPath: backups.folder(),
    filters: [{ name: 'WrenchPro backup', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (selection.canceled || !selection.filePaths?.[0]) return { success: false, canceled: true };
  const file = selection.filePaths[0];
  let summary;
  try {
    summary = backups.inspectBackupFile(file);
  } catch (err) {
    await dialog.showMessageBox(mainWindow, { type: 'error', title: 'Cannot restore this file', message: 'This backup cannot be restored.', detail: err.message, buttons: ['OK'] });
    return { success: false, error: err.message };
  }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Restore from backup',
    message: 'Replace your current WrenchPro data with this backup?',
    detail: [
      `Backup: ${path.basename(file)}`,
      `Saved: ${new Date(summary.modifiedAt).toLocaleString()}`,
      ...(summary.businessName ? [`Business: ${summary.businessName}`] : []),
      `Contains ${summary.customers} customer(s) and ${summary.jobs} job(s).`,
      '',
      'Your current data will be saved as a safety backup first. WrenchPro will restart when the restore finishes.',
    ].join('\n'),
    buttons: ['Restore and restart', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return { success: false, canceled: true };
  await serializedBackup(() => backups.restoreFrom(file));
  clearInterval(autoBackupTimer);
  app.relaunch();
  app.exit(0);
  return { success: true };
}

async function menuBackupAction(action, successMessage) {
  if (!backups) return;
  try {
    const result = await action();
    if (result?.success && successMessage) {
      await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Backup saved', message: successMessage, detail: result.filePath || '', buttons: ['OK'] });
    } else if (result && !result.success && result.error) {
      dialog.showErrorBox('WrenchPro backup', result.error);
    }
  } catch (err) {
    dialog.showErrorBox('WrenchPro backup', err.message);
  }
}

const BACKUP_ACTIONS = {
  'backup:now': backupNow,
  'backup:save-as': saveBackupAs,
  'backup:choose-folder': chooseBackupFolder,
  'backup:use-default-folder': useDefaultBackupFolder,
  'backup:open-folder': openBackupFolder,
  'backup:restore': restoreFromBackup,
};
ipcMain.handle('backup:status', (event) => {
  requireMainWindowSender(event);
  return backups ? backups.status() : null;
});
Object.entries(BACKUP_ACTIONS).forEach(([channel, action]) => {
  ipcMain.handle(channel, async (event) => {
    requireMainWindowSender(event);
    if (!backups) return { success: false, error: 'Backups are not ready yet' };
    try {
      return await action();
    } catch (err) {
      return { success: false, error: err.message, status: backups.status() };
    }
  });
});

// ── Menu ─────────────────────────────────────────────────────────────────────
function buildMenu() {
  const sendMenuCommand = (command) => {
    if (!MENU_COMMANDS.has(command)) {
      console.warn('Ignored unknown menu command:', command);
      return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('menu-command', command);
  };
  const commandItem = (label, command, accelerator) => ({
    label,
    accelerator,
    click: () => sendMenuCommand(command),
  });
  const template = [
    {
      label: 'File',
      submenu: [
        commandItem('New Customer', 'action:new-customer', 'CmdOrCtrl+Shift+C'),
        commandItem('New Job', 'action:new-job', 'CmdOrCtrl+N'),
        commandItem('New Appointment', 'action:new-appointment', 'CmdOrCtrl+Shift+A'),
        { type: 'separator' },
        { label: 'Back Up Now', click: () => menuBackupAction(backupNow, 'Your WrenchPro data was backed up.') },
        { label: 'Save Backup As...', click: () => menuBackupAction(saveBackupAs, 'A copy of your WrenchPro data was saved.') },
        { label: 'Restore from Backup...', click: () => menuBackupAction(restoreFromBackup) },
        { label: 'Open Backups Folder', click: () => menuBackupAction(openBackupFolder) },
        { label: 'Export Data', enabled: false },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo',  accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo',  accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut',   accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy',  accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        commandItem('Dashboard', 'navigate:dashboard'),
        commandItem('Customers', 'navigate:customers'),
        commandItem('Vehicles', 'navigate:vehicles'),
        commandItem('Jobs', 'navigate:jobs'),
        commandItem('Schedule', 'navigate:schedule'),
        commandItem('Parts & Inventory', 'navigate:inventory'),
        { type: 'separator' },
        { label: 'Reload', role: 'reload' },
        { label: 'Force Reload', role: 'forceReload' },
        { label: 'Toggle Developer Tools', role: 'toggleDevTools', enabled: !app.isPackaged },
        { type: 'separator' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { label: 'Reset Zoom', role: 'resetZoom' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Actions',
      submenu: [
        commandItem('Quick Entry', 'action:quick-entry'),
        commandItem('New Lead', 'action:new-lead'),
        commandItem('New Payment', 'action:new-payment'),
        commandItem('Open Settings', 'action:open-settings', 'CmdOrCtrl+,'),
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Run Data Integrity Check', enabled: false },
        { label: 'Open Logs', enabled: false },
        {
          label: 'Open Data Folder',
          click: async () => {
            const error = await shell.openPath(app.getPath('userData'));
            if (error) console.error('Unable to open data folder:', error);
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            shell.openExternal(
              `https://github.com/GoldenCrow217/wrenchpro/blob/v${app.getVersion()}/INSTALL_AND_BACKUP_GUIDE.md`,
            ).catch((err) => console.error('Unable to open user guide:', err.message));
          },
        },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdatesManual(),
        },
        {
          label: 'About WrenchPro',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About WrenchPro',
              message: 'WrenchPro',
              detail: `Version ${app.getVersion()}\nElectron ${process.versions.electron}\nPlatform ${process.platform} (${process.arch})`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow(port) {
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   820,
    minWidth:  960,
    minHeight: 640,
    title: 'WrenchPro',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  const appOrigin = `http://127.0.0.1:${port}`;
  mainWindow.loadURL(appOrigin);

  // Keep the app window pinned to the local server. External links go through
  // setWindowOpenHandler below and open in the user's browser instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    if (origin !== appOrigin) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === 'https:' || protocol === 'mailto:') shell.openExternal(url);
      else console.warn('Blocked unsupported external URL protocol:', protocol);
    } catch {
      console.warn('Blocked invalid external URL');
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  buildMenu();
}

// ── App lifecycle ────────────────────────────────────────────────────────────
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      process.env.WRENCHPRO_DATA = app.getPath('userData');

      appPort = await findFreePort(3000);
      process.env.PORT = String(appPort);

      require('../server/index');
      await waitForServer(appPort);

      const userData = app.getPath('userData');
      backups = createBackupManager({
        db: require('../server/database'),
        dbPath: path.join(userData, 'wrenchpro.db'),
        dataDir: userData,
        configPath: path.join(userData, 'backup-settings.json'),
      });
      startAutoBackups();

      createWindow(appPort);

      // Silent background check 8 s after launch
      if (app.isPackaged) {
        setTimeout(() => {
          initAutoUpdater();
          _autoUpdater.checkForUpdates().catch(() => {});
        }, 8000);
      }
    } catch (err) {
      dialog.showErrorBox('WrenchPro — Startup Error', err.message);
      app.quit();
    }
  });

  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => { if (mainWindow === null) createWindow(appPort); });
}

// ── Auto-updater ─────────────────────────────────────────────────────────────
function initAutoUpdater() {
  if (_autoUpdater) return;
  const { autoUpdater } = require('electron-updater');
  _autoUpdater = autoUpdater;
  _autoUpdater.autoDownload = true;
  _autoUpdater.autoInstallOnAppQuit = true;

  _autoUpdater.on('update-not-available', () => {
    if (!_manualCheck || !mainWindow) return;
    _manualCheck = false;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Up to Date',
      message: 'WrenchPro is up to date.',
      detail: `You are running version ${app.getVersion()}.`,
      buttons: ['OK'],
    });
  });

  _autoUpdater.on('update-available', (info) => {
    _manualCheck = false;
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `WrenchPro ${info.version} is available`,
      detail: 'Downloading in the background. You will be notified when it is ready.',
      buttons: ['OK'],
    });
  });

  _autoUpdater.on('update-downloaded', (info) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `WrenchPro ${info.version} is ready to install`,
      detail: 'Restart now to apply the update, or it will install automatically when you close the app.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) _autoUpdater.quitAndInstall(false, true);
    });
  });

  _autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
    if (_manualCheck && mainWindow) {
      _manualCheck = false;
      const missingManifest = /latest\.yml|404|cannot find/i.test(String(err.message || ''));
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: missingManifest
          ? 'Update information is not available yet.'
          : 'WrenchPro could not reach the update service.',
        detail: missingManifest
          ? 'This release is missing its update metadata. You can continue using WrenchPro normally and try again later.'
          : 'Check your internet connection and try again later.',
        buttons: ['OK'],
      });
    }
  });
}

function checkForUpdatesManual() {
  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Check for Updates',
      message: 'Updates are only available in the installed version.',
      buttons: ['OK'],
    });
    return;
  }
  _manualCheck = true;
  initAutoUpdater();
  _autoUpdater.checkForUpdates().catch(() => {});
}
