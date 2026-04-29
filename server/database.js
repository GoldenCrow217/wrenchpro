const Database = require('better-sqlite3');
const path = require('path');

// When running inside Electron (packaged or dev), WRENCHPRO_DATA points to
// the user's writable app-data directory.  Fall back to the project root for
// plain `node server/index.js` usage.
const dbPath = process.env.WRENCHPRO_DATA
  ? path.join(process.env.WRENCHPRO_DATA, 'wrenchpro.db')
  : path.join(__dirname, '..', 'wrenchpro.db');

const db = new Database(dbPath);

// Performance + integrity pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
    currency_symbol TEXT DEFAULT '$',
    tax_id TEXT DEFAULT '',
    invoice_terms TEXT DEFAULT 'Due on receipt',
    invoice_footer TEXT DEFAULT 'Thank you for your business!',
    invoice_logo TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first TEXT NOT NULL,
    last TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    role TEXT DEFAULT 'Mechanic',
    hourly_rate REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cust TEXT NOT NULL,
    phone TEXT,
    service TEXT,
    date TEXT NOT NULL,
    time TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customer_interactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type        TEXT DEFAULT 'Note',
    summary     TEXT NOT NULL,
    employee_id INTEGER,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS follow_ups (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER NOT NULL,
    due_date     TEXT NOT NULL,
    note         TEXT,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS service_reminders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL,
    vehicle_id    INTEGER,
    service_type  TEXT,
    reminder_date TEXT NOT NULL,
    note          TEXT,
    status        TEXT DEFAULT 'pending',
    created_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_vehicle ON jobs(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
  CREATE INDEX IF NOT EXISTS idx_payments_plan ON payments(plan_id);
  CREATE INDEX IF NOT EXISTS idx_installments_plan ON installments(plan_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
  CREATE INDEX IF NOT EXISTS idx_interactions_customer ON customer_interactions(customer_id);
  CREATE INDEX IF NOT EXISTS idx_followups_customer ON follow_ups(customer_id);
  CREATE INDEX IF NOT EXISTS idx_svcrem_customer ON service_reminders(customer_id);

  CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    employee_id INTEGER,
    estimate_number TEXT,
    date TEXT,
    status TEXT DEFAULT 'Draft',
    notes TEXT DEFAULT '',
    customer_complaint TEXT DEFAULT '',
    discount REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    expires_date TEXT,
    total REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS estimate_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id INTEGER NOT NULL,
    type TEXT DEFAULT 'labor',
    description TEXT DEFAULT '',
    qty REAL DEFAULT 1,
    rate REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    FOREIGN KEY (estimate_id) REFERENCES estimates(id)
  );

  CREATE TABLE IF NOT EXISTS parts_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    part_number TEXT DEFAULT '',
    vendor TEXT DEFAULT '',
    cost REAL DEFAULT 0,
    retail_price REAL DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    reorder_qty INTEGER DEFAULT 0,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS service_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    default_hours REAL DEFAULT 0,
    default_price REAL DEFAULT 0,
    taxable INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    employee_id INTEGER,
    date TEXT,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'Draft',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS inspection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER NOT NULL,
    category TEXT DEFAULT '',
    item_name TEXT DEFAULT '',
    condition TEXT DEFAULT 'pass',
    notes TEXT DEFAULT '',
    FOREIGN KEY (inspection_id) REFERENCES inspections(id)
  );

  CREATE TABLE IF NOT EXISTS warranties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    description TEXT DEFAULT '',
    labor_months INTEGER DEFAULT 12,
    parts_months INTEGER DEFAULT 12,
    mileage_limit INTEGER DEFAULT 12000,
    notes TEXT DEFAULT '',
    start_date TEXT,
    expires_date TEXT,
    status TEXT DEFAULT 'Active',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    job_id INTEGER,
    type TEXT DEFAULT 'general',
    clock_in TEXT,
    clock_out TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first TEXT NOT NULL,
    last TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    source TEXT DEFAULT '',
    vehicle_year INTEGER,
    vehicle_make TEXT DEFAULT '',
    vehicle_model TEXT DEFAULT '',
    service_needed TEXT DEFAULT '',
    status TEXT DEFAULT 'New',
    notes TEXT DEFAULT '',
    follow_up_date TEXT,
    estimated_value REAL DEFAULT 0,
    converted_customer_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
  CREATE INDEX IF NOT EXISTS idx_est_items_estimate ON estimate_items(estimate_id);
  CREATE INDEX IF NOT EXISTS idx_inspections_customer ON inspections(customer_id);
  CREATE INDEX IF NOT EXISTS idx_insp_items_insp ON inspection_items(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_warranties_customer ON warranties(customer_id);
  CREATE INDEX IF NOT EXISTS idx_timelogs_employee ON time_logs(employee_id);
`);

// Ensure one settings row always exists
db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();

// Migrate: customers
const custCols = db.prepare(`PRAGMA table_info(customers)`).all().map(c => c.name);
if (!custCols.includes('status'))           db.prepare(`ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'Active'`).run();
if (!custCols.includes('tags'))             db.prepare(`ALTER TABLE customers ADD COLUMN tags TEXT DEFAULT ''`).run();
if (!custCols.includes('customer_type'))    db.prepare(`ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'Personal'`).run();
if (!custCols.includes('preferred_contact'))db.prepare(`ALTER TABLE customers ADD COLUMN preferred_contact TEXT DEFAULT 'Phone'`).run();
if (!custCols.includes('billing_address'))  db.prepare(`ALTER TABLE customers ADD COLUMN billing_address TEXT DEFAULT ''`).run();

// Migrate: jobs
const jobCols = db.prepare(`PRAGMA table_info(jobs)`).all().map(c => c.name);
if (!jobCols.includes('employee_id'))    db.prepare(`ALTER TABLE jobs ADD COLUMN employee_id INTEGER REFERENCES employees(id)`).run();
if (!jobCols.includes('labor_hours'))    db.prepare(`ALTER TABLE jobs ADD COLUMN labor_hours REAL DEFAULT 0`).run();
if (!jobCols.includes('labor_rate'))     db.prepare(`ALTER TABLE jobs ADD COLUMN labor_rate REAL DEFAULT 0`).run();
if (!jobCols.includes('complaint'))      db.prepare(`ALTER TABLE jobs ADD COLUMN complaint TEXT DEFAULT ''`).run();
if (!jobCols.includes('diagnosis'))      db.prepare(`ALTER TABLE jobs ADD COLUMN diagnosis TEXT DEFAULT ''`).run();
if (!jobCols.includes('invoice_status')) db.prepare(`ALTER TABLE jobs ADD COLUMN invoice_status TEXT DEFAULT 'Unpaid'`).run();
if (!jobCols.includes('estimate_id'))    db.prepare(`ALTER TABLE jobs ADD COLUMN estimate_id INTEGER`).run();

// Migrate: vehicles
const vehCols = db.prepare(`PRAGMA table_info(vehicles)`).all().map(c => c.name);
if (!vehCols.includes('fuel_type'))     db.prepare(`ALTER TABLE vehicles ADD COLUMN fuel_type TEXT DEFAULT ''`).run();
if (!vehCols.includes('transmission'))  db.prepare(`ALTER TABLE vehicles ADD COLUMN transmission TEXT DEFAULT ''`).run();
if (!vehCols.includes('engine'))        db.prepare(`ALTER TABLE vehicles ADD COLUMN engine TEXT DEFAULT ''`).run();

// Migrate: settings (new columns)
const settCols = db.prepare(`PRAGMA table_info(settings)`).all().map(c => c.name);
const newSettCols = [
  ['tax_id',          "TEXT DEFAULT ''"],
  ['invoice_terms',   "TEXT DEFAULT 'Due on receipt'"],
  ['invoice_footer',  "TEXT DEFAULT 'Thank you for your business!'"],
  ['invoice_logo',    "TEXT DEFAULT ''"],
  ['diagnostic_rate', 'REAL DEFAULT 0'],
  ['fleet_rate',      'REAL DEFAULT 0'],
  ['emergency_rate',  'REAL DEFAULT 0'],
  ['service_fee',     'REAL DEFAULT 0'],
  ['website',         "TEXT DEFAULT ''"],
  ['business_hours',  "TEXT DEFAULT ''"],
  ['warranty_terms',  "TEXT DEFAULT '12 months / 12,000 miles'"],
  ['estimate_terms',  "TEXT DEFAULT ''"],
];
for (const [col, def] of newSettCols) {
  if (!settCols.includes(col)) db.prepare(`ALTER TABLE settings ADD COLUMN ${col} ${def}`).run();
}

module.exports = db;