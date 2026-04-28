const express = require('express');
const router = express.Router();
const db = require('../database');

// ── Interactions ──────────────────────────────────────────────────────────────

router.get('/interactions', (req, res) => {
  const { customer_id } = req.query;
  const rows = customer_id
    ? db.prepare(`
        SELECT i.*, e.first AS emp_first, e.last AS emp_last
        FROM customer_interactions i
        LEFT JOIN employees e ON i.employee_id = e.id
        WHERE i.customer_id = ?
        ORDER BY i.created_at DESC
      `).all(customer_id)
    : db.prepare(`
        SELECT i.*, e.first AS emp_first, e.last AS emp_last
        FROM customer_interactions i
        LEFT JOIN employees e ON i.employee_id = e.id
        ORDER BY i.created_at DESC
      `).all();
  res.json(rows);
});

router.post('/interactions', (req, res) => {
  const { customer_id, type, summary, employee_id, created_at } = req.body;
  const result = db.prepare(
    `INSERT INTO customer_interactions (customer_id, type, summary, employee_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    customer_id,
    type || 'Note',
    summary || '',
    employee_id || null,
    created_at || new Date().toISOString().split('T')[0]
  );
  res.json({ id: result.lastInsertRowid });
});

router.delete('/interactions/:id', (req, res) => {
  db.prepare('DELETE FROM customer_interactions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Follow-ups ────────────────────────────────────────────────────────────────

router.get('/followups', (req, res) => {
  const { customer_id } = req.query;
  const rows = customer_id
    ? db.prepare('SELECT * FROM follow_ups WHERE customer_id = ? ORDER BY due_date ASC').all(customer_id)
    : db.prepare('SELECT * FROM follow_ups ORDER BY due_date ASC').all();
  res.json(rows);
});

router.post('/followups', (req, res) => {
  const { customer_id, due_date, note } = req.body;
  const result = db.prepare(
    `INSERT INTO follow_ups (customer_id, due_date, note) VALUES (?, ?, ?)`
  ).run(customer_id, due_date, note || '');
  res.json({ id: result.lastInsertRowid });
});

router.put('/followups/:id', (req, res) => {
  const { due_date, note, status, completed_at } = req.body;
  db.prepare(
    `UPDATE follow_ups SET due_date=?, note=?, status=?, completed_at=? WHERE id=?`
  ).run(due_date, note || '', status || 'pending', completed_at || null, req.params.id);
  res.json({ success: true });
});

router.delete('/followups/:id', (req, res) => {
  db.prepare('DELETE FROM follow_ups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Service Reminders ─────────────────────────────────────────────────────────

router.get('/service-reminders', (req, res) => {
  const { customer_id } = req.query;
  const rows = customer_id
    ? db.prepare(`
        SELECT sr.*, v.year, v.make, v.model
        FROM service_reminders sr
        LEFT JOIN vehicles v ON sr.vehicle_id = v.id
        WHERE sr.customer_id = ?
        ORDER BY sr.reminder_date ASC
      `).all(customer_id)
    : db.prepare(`
        SELECT sr.*, v.year, v.make, v.model
        FROM service_reminders sr
        LEFT JOIN vehicles v ON sr.vehicle_id = v.id
        ORDER BY sr.reminder_date ASC
      `).all();
  res.json(rows);
});

router.post('/service-reminders', (req, res) => {
  const { customer_id, vehicle_id, service_type, reminder_date, note } = req.body;
  const result = db.prepare(
    `INSERT INTO service_reminders (customer_id, vehicle_id, service_type, reminder_date, note)
     VALUES (?, ?, ?, ?, ?)`
  ).run(customer_id, vehicle_id || null, service_type || '', reminder_date, note || '');
  res.json({ id: result.lastInsertRowid });
});

router.put('/service-reminders/:id', (req, res) => {
  const { vehicle_id, service_type, reminder_date, note, status } = req.body;
  db.prepare(
    `UPDATE service_reminders SET vehicle_id=?, service_type=?, reminder_date=?, note=?, status=? WHERE id=?`
  ).run(vehicle_id || null, service_type || '', reminder_date, note || '', status || 'pending', req.params.id);
  res.json({ success: true });
});

router.delete('/service-reminders/:id', (req, res) => {
  db.prepare('DELETE FROM service_reminders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
