const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(row || {});
});

router.put('/', (req, res) => {
  const {
    business_name, owner_name, phone, email, address, website, business_hours,
    default_labor_rate, diagnostic_rate, fleet_rate, emergency_rate, service_fee,
    default_pay_method, tax_rate, oil_warn_miles, currency_symbol,
    tax_id, invoice_terms, invoice_footer, invoice_logo,
    warranty_terms, estimate_terms,
  } = req.body;
  db.prepare(`
    UPDATE settings SET
      business_name=?, owner_name=?, phone=?, email=?, address=?, website=?, business_hours=?,
      default_labor_rate=?, diagnostic_rate=?, fleet_rate=?, emergency_rate=?, service_fee=?,
      default_pay_method=?, tax_rate=?, oil_warn_miles=?, currency_symbol=?,
      tax_id=?, invoice_terms=?, invoice_footer=?, invoice_logo=?,
      warranty_terms=?, estimate_terms=?
    WHERE id = 1
  `).run(
    business_name || '', owner_name || '', phone || '', email || '', address || '', website || '', business_hours || '',
    parseFloat(default_labor_rate) || 0, parseFloat(diagnostic_rate) || 0, parseFloat(fleet_rate) || 0, parseFloat(emergency_rate) || 0, parseFloat(service_fee) || 0,
    default_pay_method || 'Cash', parseFloat(tax_rate) || 0, parseInt(oil_warn_miles) || 1500, currency_symbol || '$',
    tax_id || '', invoice_terms || 'Due on receipt', invoice_footer || 'Thank you for your business!', invoice_logo !== undefined ? invoice_logo : '',
    warranty_terms || '12 months / 12,000 miles', estimate_terms || '',
  );
  res.json({ ok: true });
});

module.exports = router;
