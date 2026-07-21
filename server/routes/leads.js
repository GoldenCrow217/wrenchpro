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

  const convertLead = db.transaction(() => {
    const custResult = db.prepare(`INSERT INTO customers (shop_id, first, last, phone, email, notes, status) VALUES (?, ?, ?, ?, ?, ?, 'Active')`)
      .run(tenant.shopId, lead.first, lead.last || '', lead.phone || '', lead.email || '', lead.service_needed || '');
    const custId = custResult.lastInsertRowid;
    if (lead.vehicle_make || lead.vehicle_model) {
      db.prepare('INSERT INTO vehicles (customer_id, year, make, model, vin) VALUES (?, ?, ?, ?, ?)')
        .run(custId, lead.vehicle_year || 0, lead.vehicle_make || '', lead.vehicle_model || '', lead.vin || '');
    }
    db.prepare(`UPDATE leads SET status='Won', converted_customer_id=? WHERE id=? AND ${tenant.clause}`)
      .run(custId, lead.id, ...tenant.values);
    return custId;
  });

  res.json({ customer_id: convertLead() });
});

module.exports = router;
