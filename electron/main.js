const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const net  = require('net');

let mainWindow = null;
let appPort    = 3000;

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
    show: false, // shown via ready-to-show to avoid white flash
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open any <a target="_blank"> links in the OS browser, not a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    // Set data dir now that app is ready
    process.env.WRENCHPRO_DATA = app.getPath('userData');

    appPort = await findFreePort(3000);
    process.env.PORT = String(appPort);

    require('../server/index'); // starts Express
    await waitForServer(appPort);

    createWindow(appPort);

    // Check for updates 8 s after launch so it never delays startup
    if (app.isPackaged) {
      setTimeout(() => {
        const { autoUpdater } = require('electron-updater');
        setupAutoUpdater(autoUpdater);
        autoUpdater.checkForUpdates().catch(() => {});
      }, 8000);
    }
  } catch (err) {
    dialog.showErrorBox('WrenchPro — Startup Error', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (mainWindow === null) createWindow(appPort);
});

// ── Auto-updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater(autoUpdater) {
  autoUpdater.autoDownload      = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `WrenchPro ${info.version} is available`,
      detail: 'Downloading update in the background. You will be notified when it is ready.',
      buttons: ['OK'],
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `WrenchPro ${info.version} is ready to install`,
      detail: 'Restart WrenchPro now to apply the update, or it will be installed automatically the next time you close the app.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
  });
}
