const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.on('app:get-version', event => {
  event.returnValue = app.getVersion();
});

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  try {
    await window.loadURL('data:text/html,<p>WrenchPro print preload QA</p>');
    const bridge = await window.webContents.executeJavaScript(`({
      version: window.electronAPI?.version,
      platform: window.electronAPI?.platform,
      printDocument: typeof window.electronAPI?.printDocument,
      savePdf: typeof window.electronAPI?.savePdf
    })`);
    if (!bridge.version || !bridge.platform || bridge.printDocument !== 'function' || bridge.savePdf !== 'function') {
      throw new Error(`Secure preload bridge was not exposed: ${JSON.stringify(bridge)}`);
    }
    console.log(`Sandboxed print preload QA passed: ${JSON.stringify(bridge)}`);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
