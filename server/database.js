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
    repair_order_number TEXT DEFAULT '',
    date TEXT,
    miles INTEGER,
    labor REAL DEFAULT 0,
    parts REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax_rate REAL,
    status TEXT DEFAULT 'Pending',
    parts_deposit_required REAL DEFAULT 0,
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
    amount_paid REAL DEFAULT 0,
    late_fee REAL DEFAULT 0,
    FOREIGN KEY (plan_id) REFERENCES payment_plans(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    plan_id INTEGER,
    installment_id INTEGER,
    job_id INTEGER,
    late_fee_amount REAL DEFAULT 0,
    description TEXT,
    amount REAL NOT NULL,
    method TEXT DEFAULT 'Cash',
    date TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (installment_id) REFERENCES installments(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
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
    invoice_logo TEXT DEFAULT '',
    parts_markup_tiers TEXT DEFAULT '',
    require_parts_deposit INTEGER DEFAULT 0,
    parts_deposit_percent REAL DEFAULT 100,
    payment_grace_days INTEGER DEFAULT 0,
    late_fee REAL DEFAULT 0
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
    miles INTEGER DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS job_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    type TEXT DEFAULT 'labor',
    description TEXT DEFAULT '',
    qty REAL DEFAULT 1,
    rate REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    taxable INTEGER DEFAULT 0,
    inventory_id INTEGER REFERENCES parts_inventory(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_job_items_job ON job_items(job_id);

  CREATE TABLE IF NOT EXISTS parts_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
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
    shop_id INTEGER REFERENCES shops(id),
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
    measurement_value REAL,
    measurement_unit TEXT DEFAULT '',
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
    shop_id INTEGER REFERENCES shops(id),
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

  CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_email TEXT DEFAULT '',
    plan_status TEXT DEFAULT 'trial',
    supabase_org_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shop_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'mechanic',
    display_name TEXT DEFAULT '',
    supabase_user_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    UNIQUE (shop_id, email)
  );

  CREATE TABLE IF NOT EXISTS inspection_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_item_id INTEGER NOT NULL,
    file_path TEXT,
    caption TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (inspection_item_id) REFERENCES inspection_items(id)
  );

  CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
  CREATE INDEX IF NOT EXISTS idx_est_items_estimate ON estimate_items(estimate_id);
  CREATE INDEX IF NOT EXISTS idx_inspections_customer ON inspections(customer_id);
  CREATE INDEX IF NOT EXISTS idx_insp_items_insp ON inspection_items(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_insp_photos_item ON inspection_photos(inspection_item_id);
  CREATE INDEX IF NOT EXISTS idx_warranties_customer ON warranties(customer_id);
  CREATE INDEX IF NOT EXISTS idx_timelogs_employee ON time_logs(employee_id);
  CREATE INDEX IF NOT EXISTS idx_shop_memberships_shop ON shop_memberships(shop_id);
  CREATE INDEX IF NOT EXISTS idx_shop_memberships_email ON shop_memberships(email);

  CREATE TABLE IF NOT EXISTS shop_settings (
    shop_id INTEGER PRIMARY KEY,
    business_name TEXT DEFAULT '',
    owner_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    service_area TEXT DEFAULT '',
    website TEXT DEFAULT '',
    business_hours TEXT DEFAULT '',
    default_labor_rate REAL DEFAULT 0,
    diagnostic_rate REAL DEFAULT 0,
    fleet_rate REAL DEFAULT 0,
    emergency_rate REAL DEFAULT 0,
    service_fee REAL DEFAULT 0,
    default_pay_method TEXT DEFAULT 'Cash',
    tax_rate REAL DEFAULT 0,
    oil_warn_miles INTEGER DEFAULT 1500,
    currency_symbol TEXT DEFAULT '$',
    tax_id TEXT DEFAULT '',
    invoice_terms TEXT DEFAULT 'Due on receipt',
    invoice_footer TEXT DEFAULT 'Thank you for your business!',
    invoice_logo TEXT DEFAULT '',
    warranty_terms TEXT DEFAULT '12 months / 12,000 miles',
    estimate_terms TEXT DEFAULT '',
    parts_markup_tiers TEXT DEFAULT '',
    require_parts_deposit INTEGER DEFAULT 0,
    parts_deposit_percent REAL DEFAULT 100,
    payment_grace_days INTEGER DEFAULT 0,
    late_fee REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
  );
`);

// Ensure one settings row always exists
db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();

// Migrate: shops and hosted SaaS memberships
const shopCols = db.prepare(`PRAGMA table_info(shops)`).all().map(c => c.name);
if (!shopCols.includes('owner_email'))     db.prepare(`ALTER TABLE shops ADD COLUMN owner_email TEXT DEFAULT ''`).run();
if (!shopCols.includes('plan_status'))     db.prepare(`ALTER TABLE shops ADD COLUMN plan_status TEXT DEFAULT 'trial'`).run();
if (!shopCols.includes('supabase_org_id')) db.prepare(`ALTER TABLE shops ADD COLUMN supabase_org_id TEXT DEFAULT ''`).run();
if (!shopCols.includes('created_at'))      db.prepare(`ALTER TABLE shops ADD COLUMN created_at TEXT DEFAULT ''`).run();

const memberCols = db.prepare(`PRAGMA table_info(shop_memberships)`).all().map(c => c.name);
if (!memberCols.includes('role'))             db.prepare(`ALTER TABLE shop_memberships ADD COLUMN role TEXT DEFAULT 'mechanic'`).run();
if (!memberCols.includes('display_name'))     db.prepare(`ALTER TABLE shop_memberships ADD COLUMN display_name TEXT DEFAULT ''`).run();
if (!memberCols.includes('supabase_user_id')) db.prepare(`ALTER TABLE shop_memberships ADD COLUMN supabase_user_id TEXT DEFAULT ''`).run();
if (!memberCols.includes('created_at'))       db.prepare(`ALTER TABLE shop_memberships ADD COLUMN created_at TEXT DEFAULT ''`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_shop_memberships_shop ON shop_memberships(shop_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_shop_memberships_email ON shop_memberships(email)`).run();

// Migrate: customers
const custCols = db.prepare(`PRAGMA table_info(customers)`).all().map(c => c.name);
if (!custCols.includes('status'))           db.prepare(`ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'Active'`).run();
if (!custCols.includes('tags'))             db.prepare(`ALTER TABLE customers ADD COLUMN tags TEXT DEFAULT ''`).run();
if (!custCols.includes('customer_type'))    db.prepare(`ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'Personal'`).run();
if (!custCols.includes('preferred_contact'))db.prepare(`ALTER TABLE customers ADD COLUMN preferred_contact TEXT DEFAULT 'Phone'`).run();
if (!custCols.includes('billing_address'))  db.prepare(`ALTER TABLE customers ADD COLUMN billing_address TEXT DEFAULT ''`).run();
if (!custCols.includes('deleted_at'))       db.prepare(`ALTER TABLE customers ADD COLUMN deleted_at TEXT`).run();
if (!custCols.includes('shop_id'))          db.prepare(`ALTER TABLE customers ADD COLUMN shop_id INTEGER REFERENCES shops(id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id)`).run();

// Migrate: jobs
const jobCols = db.prepare(`PRAGMA table_info(jobs)`).all().map(c => c.name);
if (!jobCols.includes('employee_id'))      db.prepare(`ALTER TABLE jobs ADD COLUMN employee_id INTEGER REFERENCES employees(id)`).run();
if (!jobCols.includes('labor_hours'))      db.prepare(`ALTER TABLE jobs ADD COLUMN labor_hours REAL DEFAULT 0`).run();
if (!jobCols.includes('labor_rate'))       db.prepare(`ALTER TABLE jobs ADD COLUMN labor_rate REAL DEFAULT 0`).run();
if (!jobCols.includes('complaint'))        db.prepare(`ALTER TABLE jobs ADD COLUMN complaint TEXT DEFAULT ''`).run();
if (!jobCols.includes('diagnosis'))        db.prepare(`ALTER TABLE jobs ADD COLUMN diagnosis TEXT DEFAULT ''`).run();
if (!jobCols.includes('invoice_status'))   db.prepare(`ALTER TABLE jobs ADD COLUMN invoice_status TEXT DEFAULT 'Unpaid'`).run();
if (!jobCols.includes('estimate_id'))      db.prepare(`ALTER TABLE jobs ADD COLUMN estimate_id INTEGER`).run();
if (!jobCols.includes('service_address'))  db.prepare(`ALTER TABLE jobs ADD COLUMN service_address TEXT DEFAULT ''`).run();
if (!jobCols.includes('travel_fee'))       db.prepare(`ALTER TABLE jobs ADD COLUMN travel_fee REAL DEFAULT 0`).run();
if (!jobCols.includes('closed_at'))        db.prepare(`ALTER TABLE jobs ADD COLUMN closed_at TEXT`).run();
if (!jobCols.includes('deleted_at'))       db.prepare(`ALTER TABLE jobs ADD COLUMN deleted_at TEXT`).run();
if (!jobCols.includes('notify_en_route'))  db.prepare(`ALTER TABLE jobs ADD COLUMN notify_en_route INTEGER DEFAULT 1`).run();
if (!jobCols.includes('repair_order_number')) db.prepare(`ALTER TABLE jobs ADD COLUMN repair_order_number TEXT DEFAULT ''`).run();
if (!jobCols.includes('parts_deposit_required')) db.prepare(`ALTER TABLE jobs ADD COLUMN parts_deposit_required REAL DEFAULT 0`).run();
if (!jobCols.includes('tax_rate'))              db.prepare(`ALTER TABLE jobs ADD COLUMN tax_rate REAL`).run();
if (!jobCols.includes('discount'))              db.prepare(`ALTER TABLE jobs ADD COLUMN discount REAL DEFAULT 0`).run();

// Migrate: vehicles
const vehCols = db.prepare(`PRAGMA table_info(vehicles)`).all().map(c => c.name);
if (!vehCols.includes('fuel_type'))     db.prepare(`ALTER TABLE vehicles ADD COLUMN fuel_type TEXT DEFAULT ''`).run();
if (!vehCols.includes('transmission'))  db.prepare(`ALTER TABLE vehicles ADD COLUMN transmission TEXT DEFAULT ''`).run();
if (!vehCols.includes('engine'))        db.prepare(`ALTER TABLE vehicles ADD COLUMN engine TEXT DEFAULT ''`).run();
if (!vehCols.includes('deleted_at'))    db.prepare(`ALTER TABLE vehicles ADD COLUMN deleted_at TEXT`).run();

// Migrate: inspection measurements
const inspectionItemCols = db.prepare(`PRAGMA table_info(inspection_items)`).all().map(c => c.name);
if (!inspectionItemCols.includes('measurement_value')) db.prepare(`ALTER TABLE inspection_items ADD COLUMN measurement_value REAL`).run();
if (!inspectionItemCols.includes('measurement_unit'))  db.prepare(`ALTER TABLE inspection_items ADD COLUMN measurement_unit TEXT DEFAULT ''`).run();

// Migrate: expenses
const expCols = db.prepare(`PRAGMA table_info(expenses)`).all().map(c => c.name);
if (!expCols.includes('shop_id')) db.prepare(`ALTER TABLE expenses ADD COLUMN shop_id INTEGER REFERENCES shops(id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_expenses_shop ON expenses(shop_id)`).run();

// Migrate: stable installment-payment relationship for atomic/idempotent plan payments
const paymentCols = db.prepare(`PRAGMA table_info(payments)`).all().map(c => c.name);
if (!paymentCols.includes('installment_id')) db.prepare(`ALTER TABLE payments ADD COLUMN installment_id INTEGER REFERENCES installments(id)`).run();
const addedLateFeeAmount = !paymentCols.includes('late_fee_amount');
if (addedLateFeeAmount) db.prepare(`ALTER TABLE payments ADD COLUMN late_fee_amount REAL DEFAULT 0`).run();
if (!paymentCols.includes('payment_type')) db.prepare(`ALTER TABLE payments ADD COLUMN payment_type TEXT DEFAULT 'payment'`).run();
if (!paymentCols.includes('parent_payment_id')) db.prepare(`ALTER TABLE payments ADD COLUMN parent_payment_id INTEGER REFERENCES payments(id)`).run();
db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_installment_unique ON payments(installment_id) WHERE installment_id IS NOT NULL`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_payments_parent ON payments(parent_payment_id)`).run();

const installmentCols = db.prepare(`PRAGMA table_info(installments)`).all().map(c => c.name);
if (!installmentCols.includes('amount_paid')) db.prepare(`ALTER TABLE installments ADD COLUMN amount_paid REAL DEFAULT 0`).run();
if (!installmentCols.includes('late_fee')) db.prepare(`ALTER TABLE installments ADD COLUMN late_fee REAL DEFAULT 0`).run();
db.prepare(`UPDATE installments SET amount_paid=amount WHERE paid=1 AND COALESCE(amount_paid,0)=0`).run();
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL REFERENCES payments(id),
    installment_id INTEGER NOT NULL REFERENCES installments(id),
    amount REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
  CREATE INDEX IF NOT EXISTS idx_payment_allocations_installment ON payment_allocations(installment_id);
`);
if (addedLateFeeAmount) {
  db.prepare(`
    UPDATE payments
    SET late_fee_amount = COALESCE((SELECT late_fee FROM installments WHERE installments.id=payments.installment_id),0)
    WHERE installment_id IS NOT NULL
  `).run();
  const allocationRows = db.prepare(`
    SELECT pa.payment_id, pa.installment_id, pa.amount AS allocated_amount, i.amount AS principal_amount, i.late_fee
    FROM payment_allocations pa
    JOIN installments i ON i.id=pa.installment_id
    JOIN payments p ON p.id=pa.payment_id
    WHERE COALESCE(i.late_fee,0)>0
    ORDER BY pa.installment_id, p.date, p.id, pa.id
  `).all();
  const allocatedByInstallment = new Map();
  const feeByPayment = new Map();
  allocationRows.forEach(row => {
    const previouslyAllocated = allocatedByInstallment.get(row.installment_id) || 0;
    const newlyAllocated = previouslyAllocated + Number(row.allocated_amount || 0);
    const previousFee = Math.max(0, previouslyAllocated - Number(row.principal_amount || 0));
    const newFee = Math.min(Number(row.late_fee || 0), Math.max(0, newlyAllocated - Number(row.principal_amount || 0)));
    const feeAmount = Math.max(0, newFee - previousFee);
    allocatedByInstallment.set(row.installment_id, newlyAllocated);
    if (feeAmount > 0) feeByPayment.set(row.payment_id, (feeByPayment.get(row.payment_id) || 0) + feeAmount);
  });
  const updateLateFee = db.prepare('UPDATE payments SET late_fee_amount=? WHERE id=?');
  feeByPayment.forEach((amount, paymentId) => updateLateFee.run(Math.round(amount * 100) / 100, paymentId));
}

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
  ['service_area',    "TEXT DEFAULT ''"],
  ['warranty_terms',  "TEXT DEFAULT '12 months / 12,000 miles'"],
  ['estimate_terms',  "TEXT DEFAULT ''"],
  ['parts_markup_tiers', "TEXT DEFAULT ''"],
  ['require_parts_deposit', 'INTEGER DEFAULT 0'],
  ['parts_deposit_percent', 'REAL DEFAULT 100'],
  ['payment_grace_days', 'INTEGER DEFAULT 0'],
  ['late_fee', 'REAL DEFAULT 0'],
];
for (const [col, def] of newSettCols) {
  if (!settCols.includes(col)) db.prepare(`ALTER TABLE settings ADD COLUMN ${col} ${def}`).run();
}

// Migrate: per-shop settings (mirrors global settings but scoped by shop)
const shopSettCols = db.prepare(`PRAGMA table_info(shop_settings)`).all().map(c => c.name);
for (const [col, def] of newSettCols) {
  if (!shopSettCols.includes(col)) db.prepare(`ALTER TABLE shop_settings ADD COLUMN ${col} ${def}`).run();
}

// Migrate: estimates
const estCols = db.prepare(`PRAGMA table_info(estimates)`).all().map(c => c.name);
if (!estCols.includes('approved_at'))     db.prepare(`ALTER TABLE estimates ADD COLUMN approved_at TEXT`).run();
if (!estCols.includes('approved_by'))     db.prepare(`ALTER TABLE estimates ADD COLUMN approved_by TEXT DEFAULT ''`).run();
if (!estCols.includes('approval_notes'))  db.prepare(`ALTER TABLE estimates ADD COLUMN approval_notes TEXT DEFAULT ''`).run();
if (!estCols.includes('deleted_at'))      db.prepare(`ALTER TABLE estimates ADD COLUMN deleted_at TEXT`).run();
if (!estCols.includes('miles'))           db.prepare(`ALTER TABLE estimates ADD COLUMN miles INTEGER DEFAULT 0`).run();

// Migrate: estimate_items
const estItemCols = db.prepare(`PRAGMA table_info(estimate_items)`).all().map(c => c.name);
if (!estItemCols.includes('inventory_id')) db.prepare(`ALTER TABLE estimate_items ADD COLUMN inventory_id INTEGER REFERENCES parts_inventory(id)`).run();

// Migrate: appointments
const apptCols = db.prepare(`PRAGMA table_info(appointments)`).all().map(c => c.name);
if (!apptCols.includes('shop_id'))      db.prepare(`ALTER TABLE appointments ADD COLUMN shop_id INTEGER REFERENCES shops(id)`).run();
if (!apptCols.includes('customer_id'))  db.prepare(`ALTER TABLE appointments ADD COLUMN customer_id INTEGER REFERENCES customers(id)`).run();
if (!apptCols.includes('vehicle_id'))   db.prepare(`ALTER TABLE appointments ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id)`).run();
if (!apptCols.includes('address'))      db.prepare(`ALTER TABLE appointments ADD COLUMN address TEXT DEFAULT ''`).run();
if (!apptCols.includes('notes'))        db.prepare(`ALTER TABLE appointments ADD COLUMN notes TEXT DEFAULT ''`).run();
if (!apptCols.includes('estimate_id'))  db.prepare(`ALTER TABLE appointments ADD COLUMN estimate_id INTEGER`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_appointments_shop ON appointments(shop_id)`).run();

// Migrate: employees
const employeeCols = db.prepare(`PRAGMA table_info(employees)`).all().map(c => c.name);
if (!employeeCols.includes('shop_id')) db.prepare(`ALTER TABLE employees ADD COLUMN shop_id INTEGER REFERENCES shops(id)`).run();
if (!employeeCols.includes('deleted_at')) db.prepare(`ALTER TABLE employees ADD COLUMN deleted_at TEXT`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_employees_shop ON employees(shop_id)`).run();

// Migrate: inventory and catalog
const inventoryCols = db.prepare(`PRAGMA table_info(parts_inventory)`).all().map(c => c.name);
if (!inventoryCols.includes('shop_id')) db.prepare(`ALTER TABLE parts_inventory ADD COLUMN shop_id INTEGER REFERENCES shops(id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_parts_inventory_shop ON parts_inventory(shop_id)`).run();

const catalogCols = db.prepare(`PRAGMA table_info(service_catalog)`).all().map(c => c.name);
if (!catalogCols.includes('shop_id')) db.prepare(`ALTER TABLE service_catalog ADD COLUMN shop_id INTEGER REFERENCES shops(id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_service_catalog_shop ON service_catalog(shop_id)`).run();

// Migrate: leads
const leadCols = db.prepare(`PRAGMA table_info(leads)`).all().map(c => c.name);
if (!leadCols.includes('shop_id')) db.prepare(`ALTER TABLE leads ADD COLUMN shop_id INTEGER REFERENCES shops(id)`).run();
if (!leadCols.includes('vin'))     db.prepare(`ALTER TABLE leads ADD COLUMN vin TEXT DEFAULT ''`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_leads_shop ON leads(shop_id)`).run();

// Migrate: connected shop operations. These tables keep the repair order as
// the central record while remaining entirely inside the local SQLite file.
db.exec(`
  CREATE TABLE IF NOT EXISTS workflow_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#6B7280',
    is_active INTEGER DEFAULT 1,
    is_closed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shop_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'bay',
    color TEXT DEFAULT '#6B7280',
    position INTEGER NOT NULL DEFAULT 0,
    active INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inspection_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inspection_template_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
    category TEXT DEFAULT '',
    item_name TEXT NOT NULL,
    input_type TEXT DEFAULT 'condition',
    measurement_unit TEXT DEFAULT '',
    position_label TEXT DEFAULT '',
    quick_notes TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS service_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    job_id INTEGER REFERENCES jobs(id),
    estimate_id INTEGER REFERENCES estimates(id),
    item_type TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    authorization_method TEXT DEFAULT '',
    customer_name TEXT DEFAULT '',
    signature TEXT DEFAULT '',
    authorized_price REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    employee_id INTEGER REFERENCES employees(id),
    authorized_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deferred_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    source_type TEXT DEFAULT '',
    source_id INTEGER,
    source_item_id INTEGER,
    description TEXT NOT NULL,
    qty REAL DEFAULT 1,
    rate REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    deferred_reason TEXT DEFAULT '',
    deferred_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    inventory_id INTEGER NOT NULL REFERENCES parts_inventory(id),
    job_id INTEGER REFERENCES jobs(id),
    estimate_id INTEGER REFERENCES estimates(id),
    quantity REAL NOT NULL,
    status TEXT DEFAULT 'reserved',
    created_at TEXT DEFAULT (datetime('now')),
    released_at TEXT
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    account_number TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    po_number TEXT NOT NULL,
    vendor_id INTEGER REFERENCES vendors(id),
    job_id INTEGER REFERENCES jobs(id),
    status TEXT DEFAULT 'Draft',
    vendor_invoice_number TEXT DEFAULT '',
    ordered_at TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    inventory_id INTEGER REFERENCES parts_inventory(id),
    description TEXT NOT NULL,
    part_number TEXT DEFAULT '',
    quantity_ordered REAL NOT NULL DEFAULT 1,
    quantity_received REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    add_to_inventory INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS job_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_item_id INTEGER REFERENCES job_items(id) ON DELETE SET NULL,
    employee_id INTEGER REFERENCES employees(id),
    description TEXT NOT NULL,
    estimated_hours REAL DEFAULT 0,
    status TEXT DEFAULT 'Not Started',
    sort_order INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vehicle_service_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER REFERENCES shops(id),
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    event_type TEXT NOT NULL,
    mileage INTEGER DEFAULT 0,
    fuel_level TEXT DEFAULT '',
    warning_lights TEXT DEFAULT '',
    exterior_damage TEXT DEFAULT '',
    keys_received TEXT DEFAULT '',
    road_test_notes TEXT DEFAULT '',
    checklist TEXT DEFAULT '{}',
    photos TEXT DEFAULT '[]',
    employee_id INTEGER REFERENCES employees(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_workflow_columns_shop ON workflow_columns(shop_id, position);
  CREATE INDEX IF NOT EXISTS idx_shop_resources_shop ON shop_resources(shop_id, position);
  CREATE INDEX IF NOT EXISTS idx_inspection_templates_shop ON inspection_templates(shop_id, active);
  CREATE INDEX IF NOT EXISTS idx_inspection_template_items_template ON inspection_template_items(template_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_authorizations_job ON service_authorizations(job_id, item_type, item_id);
  CREATE INDEX IF NOT EXISTS idx_authorizations_estimate ON service_authorizations(estimate_id, item_type, item_id);
  CREATE INDEX IF NOT EXISTS idx_deferred_customer ON deferred_services(customer_id, status);
  CREATE INDEX IF NOT EXISTS idx_reservations_inventory ON inventory_reservations(inventory_id, status);
  CREATE INDEX IF NOT EXISTS idx_purchase_orders_shop ON purchase_orders(shop_id, status);
  CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
  CREATE INDEX IF NOT EXISTS idx_job_tasks_job ON job_tasks(job_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_vehicle_service_events_job ON vehicle_service_events(job_id, event_type);
`);

const connectedJobCols = db.prepare(`PRAGMA table_info(jobs)`).all().map(c => c.name);
if (!connectedJobCols.includes('workflow_column_id')) db.prepare(`ALTER TABLE jobs ADD COLUMN workflow_column_id INTEGER REFERENCES workflow_columns(id)`).run();
if (!connectedJobCols.includes('resource_id')) db.prepare(`ALTER TABLE jobs ADD COLUMN resource_id INTEGER REFERENCES shop_resources(id)`).run();
if (!connectedJobCols.includes('promised_at')) db.prepare(`ALTER TABLE jobs ADD COLUMN promised_at TEXT`).run();
if (!connectedJobCols.includes('priority')) db.prepare(`ALTER TABLE jobs ADD COLUMN priority TEXT DEFAULT 'Normal'`).run();

const connectedApptCols = db.prepare(`PRAGMA table_info(appointments)`).all().map(c => c.name);
if (!connectedApptCols.includes('resource_id')) db.prepare(`ALTER TABLE appointments ADD COLUMN resource_id INTEGER REFERENCES shop_resources(id)`).run();
if (!connectedApptCols.includes('duration_minutes')) db.prepare(`ALTER TABLE appointments ADD COLUMN duration_minutes INTEGER DEFAULT 60`).run();
if (!connectedApptCols.includes('recurrence_rule')) db.prepare(`ALTER TABLE appointments ADD COLUMN recurrence_rule TEXT DEFAULT ''`).run();

const connectedInspectionCols = db.prepare(`PRAGMA table_info(inspections)`).all().map(c => c.name);
if (!connectedInspectionCols.includes('template_id')) db.prepare(`ALTER TABLE inspections ADD COLUMN template_id INTEGER REFERENCES inspection_templates(id)`).run();
if (!connectedInspectionCols.includes('completed_at')) db.prepare(`ALTER TABLE inspections ADD COLUMN completed_at TEXT`).run();
if (!connectedInspectionCols.includes('completed_by')) db.prepare(`ALTER TABLE inspections ADD COLUMN completed_by INTEGER REFERENCES employees(id)`).run();

const connectedInspectionItemCols = db.prepare(`PRAGMA table_info(inspection_items)`).all().map(c => c.name);
if (!connectedInspectionItemCols.includes('position_label')) db.prepare(`ALTER TABLE inspection_items ADD COLUMN position_label TEXT DEFAULT ''`).run();
if (!connectedInspectionItemCols.includes('input_type')) db.prepare(`ALTER TABLE inspection_items ADD COLUMN input_type TEXT DEFAULT 'condition'`).run();
if (!connectedInspectionItemCols.includes('recommendation')) db.prepare(`ALTER TABLE inspection_items ADD COLUMN recommendation TEXT DEFAULT ''`).run();
if (!connectedInspectionItemCols.includes('recommendation_status')) db.prepare(`ALTER TABLE inspection_items ADD COLUMN recommendation_status TEXT DEFAULT ''`).run();

const connectedTimeCols = db.prepare(`PRAGMA table_info(time_logs)`).all().map(c => c.name);
if (!connectedTimeCols.includes('job_item_id')) db.prepare(`ALTER TABLE time_logs ADD COLUMN job_item_id INTEGER REFERENCES job_items(id)`).run();

// A practical local default. Shops can rename, reorder, add, deactivate, or
// remove unused columns later through the Workflow screen.
if (!db.prepare(`SELECT 1 FROM workflow_columns WHERE shop_id IS NULL LIMIT 1`).get()) {
  const insertColumn = db.prepare(`INSERT INTO workflow_columns (shop_id,name,position,color,is_closed) VALUES (NULL,?,?,?,?)`);
  [
    ['Estimate', 10, '#64748B', 0], ['Awaiting Approval', 20, '#D97706', 0],
    ['Scheduled', 30, '#2563EB', 0], ['Checked In', 40, '#7C3AED', 0],
    ['Waiting for Parts', 50, '#EA580C', 0], ['In Progress', 60, '#0891B2', 0],
    ['Quality Check', 70, '#4F46E5', 0], ['Ready for Pickup', 80, '#16A34A', 0],
    ['Closed', 90, '#475569', 1],
  ].forEach(column => insertColumn.run(...column));
}

// Data backfills — run after all schema migrations so columns are guaranteed to exist
db.prepare(`UPDATE jobs SET status='Complete' WHERE status='Done'`).run();
db.prepare(`UPDATE jobs SET closed_at=datetime('now') WHERE status IN ('Complete','Canceled') AND closed_at IS NULL`).run();
db.transaction(() => {
  const repairOrders = db.prepare(`SELECT id, repair_order_number FROM jobs ORDER BY id`).all();
  let highest = repairOrders.reduce((max, job) => {
    const match = String(job.repair_order_number || '').trim().match(/^RO-(\d{4,})$/i);
    if (!match) return max;
    const sequence = Number(match[1]);
    return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
  }, 1000);
  const update = db.prepare(`UPDATE jobs SET repair_order_number=? WHERE id=?`);
  repairOrders.forEach(job => {
    const current = String(job.repair_order_number || '').trim();
    if (!current) {
      highest += 1;
      update.run(`RO-${String(highest).padStart(4, '0')}`, job.id);
    } else if (/^RO-\d{4,}$/i.test(current) && current !== current.toUpperCase()) {
      update.run(current.toUpperCase(), job.id);
    }
  });
})();
db.transaction(() => {
  const jobs = db.prepare(`SELECT id FROM jobs WHERE trim(COALESCE(service,''))='' ORDER BY id`).all();
  const descriptions = db.prepare(`
    SELECT description FROM job_items
    WHERE job_id=? AND trim(COALESCE(description,''))<>''
    ORDER BY id
  `);
  const update = db.prepare(`UPDATE jobs SET service=? WHERE id=?`);
  jobs.forEach(job => {
    const service = descriptions.all(job.id)
      .map(item => String(item.description).trim())
      .filter(Boolean)
      .join(', ')
      .slice(0, 255);
    if (service) update.run(service, job.id);
  });
})();
db.prepare(`
  UPDATE jobs
  SET tax_rate = COALESCE(
    (SELECT ss.tax_rate FROM customers c JOIN shop_settings ss ON ss.shop_id=c.shop_id WHERE c.id=jobs.customer_id),
    (SELECT tax_rate FROM settings WHERE id=1),
    0
  )
  WHERE tax_rate IS NULL
    AND (closed_at IS NOT NULL OR status IN ('Complete','Canceled') OR invoice_status IN ('Paid','Voided'))
`).run();
db.prepare(`
  UPDATE jobs
  SET labor_hours = ROUND((
        SELECT COALESCE(SUM(ji.qty),0) FROM job_items ji
        WHERE ji.job_id=jobs.id AND lower(ji.type) IN ('labor','diagnostic')
      ),3),
      labor_rate = ROUND(COALESCE((
        SELECT COALESCE(SUM(ji.amount),0) / NULLIF(SUM(ji.qty),0) FROM job_items ji
        WHERE ji.job_id=jobs.id AND lower(ji.type) IN ('labor','diagnostic')
      ),0),2)
  WHERE EXISTS (
    SELECT 1 FROM job_items ji
    WHERE ji.job_id=jobs.id AND lower(ji.type) IN ('labor','diagnostic')
  )
    AND (COALESCE(labor_hours,0)=0 OR COALESCE(labor_rate,0)=0)
`).run();

module.exports = db;
