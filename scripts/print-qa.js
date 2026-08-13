const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron', 'preload.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

assert.match(main, /ipcMain\.handle\('document:print'/, 'native print IPC handler is missing');
assert.match(main, /ipcMain\.handle\('document:save-pdf'/, 'native PDF IPC handler is missing');
assert.match(main, /event\.sender !== mainWindow\.webContents/, 'print IPC must reject untrusted renderers');
assert.match(main, /nodeIntegration:\s*false[\s\S]*sandbox:\s*true[\s\S]*javascript:\s*false/, 'print window must not execute renderer content');
assert.match(main, /webContents\.print\(\{ silent: false, printBackground: true \}/, 'native print dialog is not configured');
assert.match(main, /dialog\.showSaveDialog/, 'PDF save location dialog is missing');
assert.match(main, /webContents\.printToPDF/, 'native PDF generation is missing');
assert.match(main, /fs\.promises\.writeFile/, 'generated PDF is not written to the selected path');

assert.match(preload, /printDocument\(payload\)[\s\S]*ipcRenderer\.invoke\('document:print'/, 'preload print bridge is missing');
assert.match(preload, /savePdf\(payload\)[\s\S]*ipcRenderer\.invoke\('document:save-pdf'/, 'preload PDF bridge is missing');
assert.match(html, /onclick="saveInvoicePdf\(\)"/, 'invoice Save PDF button is missing');
assert.match(html, /window\.electronAPI\?\.printDocument/, 'invoice printing does not use the native bridge');
assert.match(html, /window\.electronAPI\?\.savePdf/, 'invoice PDF saving does not use the native bridge');
assert.match(html, /function printEstimate\(\)[\s\S]*openEstimateInvoice\(editEstId\)[\s\S]*printInvoice\(\)/, 'estimate printing does not render the selected estimate first');
assert.match(html, /function saveEstimatePdf\(\)[\s\S]*openEstimateInvoice\(editEstId\)[\s\S]*saveInvoicePdf\(\)/, 'estimate PDF saving does not render the selected estimate first');

console.log('Native print and PDF QA passed');
