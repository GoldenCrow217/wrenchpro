require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Only allow requests from localhost (Electron window or local browser)
app.use(cors({ origin: /^(http:\/\/localhost(:\d+)?|null)$/ }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/customers', require('./routes/customers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/employees', require('./routes/employees'));

app.get('/api/dashboard', (req, res) => {
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM payments').get().total;
  const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses').get().total;
  const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status != 'Done'").get().count;
  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  const totalVehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles').get().count;
  const recentJobs = db.prepare(`
    SELECT j.*, c.first, c.last, v.year, v.make, v.model
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN vehicles v ON j.vehicle_id = v.id
    ORDER BY j.date DESC LIMIT 5
  `).all();
  const recentPayments = db.prepare(`
    SELECT p.*, c.first, c.last FROM payments p
    JOIN customers c ON p.customer_id = c.id
    ORDER BY p.date DESC LIMIT 5
  `).all();
  res.json({ totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, activeJobs, totalCustomers, totalVehicles, recentJobs, recentPayments });
});

app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WrenchPro running at http://localhost:${PORT}`);
});