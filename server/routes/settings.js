const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(row || {});
});

router.put('/', (req, res) => {
  const { business_name, owner_name, phone, email, address,
          default_labor_rate, default_pay_method, tax_rate,
          oil_warn_miles, currency_symbol } = req.body;
  db.prepare(`
    UPDATE settings SET
      business_name = ?,
      owner_name = ?,
      phone = ?,
      email = ?,
      address = ?,
      default_labor_rate = ?,
      default_pay_method = ?,
      tax_rate = ?,
      oil_warn_miles = ?,
      currency_symbol = ?
    WHERE id = 1
  `).run(
    business_name || '',
    owner_name || '',
    phone || '',
    email || '',
    address || '',
    parseFloat(default_labor_rate) || 0,
    default_pay_method || 'Cash',
    parseFloat(tax_rate) || 0,
    parseInt(oil_warn_miles) || 1500,
    currency_symbol || '$'
  );
  res.json({ ok: true });
});

module.exports = router;
