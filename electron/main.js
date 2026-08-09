const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { findFreePort } = require('./find-free-port');

let mainWindow = null;
let appPort    = 3000;
let _autoUpdater = null;
let _manualCheck = false;

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
      http.get(`http://localhost:${port}`, () => resolve())
        .on('error', () => {
          if (n <= 0) return reject(new Error('Express server did not start in time.'));
          setTimeout(() => try_(n - 1), 300);
        });
    };
    try_(attempts);
  });
}

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
        { label: 'Backup Database', enabled: false },
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${port}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  buildMenu();
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    process.env.WRENCHPRO_DATA = app.getPath('userData');

    appPort = await findFreePort(3000);
    process.env.PORT = String(appPort);

    require('../server/index');
    await waitForServer(appPort);

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
