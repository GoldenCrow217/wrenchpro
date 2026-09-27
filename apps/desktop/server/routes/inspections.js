const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, shopTenantWhere, resolveShopId } = require('../tenant');
const { fail, positiveId, isoDate, nonNegativeNumber } = require('../validation');

const INSPECTION_CONDITIONS = new Set(['pass', 'advisory', 'fail', 'na']);
const MEASUREMENT_UNITS = new Set(['', 'mm', '32nds', 'psi', 'volts', 'percent']);
const INPUT_TYPES = new Set(['condition', 'measurement', 'text', 'checkbox']);
const RECOMMENDATION_STATUSES = new Set(['', 'recommended', 'estimate-requested', 'deferred', 'completed']);

function validateInspectionItems(res, items) {
  for (const item of items || []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return fail(res, 'items', 'Each inspection item must be an object');
    for (const [field, label, limit] of [['category', 'Inspection category', 80], ['item_name', 'Inspection item name', 120], ['notes', 'Inspection item notes', 1000], ['measurement_unit', 'Measurement unit', 20], ['position_label', 'Inspection position', 20], ['recommendation', 'Recommendation', 500]]) {
      if (item[field] === undefined || item[field] === null) continue;
      if (typeof item[field] !== 'string') return fail(res, field, `${label} must be text`);
      item[field] = item[field].trim();
      if (item[field].length > limit) return fail(res, field, `${label} must be ${limit} characters or fewer`);
    }
    if (item.condition !== undefined && !INSPECTION_CONDITIONS.has(item.condition)) return fail(res, 'condition', 'Inspection condition is not supported');
    if (!MEASUREMENT_UNITS.has(item.measurement_unit || '')) return fail(res, 'measurement_unit', 'Measurement unit is not supported');
    if (item.input_type !== undefined && !INPUT_TYPES.has(item.input_type)) return fail(res, 'input_type', 'Inspection input type is not supported');
    if (item.recommendation_status !== undefined && !RECOMMENDATION_STATUSES.has(item.recommendation_status)) return fail(res, 'recommendation_status', 'Recommendation status is not supported');
    if (!nonNegativeNumber(res, item, 'measurement_value', { label: 'Inspection measurement' })) return false;
    if (item.measurement_value === '') item.measurement_value = null;
  }
  return true;
}

function validateInspection(res, body, create) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(res, null, 'Inspection details must be an object');
  if (create && !positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  for (const field of ['vehicle_id','job_id','employee_id','template_id']) if (!positiveId(res, body[field], field)) return false;
  if (create && !isoDate(res, body, 'date', { required: true, label: 'Inspection date' })) return false;
  if (body.items !== undefined && !Array.isArray(body.items)) return fail(res, 'items', 'Items must be an array');
  return validateInspectionItems(res, body.items);
}

function employeeInTenant(req, employeeId) {
  if (!employeeId) return true;
  const tenant = shopTenantWhere(req);
  return Boolean(db.prepare(`SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL AND ${tenant.clause}`).get(employeeId, ...tenant.values));
}

function syncInspectionRecommendations(req, inspectionId, customerId, vehicleId) {
  const items = db.prepare(`SELECT * FROM inspection_items WHERE inspection_id=?`).all(inspectionId);
  for (const item of items) {
    const shouldTrack = ['recommended','deferred'].includes(item.recommendation_status) && String(item.recommendation || '').trim();
    const existing = db.prepare(`SELECT id FROM deferred_services WHERE source_type='inspection_item' AND source_item_id=? AND status='open'`).get(item.id);
    if (shouldTrack && !existing) {
      db.prepare(`INSERT INTO deferred_services (shop_id,customer_id,vehicle_id,source_type,source_id,source_item_id,description,qty,rate,amount,status,deferred_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(resolveShopId(req),customerId,vehicleId||null,'inspection_item',inspectionId,item.id,String(item.recommendation).trim(),1,0,0,'open',item.recommendation_status==='deferred'?'Customer deferred during inspection':'Inspection recommendation');
    } else if (!shouldTrack && existing) {
      db.prepare(`UPDATE deferred_services SET status='dismissed',resolved_at=datetime('now') WHERE id=?`).run(existing.id);
    } else if (shouldTrack && existing) {
      db.prepare(`UPDATE deferred_services SET description=?,deferred_reason=? WHERE id=?`).run(String(item.recommendation).trim(),item.recommendation_status==='deferred'?'Customer deferred during inspection':'Inspection recommendation',existing.id);
    }
  }
}

function savedInspection(id) {
  const row = db.prepare(`SELECT i.*,c.first,c.last,v.year,v.make,v.model,e.first AS emp_first,e.last AS emp_last FROM inspections i JOIN customers c ON c.id=i.customer_id LEFT JOIN vehicles v ON v.id=i.vehicle_id LEFT JOIN employees e ON e.id=i.employee_id WHERE i.id=?`).get(id);
  if (!row) return null;
  row.items = db.prepare('SELECT * FROM inspection_items WHERE inspection_id=? ORDER BY id').all(id);
  const photos = db.prepare('SELECT * FROM inspection_photos WHERE inspection_item_id=? ORDER BY id');
  row.items.forEach(item => { item.photos = photos.all(item.id); });
  return row;
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const rows = db.prepare(`
    SELECT i.*, c.first, c.last, v.year, v.make, v.model,
           e.first AS emp_first, e.last AS emp_last
    FROM inspections i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN vehicles v ON i.vehicle_id = v.id
    LEFT JOIN employees e ON i.employee_id = e.id
    WHERE ${tenant.clause}
    ORDER BY i.date DESC
  `).all(...tenant.values);
  rows.forEach(r => {
    r.items = db.prepare('SELECT * FROM inspection_items WHERE inspection_id = ? ORDER BY id').all(r.id);
    const photos = db.prepare('SELECT * FROM inspection_photos WHERE inspection_item_id = ? ORDER BY id');
    r.items.forEach(item => { item.photos = photos.all(item.id); });
  });
  res.json(rows);
});

router.post('/', (req, res) => {
  if (!validateInspection(res, req.body, true)) return;
  const { job_id, customer_id, vehicle_id, employee_id, template_id, date, notes, status } = req.body;
  let { items } = req.body;

  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);

  if (vehicle_id) {
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(vehicle_id, customer_id);
    if (!vehicle) return fail(res, 'vehicle_id', 'Vehicle not found or does not belong to this customer', 404);
  }

  if (job_id) {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(job_id, customer_id);
    if (!job) return fail(res, 'job_id', 'Job not found or does not belong to this customer', 404);
  }

  if (!employeeInTenant(req, employee_id)) return fail(res, 'employee_id', 'Employee not found', 404);
  if (template_id) {
    const shopTenant = shopTenantWhere(req, 't');
    const template = db.prepare(`SELECT t.id FROM inspection_templates t WHERE t.id=? AND t.active=1 AND ${shopTenant.clause}`).get(template_id, ...shopTenant.values);
    if (!template) return fail(res, 'template_id', 'Inspection template not found', 404);
    if (!items || !items.length) {
      items = db.prepare(`SELECT category,item_name,input_type,measurement_unit,position_label FROM inspection_template_items WHERE template_id=? ORDER BY sort_order,id`).all(template_id);
    }
  }

  const id = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO inspections (job_id, customer_id, vehicle_id, employee_id, template_id, date, notes, status, completed_at, completed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(job_id || null, customer_id, vehicle_id || null, employee_id || null, template_id || null, date, notes || '', status || 'Draft', status === 'Complete' ? new Date().toISOString() : null, status === 'Complete' ? (employee_id || null) : null);
    const inspectionId = result.lastInsertRowid;
    if (items && items.length) {
      const ins = db.prepare('INSERT INTO inspection_items (inspection_id, category, item_name, condition, measurement_value, measurement_unit, notes, position_label, input_type, recommendation, recommendation_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      items.forEach(it => ins.run(inspectionId, it.category || '', it.item_name || '', it.condition || 'pass', it.measurement_value ?? null, it.measurement_unit || '', it.notes || '', it.position_label || '', it.input_type || (it.measurement_unit ? 'measurement' : 'condition'), it.recommendation || '', it.recommendation_status || ''));
    }
    syncInspectionRecommendations(req, inspectionId, customer_id, vehicle_id);
    return inspectionId;
  })();
  res.json(savedInspection(id));
});

router.put('/:id', (req, res) => {
  if (!validateInspection(res, req.body, false)) return;
  const { customer_id, vehicle_id, job_id, employee_id, template_id, date, notes, status, items } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`SELECT i.* FROM inspections i JOIN customers c ON c.id=i.customer_id WHERE i.id=? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Inspection not found' });
  const customerId = customer_id || current.customer_id;
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id=? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(customerId, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);
  if (vehicle_id && !db.prepare('SELECT id FROM vehicles WHERE id=? AND customer_id=? AND deleted_at IS NULL').get(vehicle_id,customerId)) return fail(res,'vehicle_id','Vehicle not found or does not belong to this customer',404);
  if (job_id && !db.prepare('SELECT id FROM jobs WHERE id=? AND customer_id=? AND deleted_at IS NULL').get(job_id,customerId)) return fail(res,'job_id','Job not found or does not belong to this customer',404);
  if (!employeeInTenant(req,employee_id)) return fail(res,'employee_id','Employee not found',404);
  if (template_id) {
    const shopTenant=shopTenantWhere(req,'t');
    if (!db.prepare(`SELECT t.id FROM inspection_templates t WHERE t.id=? AND t.active=1 AND ${shopTenant.clause}`).get(template_id,...shopTenant.values)) return fail(res,'template_id','Inspection template not found',404);
  }
  const changes = db.transaction(() => {
    const result = db.prepare(`
      UPDATE inspections SET customer_id=?,vehicle_id=?,job_id=?,employee_id=?,template_id=?,date=?,notes=?,status=? WHERE id=?
    `).run(customerId,vehicle_id||null,job_id||null,employee_id||null,template_id||null,date||current.date,notes||'',status||'Draft',req.params.id);
    if (!result.changes) return 0;
    if (items !== undefined) {
      const existingIds = new Set(db.prepare('SELECT id FROM inspection_items WHERE inspection_id=?').all(req.params.id).map(row => row.id));
      const keptIds = new Set();
      const insert = db.prepare('INSERT INTO inspection_items (inspection_id, category, item_name, condition, measurement_value, measurement_unit, notes, position_label, input_type, recommendation, recommendation_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE inspection_items SET category=?,item_name=?,condition=?,measurement_value=?,measurement_unit=?,notes=?,position_label=?,input_type=?,recommendation=?,recommendation_status=? WHERE id=? AND inspection_id=?');
      (items || []).forEach(it => {
        const values = [it.category || '', it.item_name || '', it.condition || 'pass', it.measurement_value ?? null, it.measurement_unit || '', it.notes || '', it.position_label || '', it.input_type || (it.measurement_unit ? 'measurement' : 'condition'), it.recommendation || '', it.recommendation_status || ''];
        if (it.id && existingIds.has(Number(it.id))) {
          update.run(...values, Number(it.id), req.params.id);
          keptIds.add(Number(it.id));
        } else {
          keptIds.add(Number(insert.run(req.params.id, ...values).lastInsertRowid));
        }
      });
      for (const itemId of existingIds) if (!keptIds.has(itemId)) {
        db.prepare(`UPDATE deferred_services SET status='dismissed',resolved_at=datetime('now') WHERE source_type='inspection_item' AND source_item_id=? AND status='open'`).run(itemId);
        db.prepare('DELETE FROM inspection_photos WHERE inspection_item_id=?').run(itemId);
        db.prepare('DELETE FROM inspection_items WHERE id=?').run(itemId);
      }
    }
    db.prepare(`UPDATE inspections SET completed_at=CASE WHEN ?='Complete' THEN COALESCE(completed_at,datetime('now')) ELSE NULL END, completed_by=CASE WHEN ?='Complete' THEN COALESCE(completed_by,employee_id) ELSE NULL END WHERE id=?`).run(status || 'Draft', status || 'Draft', req.params.id);
    const inspection = db.prepare('SELECT customer_id,vehicle_id FROM inspections WHERE id=?').get(req.params.id);
    syncInspectionRecommendations(req, Number(req.params.id), inspection.customer_id, inspection.vehicle_id);
    return result.changes;
  })();
  if (!changes) return res.status(404).json({ error: 'Inspection not found' });
  res.json(savedInspection(Number(req.params.id)));
});

router.post('/:id/items/:itemId/photos', (req, res) => {
  if (!positiveId(res, req.params.id, 'id') || !positiveId(res, req.params.itemId, 'item_id')) return;
  const tenant = customerTenantWhere(req, 'c');
  const item = db.prepare(`
    SELECT ii.id FROM inspection_items ii
    JOIN inspections i ON i.id=ii.inspection_id
    JOIN customers c ON c.id=i.customer_id
    WHERE i.id=? AND ii.id=? AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, req.params.itemId, ...tenant.values);
  if (!item) return res.status(404).json({ error: 'Inspection item not found' });
  const dataUrl = String(req.body.data_url || '');
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return fail(res, 'data_url', 'Choose a JPEG, PNG, or WebP image');
  if (Buffer.byteLength(dataUrl, 'utf8') > 750000) return fail(res, 'data_url', 'Inspection photo must be smaller than 750 KB');
  const id = db.prepare('INSERT INTO inspection_photos (inspection_item_id,file_path,caption) VALUES (?,?,?)').run(item.id, dataUrl, String(req.body.caption || '').slice(0,200)).lastInsertRowid;
  res.json(db.prepare('SELECT * FROM inspection_photos WHERE id=?').get(id));
});

router.delete('/:id/items/:itemId/photos/:photoId', (req, res) => {
  if (![req.params.id,req.params.itemId,req.params.photoId].every(value => Number.isSafeInteger(Number(value)) && Number(value)>0)) return fail(res, 'id', 'Photo identifier is invalid');
  const tenant = customerTenantWhere(req, 'c');
  const result = db.prepare(`DELETE FROM inspection_photos WHERE id=? AND inspection_item_id=? AND EXISTS (
    SELECT 1 FROM inspection_items ii JOIN inspections i ON i.id=ii.inspection_id JOIN customers c ON c.id=i.customer_id
    WHERE ii.id=? AND i.id=? AND c.deleted_at IS NULL AND ${tenant.clause}
  )`).run(req.params.photoId,req.params.itemId,req.params.itemId,req.params.id,...tenant.values);
  if (!result.changes) return res.status(404).json({ error:'Inspection photo not found' });
  res.json({ success:true });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const current = db.prepare(`
    SELECT i.id FROM inspections i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(req.params.id, ...tenant.values);
  if (!current) return res.status(404).json({ error: 'Inspection not found' });
  db.transaction(() => {
    db.prepare('DELETE FROM inspection_photos WHERE inspection_item_id IN (SELECT id FROM inspection_items WHERE inspection_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM inspection_items WHERE inspection_id = ?').run(req.params.id);
    db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

module.exports = router;
