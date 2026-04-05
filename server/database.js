const Database = require('better-sqlite3');
const path = require('path');

// When running inside Electron (packaged or dev), WRENCHPRO_DATA points to
// the user's writable app-data directory.  Fall back to the project root for
// plain `node server/index.js` usage.
const dbPath = process.env.WRENCHPRO_DATA
  ? path.join(process.env.WRENCHPRO_DATA, 'wrenchpro.db')
  : path.join(__dirname, '..', 'wrenchpro.db');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first TEXT NOT NULL,
    last TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    year INTEGER,
    make TEXT,
    model TEXT,
    trim TEXT,
    color TEXT,
    plate TEXT,
    state TEXT,
    vin TEXT,
    miles INTEGER,
    oil_change_miles INTEGER,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    service TEXT,
    date TEXT,
    miles INTEGER,
    labor REAL DEFAULT 0,
    parts REAL DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS payment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    job_id INTEGER,
    description TEXT,
    total REAL NOT NULL,
    down_payment REAL DEFAULT 0,
    plan_type TEXT DEFAULT 'installments',
    installment_count INTEGER DEFAULT 4,
    frequency TEXT DEFAULT 'monthly',
    start_date TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    due_date TEXT,
    amount REAL,
    paid INTEGER DEFAULT 0,
    paid_date TEXT,
    FOREIGN KEY (plan_id) REFERENCES payment_plans(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    plan_id INTEGER,
    job_id INTEGER,
    description TEXT,
    amount REAL NOT NULL,
    method TEXT DEFAULT 'Cash',
    date TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    description TEXT,
    category TEXT,
    amount REAL NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT DEFAULT '',
    owner_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    default_labor_rate REAL DEFAULT 0,
    default_pay_method TEXT DEFAULT 'Cash',
    tax_rate REAL DEFAULT 0,
    oil_warn_miles INTEGER DEFAULT 1500,
    currency_symbol TEXT DEFAULT '$'
  );
`);

// Ensure one settings row always exists
db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();

module.exports = db;