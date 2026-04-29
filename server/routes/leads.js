const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all());
});

router.post('/', (req, res) => {
  const { first, last, phone, email, source, vehicle_year, vehicle_make, vehicle_model, service_needed, status, notes, follow_up_date, estimated_value } = req.body;
  const result = db.prepare(`
    INSERT INTO leads (first, last, phone, email, source, vehicle_year, vehicle_make, vehicle_model, service_needed, status, notes, follow_up_date, estimated_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first, last || '', phone || '', email || '', source || '', vehicle_year || null, vehicle_make || '', vehicle_model || '', service_needed || '', status || 'New', notes || '', follow_up_date || null, estimated_value || 0);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/:id', (req, res) => {
  const { first, last, phone, email, source, vehicle_year, vehicle_make, vehicle_model, service_needed, status, notes, follow_up_date, estimated_value } = req.body;
  db.prepare(`
    UPDATE leads SET first=?, last=?, phone=?, email=?, source=?, vehicle_year=?, vehicle_make=?, vehicle_model=?, service_needed=?, status=?, notes=?, follow_up_date=?, estimated_value=?
    WHERE id=?
  `).run(first, last || '', phone || '', email || '', source || '', vehicle_year || null, vehicle_make || '', vehicle_model || '', service_needed || '', status || 'New', notes || '', follow_up_date || null, estimated_value || 0, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/convert', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  const custResult = db.prepare(`INSERT INTO customers (first, last, phone, email, notes, status) VALUES (?, ?, ?, ?, ?, 'Active')`)
    .run(lead.first, lead.last || '', lead.phone || '', lead.email || '', lead.service_needed || '');
  const custId = custResult.lastInsertRowid;
  if (lead.vehicle_make || lead.vehicle_model) {
    db.prepare('INSERT INTO vehicles (customer_id, year, make, model) VALUES (?, ?, ?, ?)')
      .run(custId, lead.vehicle_year || 0, lead.vehicle_make || '', lead.vehicle_model || '');
  }
  db.prepare("UPDATE leads SET status='Won', converted_customer_id=? WHERE id=?").run(custId, lead.id);
  res.json({ customer_id: custId });
});

module.exports = router;
