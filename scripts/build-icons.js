// Regenerates electron/assets/icon.png + icon.ico and public/favicon.svg from
// electron/assets/icon.svg. Run with: npm run build:icons
// Uses an offscreen Electron window so no image tooling is needed.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const assets = path.join(__dirname, '..', 'electron', 'assets');
const svg = fs.readFileSync(path.join(assets, 'icon.svg'), 'utf8');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function render(win, size) {
  const sized = svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  const html = `<html><body style="margin:0;background:transparent">${sized}</body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
}

// ICO container holding PNG-compressed entries (supported since Windows Vista).
function buildIco(entries) {
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...entries.map(entry => entry.png)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, width: 512, height: 512, transparent: true, frame: false, useContentSize: true,
    webPreferences: { offscreen: true, sandbox: true, javascript: false, zoomFactor: 1 },
  });
  // Render once at 512px; offscreen captures after a reload come back blank,
  // so every ICO size is downscaled from this master frame.
  const master = await render(win, 512);
  if (master.isEmpty()) throw new Error('Rendered an empty icon');
  fs.writeFileSync(path.join(assets, 'icon.png'), master.toPNG());
  const entries = ICO_SIZES.map(size => ({ size, png: master.resize({ width: size, height: size, quality: 'best' }).toPNG() }));
  fs.writeFileSync(path.join(assets, 'icon.ico'), buildIco(entries));
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), svg);
  console.log('Icons written:', ['electron/assets/icon.png', 'electron/assets/icon.ico', 'public/favicon.svg'].join(', '));
  app.quit();
}).catch(err => {
  console.error(err);
  app.exit(1);
});
