// Exercises electron/backup.js against a real, fully migrated WrenchPro
// database in a temp directory: backup, verification, auto-backup schedule and
// pruning, folder fallback, file validation, and restore with safety copy.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-backup-qa-'));
process.env.WRENCHPRO_DATA = dataDir;
const db = require('../server/database');
const { createBackupManager, AUTO_KEEP, AUTO_INTERVAL_MS } = require('../electron/backup');

const dbPath = path.join(dataDir, 'wrenchpro.db');
const manager = createBackupManager({ db, dbPath, dataDir, configPath: path.join(dataDir, 'backup-settings.json') });
const addCustomer = first => db.prepare('INSERT INTO customers (first, last) VALUES (?, ?)').run(first, 'QA');
const customerCount = file => {
  const conn = new Database(file, { readonly: true });
  try { return conn.prepare('SELECT COUNT(*) AS n FROM customers WHERE deleted_at IS NULL').get().n; } finally { conn.close(); }
};

(async () => {
  addCustomer('Before');

  // Manual backup lands in the default folder, is verified, and leaves no temp files.
  const first = await manager.backupNow();
  assert.strictEqual(path.dirname(first), manager.defaultFolder);
  assert.strictEqual(customerCount(first), 1);
  assert.deepStrictEqual(fs.readdirSync(manager.defaultFolder).filter(name => !name.endsWith('.db')), [], 'no partial/wal/shm leftovers');
  const summary = manager.inspectBackupFile(first);
  assert.strictEqual(summary.customers, 1);
  const status = manager.status();
  assert.strictEqual(status.backupCount, 1);
  assert.ok(status.lastBackupAt && status.usingDefaultFolder && !status.lastError);

  // Auto backup is skipped while a recent backup exists, runs once due, and prunes old autos.
  assert.strictEqual(await manager.runAutoBackupIfDue(), null);
  for (let i = 0; i < AUTO_KEEP + 3; i += 1) {
    const stale = path.join(manager.defaultFolder, `WrenchPro-auto-2020-01-${String(i + 1).padStart(2, '0')}_000000.db`);
    fs.copyFileSync(first, stale);
    const when = new Date(2020, 0, i + 1);
    fs.utimesSync(stale, when, when);
  }
  const auto = await manager.runAutoBackupIfDue(Date.now() + AUTO_INTERVAL_MS + 1000);
  assert.ok(auto && path.basename(auto).startsWith('WrenchPro-auto-'));
  const autos = manager.listBackups().filter(backup => backup.kind === 'auto');
  assert.strictEqual(autos.length, AUTO_KEEP, 'old automatic backups are pruned');
  assert.strictEqual(autos[0].file, auto, 'newest automatic backup is kept');
  assert.ok(manager.listBackups().some(backup => backup.file === first), 'manual backups are never pruned');

  // A chosen folder that disappears falls back to the default folder with a visible warning.
  const external = path.join(dataDir, 'usb-drive');
  assert.strictEqual(manager.setFolder(external), external);
  const onExternal = await manager.backupNow();
  assert.strictEqual(path.dirname(onExternal), external);
  fs.rmSync(external, { recursive: true, force: true });
  fs.writeFileSync(external, 'not a folder any more');
  const fallback = await manager.backupNow();
  assert.strictEqual(path.dirname(fallback), manager.defaultFolder);
  assert.match(manager.status().lastError, /not available/);
  fs.rmSync(external, { force: true });
  manager.setFolder(manager.defaultFolder);
  assert.ok(manager.status().usingDefaultFolder && !manager.status().lastError);

  // Validation rejects junk files and non-WrenchPro SQLite databases.
  const junk = path.join(dataDir, 'junk.db');
  fs.writeFileSync(junk, 'hello');
  assert.throws(() => manager.inspectBackupFile(junk), /not a WrenchPro database/);
  const foreign = path.join(dataDir, 'foreign.db');
  const foreignDb = new Database(foreign); foreignDb.exec('CREATE TABLE notes (id INTEGER)'); foreignDb.close();
  assert.throws(() => manager.inspectBackupFile(foreign), /not a WrenchPro database/);
  await assert.rejects(() => manager.restoreFrom(dbPath), /not the live database/);
  await assert.rejects(() => manager.restoreFrom(junk), /not a WrenchPro database/);
  assert.ok(db.open, 'a rejected restore leaves the live database open');

  // Restore swaps in the backup and keeps a safety copy of the data it replaced.
  addCustomer('After');
  const { safetyCopy } = await manager.restoreFrom(first);
  assert.ok(!db.open, 'restore closes the live connection so the app can restart');
  assert.strictEqual(customerCount(dbPath), 1, 'restored database has the backup contents');
  assert.strictEqual(customerCount(safetyCopy), 2, 'safety copy holds the pre-restore data');
  assert.ok(path.basename(safetyCopy).startsWith('WrenchPro-before-restore-'));
  assert.ok(!fs.existsSync(`${dbPath}.restoring`));

  console.log('Backup QA passed: verified backups, daily auto-backup + pruning, folder fallback, file validation, restore with safety copy');
  fs.rmSync(dataDir, { recursive: true, force: true });
})().catch(error => {
  console.error(error);
  process.exit(1);
});
