const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId } = require('../tenant');
const { fail, finiteNumber } = require('../validation');
const { normalizeMarkupTiers } = require('../pricing');

const SETTINGS_FIELDS = [
  'business_name', 'owner_name', 'phone', 'email', 'address', 'service_area', 'website', 'business_hours',
  'default_labor_rate', 'diagnostic_rate', 'fleet_rate', 'emergency_rate', 'service_fee',
  'default_pay_method', 'tax_rate', 'oil_warn_miles', 'currency_symbol',
  'tax_id', 'invoice_terms', 'invoice_footer', 'invoice_logo',
  'warranty_terms', 'estimate_terms', 'parts_markup_tiers',
];

function globalSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get() || {};
}

function shopSettings(shopId) {
  if (!shopId) return null;
  return db.prepare('SELECT * FROM shop_settings WHERE shop_id = ?').get(shopId) || null;
}

router.get('/', (req, res) => {
  const shopId = resolveShopId(req);
  const row = shopSettings(shopId) || globalSettings();
  res.json(row || {});
});

router.put('/', (req, res) => {
  for (const [field, label] of [['default_labor_rate','Default labor rate'],['diagnostic_rate','Diagnostic rate'],['fleet_rate','Fleet rate'],['emergency_rate','Emergency rate'],['service_fee','Service fee'],['tax_rate','Tax rate'],['oil_warn_miles','Oil warning mileage']]) {
    if (!finiteNumber(res, req.body, field, { label })) return;
  }
  let partsMarkupTiers;
  try {
    partsMarkupTiers = JSON.stringify(normalizeMarkupTiers(req.body.parts_markup_tiers));
  } catch (error) {
    return fail(res, 'parts_markup_tiers', error.message);
  }
  const shopId = resolveShopId(req);
  const values = {
    business_name: req.body.business_name || '',
    owner_name: req.body.owner_name || '',
    phone: req.body.phone || '',
    email: req.body.email || '',
    address: req.body.address || '',
    service_area: req.body.service_area || '',
    website: req.body.website || '',
    business_hours: req.body.business_hours || '',
    default_labor_rate: parseFloat(req.body.default_labor_rate) || 0,
    diagnostic_rate: parseFloat(req.body.diagnostic_rate) || 0,
    fleet_rate: parseFloat(req.body.fleet_rate) || 0,
    emergency_rate: parseFloat(req.body.emergency_rate) || 0,
    service_fee: parseFloat(req.body.service_fee) || 0,
    default_pay_method: req.body.default_pay_method || 'Cash',
    tax_rate: parseFloat(req.body.tax_rate) || 0,
    oil_warn_miles: parseInt(req.body.oil_warn_miles) || 1500,
    currency_symbol: req.body.currency_symbol || '$',
    tax_id: req.body.tax_id || '',
    invoice_terms: req.body.invoice_terms || 'Due on receipt',
    invoice_footer: req.body.invoice_footer || 'Thank you for your business!',
    invoice_logo: req.body.invoice_logo !== undefined ? req.body.invoice_logo : '',
    warranty_terms: req.body.warranty_terms || '12 months / 12,000 miles',
    estimate_terms: req.body.estimate_terms || '',
    parts_markup_tiers: partsMarkupTiers,
  };

  if (!shopId) {
    db.prepare(`
      UPDATE settings SET
        business_name=?, owner_name=?, phone=?, email=?, address=?, service_area=?, website=?, business_hours=?,
        default_labor_rate=?, diagnostic_rate=?, fleet_rate=?, emergency_rate=?, service_fee=?,
        default_pay_method=?, tax_rate=?, oil_warn_miles=?, currency_symbol=?,
        tax_id=?, invoice_terms=?, invoice_footer=?, invoice_logo=?,
        warranty_terms=?, estimate_terms=?, parts_markup_tiers=?
      WHERE id = 1
    `).run(...SETTINGS_FIELDS.map(field => values[field]));
    return res.json({ ok: true });
  }

  db.prepare(`
    INSERT INTO shop_settings (${['shop_id', ...SETTINGS_FIELDS].join(', ')})
    VALUES (${['?', ...SETTINGS_FIELDS.map(() => '?')].join(', ')})
    ON CONFLICT(shop_id) DO UPDATE SET
      ${SETTINGS_FIELDS.map(field => `${field}=excluded.${field}`).join(', ')},
      updated_at=datetime('now')
  `).run(shopId, ...SETTINGS_FIELDS.map(field => values[field]));
  res.json({ ok: true, shop_id: shopId });
});

module.exports = router;
