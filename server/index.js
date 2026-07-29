require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const pkg = require('../package.json');
const { customerTenantWhere, shopTenantWhere } = require('./tenant');

const app = express();
const PORT = process.env.PORT || 3000;

// Reduce passive fingerprinting on the local desktop server.
app.disable('x-powered-by');

// Only allow browser requests from localhost (Electron window or local browser),
// plus explicitly configured HTTPS origins for development. Keep the
// localhost regex fully anchored; a loose prefix match would allow origins like
// http://localhost.evil.test to receive CORS headers. Local desktop builds may
// load from a file/null origin.
const LOCALHOST_ORIGIN = /^http:\/\/localhost(:\d+)?$/;
function configuredAllowedOrigins() {
  return String(process.env.WRENCHPRO_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(origin => /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin));
}
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const cleanOrigin = String(origin).replace(/\/$/, '');
    if (LOCALHOST_ORIGIN.test(cleanOrigin)) return callback(null, true);
    if (configuredAllowedOrigins().includes(cleanOrigin)) return callback(null, true);
    if (origin === 'null') return callback(null, true);
    return callback(null, false);
  },
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'"
  );
  next();
});
app.use(express.json({ limit: '1mb' }));
// Keep route handlers deterministic for requests with no JSON body. Individual
// routes can then return a useful 400 instead of throwing while destructuring.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// API payloads contain private shop/customer data. Prevent browser caches from
// retaining API responses.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, version: pkg.version });
});


app.use('/api/customers',    require('./routes/customers'));
app.use('/api/vehicles',     require('./routes/vehicles'));
app.use('/api/jobs',         require('./routes/jobs'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/plans',        require('./routes/plans'));
app.use('/api/expenses',     require('./routes/expenses'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/employees',    require('./routes/employees'));
app.use('/api/crm',          require('./routes/crm'));
app.use('/api/estimates',    require('./routes/estimates'));
app.use('/api/inventory',    require('./routes/inventory'));
app.use('/api/catalog',      require('./routes/catalog'));
app.use('/api/inspections',  require('./routes/inspections'));
app.use('/api/warranties',   require('./routes/warranties'));
app.use('/api/time',         require('./routes/time'));
app.use('/api/leads',        require('./routes/leads'));

app.get('/api/dashboard', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(p.amount),0) as total
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE c.deleted_at IS NULL AND ${tenant.clause}
  `).get(...tenant.values).total;
  const expenseTenant = shopTenantWhere(req);
  const totalExpenses  = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE ${expenseTenant.clause}`).get(...expenseTenant.values).total;
  const activeJobs = db.prepare(`
    SELECT COUNT(*) as count
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.status NOT IN ('Complete','Canceled') AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(...tenant.values).count;
  const totalCustomers = db.prepare(`SELECT COUNT(*) as count FROM customers c WHERE c.deleted_at IS NULL AND ${tenant.clause}`).get(...tenant.values).count;
  const totalVehicles = db.prepare(`
    SELECT COUNT(*) as count
    FROM vehicles v
    JOIN customers c ON v.customer_id = c.id
    WHERE v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(...tenant.values).count;
  const recentJobs = db.prepare(`
    SELECT j.*, c.first, c.last, v.year, v.make, v.model
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles v  ON j.vehicle_id  = v.id
    WHERE j.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND v.deleted_at IS NULL
      AND j.status NOT IN ('Complete', 'Canceled')
      AND ${tenant.clause}
    ORDER BY j.date DESC LIMIT 5
  `).all(...tenant.values);
  const recentPayments = db.prepare(`
    SELECT p.*, c.first, c.last FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE c.deleted_at IS NULL AND ${tenant.clause}
    ORDER BY p.date DESC LIMIT 5
  `).all(...tenant.values);
  res.json({ totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, activeJobs, totalCustomers, totalVehicles, recentJobs, recentPayments });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global JSON error handler — prevents SQLite/Express stack traces reaching the client
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
  console.error(err.message || err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : (err.message || 'Request failed') });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`WrenchPro running at http://localhost:${PORT}`);
});
