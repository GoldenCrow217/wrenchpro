const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId } = require('../tenant');

function leadTenantWhere(req) {
  const shopId = resolveShopId(req);
  if (!shopId) return { shopId: null, clause: 'shop_id IS NULL', values: [] };
  return { shopId, clause: 'shop_id = ?', values: [shopId] };
}

router.get('/', (req, res) => {
  const tenant = leadTenantWhere(req);
  res.json(db.prepare(`SELECT * FROM leads WHERE ${tenant.clause} ORDER BY created_at DESC`).all(...tenant.values));
});

router.post('/', (req, res) => {
  const { first, last, phone, email, source, vehicle_year, vehicle_make, vehicle_model, vin, service_needed, status, notes, follow_up_date, estimated_value } = req.body;
  const shopId = resolveShopId(req);
  const result = db.prepare(`
    INSERT INTO leads (shop_id, first, last, phone, email, source, vehicle_year, vehicle_make, vehicle_model, vin, service_needed, status, notes, follow_up_date, estimated_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(shopId, first, last || '', phone || '', email || '', source || '', vehicle_year || null, vehicle_make || '', vehicle_model || '', vin || '', service_needed || '', status || 'New', notes || '', follow_up_date || null, estimated_value || 0);
  res.json({ id: result.lastInsertRowid, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  const { first, last, phone, email, source, vehicle_year, vehicle_make, vehicle_model, vin, service_needed, status, notes, follow_up_date, estimated_value } = req.body;
  const tenant = leadTenantWhere(req);
  const result = db.prepare(`
    UPDATE leads SET first=?, last=?, phone=?, email=?, source=?, vehicle_year=?, vehicle_make=?, vehicle_model=?, vin=?, service_needed=?, status=?, notes=?, follow_up_date=?, estimated_value=?
    WHERE id=? AND ${tenant.clause}
  `).run(first, last || '', phone || '', email || '', source || '', vehicle_year || null, vehicle_make || '', vehicle_model || '', vin || '', service_needed || '', status || 'New', notes || '', follow_up_date || null, estimated_value || 0, req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = leadTenantWhere(req);
  const result = db.prepare(`DELETE FROM leads WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

router.post('/:id/convert', (req, res) => {
  const tenant = leadTenantWhere(req);
  const lead = db.prepare(`SELECT * FROM leads WHERE id = ? AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!lead.first || !lead.first.trim()) return res.status(400).json({ error: 'Lead first name is required before conversion' });
  if (lead.converted_customer_id) {
    const existing = db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').get(lead.converted_customer_id);
    if (existing) return res.json({ customer_id: existing.id, customer: existing, lead, already_converted: true });
    return res.status(409).json({ error: 'This lead was already converted, but its customer record is unavailable' });
  }

  const convertLead = db.transaction(() => {
    const current = db.prepare(`SELECT converted_customer_id FROM leads WHERE id = ? AND ${tenant.clause}`)
      .get(lead.id, ...tenant.values);
    if (current?.converted_customer_id) return { customerId: current.converted_customer_id, alreadyConverted: true };

    const custResult = db.prepare(`INSERT INTO customers (shop_id, first, last, phone, email, notes, status) VALUES (?, ?, ?, ?, ?, ?, 'Active')`)
      .run(tenant.shopId, lead.first, lead.last || '', lead.phone || '', lead.email || '', lead.service_needed || '');
    const custId = custResult.lastInsertRowid;
    if (lead.vehicle_make || lead.vehicle_model) {
      db.prepare('INSERT INTO vehicles (customer_id, year, make, model, vin) VALUES (?, ?, ?, ?, ?)')
        .run(custId, lead.vehicle_year || 0, lead.vehicle_make || '', lead.vehicle_model || '', lead.vin || '');
    }
    const updated = db.prepare(`UPDATE leads SET status='Won', converted_customer_id=? WHERE id=? AND ${tenant.clause}`)
      .run(custId, lead.id, ...tenant.values);
    if (!updated.changes) throw new Error('Customer was not created because the lead conversion could not be completed');
    return { customerId: custId, alreadyConverted: false };
  });

  const converted = convertLead();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').get(converted.customerId);
  const convertedLead = db.prepare(`SELECT * FROM leads WHERE id = ? AND ${tenant.clause}`).get(lead.id, ...tenant.values);
  if (!customer) return res.status(500).json({ error: 'Lead conversion completed without a valid customer record' });
  res.json({ customer_id: customer.id, customer, lead: convertedLead, already_converted: converted.alreadyConverted });
});

module.exports = router;
