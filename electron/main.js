const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const path = require('path');
const http = require('http');
const net  = require('net');

let mainWindow = null;
let appPort    = 3000;
let _autoUpdater = null;
let _manualCheck = false;

// ── Helpers ─────────────────────────────────────────────────────────────────
function findFreePort(start = 3000) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', () => resolve(findFreePort(start + 1)));
    srv.listen(start, () => srv.close(() => resolve(start)));
  });
}

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
  const template = [
    {
      label: 'WrenchPro',
      submenu: [
        {
          label: 'About WrenchPro',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About WrenchPro',
              message: 'WrenchPro',
              detail: `Version ${app.getVersion()}\nMobile Mechanic Manager`,
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
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
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => checkForUpdatesManual(),
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
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: err.message,
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
