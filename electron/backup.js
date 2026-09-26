// Local database backup / restore for the desktop app.
//
// Runs in the Electron main process only: nothing here is reachable over the
// HTTP API, so a web request can never choose where files are written or
// swap the database. Kept free of Electron imports so scripts/backup-qa.js can
// exercise it under plain Node.
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const AUTO_PREFIX = 'WrenchPro-auto-';
const MANUAL_PREFIX = 'WrenchPro-backup-';
const SAFETY_PREFIX = 'WrenchPro-before-restore-';
const BACKUP_PATTERN = /^WrenchPro-(auto|backup|before-restore)-\d{4}-\d{2}-\d{2}_\d{6}\.db$/;
const AUTO_KEEP = 14;
const AUTO_INTERVAL_MS = 20 * 60 * 60 * 1000; // daily, with slack for a laptop opened at different times
const REQUIRED_TABLES = ['settings', 'customers', 'vehicles', 'jobs', 'payments'];

function timestamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function ensureWritableFolder(folder) {
  fs.mkdirSync(folder, { recursive: true });
  const probe = path.join(folder, `.wrenchpro-write-test-${process.pid}`);
  fs.writeFileSync(probe, '');
  fs.rmSync(probe, { force: true });
}

// Open a candidate backup read-only and confirm it is an intact WrenchPro
// database. Returns a small summary for the restore confirmation dialog.
function inspectBackupFile(file) {
  let candidate;
  try {
    candidate = new Database(file, { readonly: true, fileMustExist: true });
    const integrity = candidate.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`The backup file is damaged (${integrity}).`);
    const tables = new Set(candidate.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    const missing = REQUIRED_TABLES.filter(table => !tables.has(table));
    if (missing.length) throw new Error('This file is not a WrenchPro database.');
    const count = table => candidate.prepare(`SELECT COUNT(*) AS n FROM ${table}${hasColumn(candidate, table, 'deleted_at') ? ' WHERE deleted_at IS NULL' : ''}`).get().n;
    const settings = candidate.prepare('SELECT business_name FROM settings ORDER BY id LIMIT 1').get() || {};
    return {
      businessName: settings.business_name || '',
      customers: count('customers'),
      jobs: count('jobs'),
      modifiedAt: fs.statSync(file).mtime.toISOString(),
    };
  } catch (error) {
    if (/file is not a database|file is encrypted/i.test(error.message)) throw new Error('This file is not a WrenchPro database.');
    throw error;
  } finally {
    if (candidate) candidate.close();
  }
}

function hasColumn(database, table, column) {
  return database.prepare(`PRAGMA table_info(${table})`).all().some(col => col.name === column);
}

function createBackupManager({ db, dbPath, dataDir, configPath }) {
  const defaultFolder = path.join(dataDir, 'Backups');
  let lastError = '';

  function readConfig() {
    try { return JSON.parse(fs.readFileSync(configPath, 'utf8')) || {}; } catch { return {}; }
  }
  function writeConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  function folder() {
    return readConfig().folder || defaultFolder;
  }

  function listBackups(dir = folder()) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { return []; }
    return names
      .filter(name => BACKUP_PATTERN.test(name))
      .map(name => {
        const file = path.join(dir, name);
        const stat = fs.statSync(file);
        return { name, file, kind: name.match(BACKUP_PATTERN)[1], size: stat.size, createdAt: stat.mtime.toISOString(), mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  // SQLite's online backup API produces a consistent copy even while the app
  // is writing. The copy is verified before it counts as a backup.
  async function writeBackup(destination) {
    const partial = `${destination}.partial`;
    const cleanup = () => ['', '-wal', '-shm'].forEach(suffix => fs.rmSync(`${partial}${suffix}`, { force: true }));
    cleanup();
    try {
      await db.backup(partial);
      // The copy inherits WAL mode, which makes any reader create -wal/-shm
      // side files next to it. Switch it to a self-contained single file.
      const copy = new Database(partial);
      try { copy.pragma('journal_mode = DELETE'); } finally { copy.close(); }
      inspectBackupFile(partial);
      fs.renameSync(partial, destination);
    } finally {
      cleanup();
    }
    return destination;
  }

  async function backupToFolder(prefix) {
    let dir = folder();
    try {
      ensureWritableFolder(dir);
    } catch (error) {
      // A chosen folder can disappear (USB drive unplugged, cloud folder
      // renamed). Never skip the backup because of that: fall back to the
      // default folder and surface the problem in Settings.
      if (dir === defaultFolder) throw error;
      lastError = `Backup folder ${dir} is not available, so the backup was saved to ${defaultFolder} instead.`;
      dir = defaultFolder;
      ensureWritableFolder(dir);
    }
    const file = await writeBackup(path.join(dir, `${prefix}${timestamp()}.db`));
    if (dir === folder()) lastError = '';
    return file;
  }

  function pruneAutoBackups(dir = folder()) {
    listBackups(dir).filter(backup => backup.kind === 'auto').slice(AUTO_KEEP)
      .forEach(backup => fs.rmSync(backup.file, { force: true }));
  }

  async function backupNow() {
    return backupToFolder(MANUAL_PREFIX);
  }

  async function runAutoBackupIfDue(now = Date.now()) {
    const newest = [...listBackups(), ...listBackups(defaultFolder)]
      .filter(backup => backup.kind !== 'before-restore')
      .reduce((max, backup) => Math.max(max, backup.mtimeMs), 0);
    if (now - newest < AUTO_INTERVAL_MS) return null;
    try {
      const file = await backupToFolder(AUTO_PREFIX);
      pruneAutoBackups(path.dirname(file));
      return file;
    } catch (error) {
      lastError = `Automatic backup failed: ${error.message}`;
      throw error;
    }
  }

  async function saveCopyTo(destination) {
    return writeBackup(destination);
  }

  function setFolder(dir) {
    ensureWritableFolder(dir);
    const config = readConfig();
    if (path.resolve(dir) === path.resolve(defaultFolder)) delete config.folder;
    else config.folder = dir;
    writeConfig(config);
    lastError = '';
    return folder();
  }

  function status() {
    const backups = [...listBackups(), ...(folder() === defaultFolder ? [] : listBackups(defaultFolder))]
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    const latest = backups[0] || null;
    return {
      folder: folder(),
      defaultFolder,
      usingDefaultFolder: folder() === defaultFolder,
      lastBackupAt: latest ? latest.createdAt : null,
      lastBackupFile: latest ? latest.file : null,
      backupCount: backups.length,
      lastError,
    };
  }

  // Swap the live database for a verified backup. The current data is saved
  // first as a safety copy. The caller must restart the app afterwards
  // because the shared database connection is closed here.
  async function restoreFrom(file) {
    if (path.resolve(file) === path.resolve(dbPath)) throw new Error('Choose a backup file, not the live database.');
    inspectBackupFile(file);
    const safetyCopy = await backupToFolder(SAFETY_PREFIX);
    const staged = `${dbPath}.restoring`;
    fs.copyFileSync(file, staged);
    db.close();
    for (const suffix of ['-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
    fs.renameSync(staged, dbPath);
    return { safetyCopy };
  }

  return { status, listBackups, backupNow, runAutoBackupIfDue, saveCopyTo, setFolder, restoreFrom, inspectBackupFile, defaultFolder, folder };
}

module.exports = { createBackupManager, inspectBackupFile, timestamp, AUTO_KEEP, AUTO_INTERVAL_MS };
