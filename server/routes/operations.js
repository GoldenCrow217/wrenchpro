const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere, customerTenantWhere } = require('../tenant');
const { fail, positiveId, requiredText, nonNegativeNumber } = require('../validation');

const WORKFLOW_COLORS = new Set(['#64748B','#D97706','#2563EB','#7C3AED','#EA580C','#0891B2','#4F46E5','#16A34A','#475569','#DC2626','#0F766E']);
const RESOURCE_TYPES = new Set(['bay', 'mobile', 'inspection', 'alignment', 'other']);
const AUTH_STATUSES = new Set(['pending', 'approved', 'declined', 'deferred']);
const PO_STATUSES = new Set(['Draft', 'Ordered', 'Received', 'Fulfilled', 'Canceled']);
const TASK_STATUSES = new Set(['Not Started', 'In Progress', 'Blocked', 'Complete']);
const EVENT_TYPES = new Set(['check-in', 'check-out', 'quality-control']);
const INSPECTION_INPUT_TYPES = new Set(['condition','measurement','text','checkbox']);
const INSPECTION_UNITS = new Set(['','mm','32nds','psi','volts','percent']);

function rowsWithChildren(rows, table, foreignKey, orderBy = 'id') {
  const stmt = db.prepare(`SELECT * FROM ${table} WHERE ${foreignKey}=? ORDER BY ${orderBy}`);
  rows.forEach(row => {
    row.items = stmt.all(row.id);
    row.items.forEach(item => {
      if (!Object.prototype.hasOwnProperty.call(item, 'quick_notes')) return;
      try { item.quick_notes = JSON.parse(item.quick_notes || '[]'); } catch (_) { item.quick_notes = []; }
    });
  });
  return rows;
}

function tenantRecord(req, table, id, alias = '') {
  const tenant = shopTenantWhere(req, alias);
  const prefix = alias ? `${alias}.` : '';
  return db.prepare(`SELECT ${alias ? `${alias}.*` : '*'} FROM ${table} ${alias} WHERE ${prefix}id=? AND ${tenant.clause}`).get(id, ...tenant.values);
}

function tenantJob(req, id) {
  const tenant = customerTenantWhere(req, 'c');
  return db.prepare(`
    SELECT j.* FROM jobs j JOIN customers c ON c.id=j.customer_id
    WHERE j.id=? AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(id, ...tenant.values);
}

function tenantEstimate(req, id) {
  const tenant = customerTenantWhere(req, 'c');
  return db.prepare(`
    SELECT e.* FROM estimates e JOIN customers c ON c.id=e.customer_id
    WHERE e.id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
  `).get(id, ...tenant.values);
}

function tenantEmployee(req, id) {
  if (!id) return null;
  const tenant = shopTenantWhere(req);
  return db.prepare(`SELECT * FROM employees WHERE id=? AND deleted_at IS NULL AND ${tenant.clause}`).get(id,...tenant.values);
}

function tenantInventory(req, id) {
  if (!id) return null;
  const tenant = shopTenantWhere(req);
  return db.prepare(`SELECT * FROM parts_inventory WHERE id=? AND ${tenant.clause}`).get(id,...tenant.values);
}

function validateTemplateItems(res, items) {
  if (!Array.isArray(items) || !items.length) return fail(res,'items','Add at least one inspection item');
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !String(item.item_name||'').trim()) return fail(res,'items','Every inspection item needs a name');
    if (!INSPECTION_INPUT_TYPES.has(item.input_type||'condition')) return fail(res,'input_type','Inspection input type is not supported');
    if (!INSPECTION_UNITS.has(item.measurement_unit||'')) return fail(res,'measurement_unit','Inspection measurement unit is not supported');
    if (item.quick_notes !== undefined && (!Array.isArray(item.quick_notes) || item.quick_notes.some(note=>typeof note!=='string'||note.length>200))) return fail(res,'quick_notes','Quick notes must be a list of short text entries');
  }
  return true;
}

function ensureDefaultColumns(req) {
  const shopId = resolveShopId(req);
  const tenant = shopTenantWhere(req);
  if (db.prepare(`SELECT 1 FROM workflow_columns WHERE ${tenant.clause} LIMIT 1`).get(...tenant.values)) return;
  const insert = db.prepare(`INSERT INTO workflow_columns (shop_id,name,position,color,is_closed) VALUES (?,?,?,?,?)`);
  [
    ['Estimate',10,'#64748B',0],['Awaiting Approval',20,'#D97706',0],['Scheduled',30,'#2563EB',0],
    ['Checked In',40,'#7C3AED',0],['Waiting for Parts',50,'#EA580C',0],['In Progress',60,'#0891B2',0],
    ['Quality Check',70,'#4F46E5',0],['Ready for Pickup',80,'#16A34A',0],['Closed',90,'#475569',1],
  ].forEach(row => insert.run(shopId, ...row));
}

function ensureDefaultInspectionTemplate(req) {
  const tenant = shopTenantWhere(req);
  if (db.prepare(`SELECT 1 FROM inspection_templates WHERE ${tenant.clause} LIMIT 1`).get(...tenant.values)) return;
  const shopId = resolveShopId(req);
  const create = db.transaction(() => {
    const templateId = db.prepare(`INSERT INTO inspection_templates (shop_id,name,description) VALUES (?,?,?)`)
      .run(shopId, 'Multi-Point Vehicle Inspection', 'Brakes, tires, fluids, battery, safety systems, and recommended maintenance').lastInsertRowid;
    const insert = db.prepare(`INSERT INTO inspection_template_items
      (template_id,category,item_name,input_type,measurement_unit,position_label,quick_notes,sort_order)
      VALUES (?,?,?,?,?,?,?,?)`);
    const items = [
      ['Recommended Maintenance','Accessory drive belt(s)','condition','','','[]'],
      ['Recommended Maintenance','Cabin air filter','condition','','','[]'],
      ['Recommended Maintenance','Engine air filter','condition','','','[]'],
      ['Recommended Maintenance','Engine coolant','condition','','','[]'],
      ['Recommended Maintenance','Oil and filter','condition','','','[]'],
      ['Fluids','Engine oil level','condition','','','["Full","Low","Leak observed"]'],
      ['Fluids','Brake fluid level','condition','','','["Full","Low","Contaminated"]'],
      ['Fluids','Coolant level','condition','','','["Full","Low","Leak observed"]'],
      ['Battery','Battery state of health','measurement','percent','','[]'],
      ['Battery','Battery voltage','measurement','volts','','[]'],
      ['Brakes','Brake pad thickness','measurement','mm','LF','[]'],
      ['Brakes','Brake pad thickness','measurement','mm','RF','[]'],
      ['Brakes','Brake pad thickness','measurement','mm','LR','[]'],
      ['Brakes','Brake pad thickness','measurement','mm','RR','[]'],
      ['Brakes','Rotor thickness','measurement','mm','LF','[]'],
      ['Brakes','Rotor thickness','measurement','mm','RF','[]'],
      ['Brakes','Rotor thickness','measurement','mm','LR','[]'],
      ['Brakes','Rotor thickness','measurement','mm','RR','[]'],
      ['Tires','Tread depth','measurement','32nds','LF','[]'],
      ['Tires','Tread depth','measurement','32nds','RF','[]'],
      ['Tires','Tread depth','measurement','32nds','LR','[]'],
      ['Tires','Tread depth','measurement','32nds','RR','[]'],
      ['Tires','Tire pressure','measurement','psi','LF','[]'],
      ['Tires','Tire pressure','measurement','psi','RF','[]'],
      ['Tires','Tire pressure','measurement','psi','LR','[]'],
      ['Tires','Tire pressure','measurement','psi','RR','[]'],
      ['Safety & Chassis','Exterior lights, horn, and signals','condition','','','[]'],
      ['Safety & Chassis','Windshield, washer, and wipers','condition','','','[]'],
      ['Safety & Chassis','Steering and suspension','condition','','','[]'],
      ['Safety & Chassis','Leaks and visible damage','condition','','','[]'],
    ];
    items.forEach((item, index) => insert.run(templateId, ...item, index + 1));
  });
  create();
}

router.get('/', (req, res) => {
  ensureDefaultColumns(req);
  ensureDefaultInspectionTemplate(req);
  const shop = shopTenantWhere(req);
  const customer = customerTenantWhere(req, 'c');
  const templates = rowsWithChildren(
    db.prepare(`SELECT * FROM inspection_templates WHERE ${shop.clause} ORDER BY active DESC,name`).all(...shop.values),
    'inspection_template_items', 'template_id', 'sort_order,id'
  );
  const purchaseOrders = rowsWithChildren(
    db.prepare(`SELECT po.*,v.name AS vendor_name,j.repair_order_number FROM purchase_orders po LEFT JOIN vendors v ON v.id=po.vendor_id LEFT JOIN jobs j ON j.id=po.job_id WHERE ${shop.clause.replaceAll('shop_id','po.shop_id')} ORDER BY po.created_at DESC,po.id DESC`).all(...shop.values),
    'purchase_order_items', 'purchase_order_id'
  );
  const jobs = db.prepare(`
    SELECT j.id,j.repair_order_number,j.service,j.status,j.workflow_column_id,j.resource_id,j.promised_at,j.priority,
      j.customer_id,j.vehicle_id,j.employee_id,c.first,c.last,v.year,v.make,v.model,e.first AS employee_first,e.last AS employee_last
    FROM jobs j JOIN customers c ON c.id=j.customer_id LEFT JOIN vehicles v ON v.id=j.vehicle_id
    LEFT JOIN employees e ON e.id=j.employee_id
    WHERE j.deleted_at IS NULL AND c.deleted_at IS NULL AND (v.id IS NULL OR v.deleted_at IS NULL) AND ${customer.clause}
    ORDER BY COALESCE(j.promised_at,j.date),j.id
  `).all(...customer.values);
  res.json({
    workflow_columns: db.prepare(`SELECT * FROM workflow_columns WHERE ${shop.clause} ORDER BY position,id`).all(...shop.values),
    resources: db.prepare(`SELECT * FROM shop_resources WHERE ${shop.clause} ORDER BY active DESC,position,name`).all(...shop.values),
    templates,
    authorizations: db.prepare(`SELECT * FROM service_authorizations WHERE ${shop.clause} ORDER BY created_at DESC,id DESC`).all(...shop.values),
    deferred_services: db.prepare(`SELECT d.*,c.first,c.last,v.year,v.make,v.model FROM deferred_services d JOIN customers c ON c.id=d.customer_id LEFT JOIN vehicles v ON v.id=d.vehicle_id WHERE ${shop.clause.replaceAll('shop_id','d.shop_id')} ORDER BY d.status,d.deferred_at DESC`).all(...shop.values),
    reservations: db.prepare(`SELECT r.*,p.name,p.part_number,p.quantity AS on_hand,j.repair_order_number FROM inventory_reservations r JOIN parts_inventory p ON p.id=r.inventory_id LEFT JOIN jobs j ON j.id=r.job_id WHERE ${shop.clause.replaceAll('shop_id','r.shop_id')} ORDER BY r.created_at DESC`).all(...shop.values),
    vendors: db.prepare(`SELECT * FROM vendors WHERE ${shop.clause} ORDER BY active DESC,name`).all(...shop.values),
    purchase_orders: purchaseOrders,
    tasks: db.prepare(`SELECT t.*,e.first,e.last,ji.type AS item_type,ji.rate,ji.qty FROM job_tasks t JOIN jobs j ON j.id=t.job_id JOIN customers c ON c.id=j.customer_id LEFT JOIN employees e ON e.id=t.employee_id LEFT JOIN job_items ji ON ji.id=t.job_item_id WHERE j.deleted_at IS NULL AND c.deleted_at IS NULL AND ${customer.clause} ORDER BY t.job_id,t.sort_order,t.id`).all(...customer.values),
    service_events: db.prepare(`SELECT se.* FROM vehicle_service_events se WHERE ${shop.clause.replaceAll('shop_id','se.shop_id')} ORDER BY se.created_at DESC,se.id DESC`).all(...shop.values),
    jobs,
  });
});

router.post('/workflow-columns', (req, res) => {
  if (!requiredText(res, req.body, 'name', 'Column name')) return;
  const color = WORKFLOW_COLORS.has(req.body.color) ? req.body.color : '#64748B';
  const shopId = resolveShopId(req);
  const result = db.prepare(`INSERT INTO workflow_columns (shop_id,name,position,color,is_closed) VALUES (?,?,?,?,?)`)
    .run(shopId, String(req.body.name).trim(), Number(req.body.position) || 0, color, req.body.is_closed ? 1 : 0);
  res.json(db.prepare('SELECT * FROM workflow_columns WHERE id=?').get(result.lastInsertRowid));
});

router.put('/workflow-columns/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id') || !requiredText(res, req.body, 'name', 'Column name')) return;
  const tenant = shopTenantWhere(req);
  const color = WORKFLOW_COLORS.has(req.body.color) ? req.body.color : '#64748B';
  const result = db.prepare(`UPDATE workflow_columns SET name=?,position=?,color=?,is_active=?,is_closed=? WHERE id=? AND ${tenant.clause}`)
    .run(String(req.body.name).trim(), Number(req.body.position) || 0, color, req.body.is_active === false ? 0 : 1, req.body.is_closed ? 1 : 0, req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Workflow column not found' });
  res.json(db.prepare('SELECT * FROM workflow_columns WHERE id=?').get(req.params.id));
});

router.delete('/workflow-columns/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  const tenant = shopTenantWhere(req);
  if (db.prepare('SELECT 1 FROM jobs WHERE workflow_column_id=? LIMIT 1').get(req.params.id)) return fail(res, 'id', 'Move jobs out of this workflow column before removing it', 409);
  const result = db.prepare(`DELETE FROM workflow_columns WHERE id=? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Workflow column not found' });
  res.json({ success: true });
});

router.post('/resources', (req, res) => {
  if (!requiredText(res, req.body, 'name', 'Resource name')) return;
  const type = RESOURCE_TYPES.has(req.body.resource_type) ? req.body.resource_type : 'other';
  const result = db.prepare(`INSERT INTO shop_resources (shop_id,name,resource_type,color,position,active,notes) VALUES (?,?,?,?,?,?,?)`)
    .run(resolveShopId(req), String(req.body.name).trim(), type, WORKFLOW_COLORS.has(req.body.color) ? req.body.color : '#6B7280', Number(req.body.position)||0, req.body.active === false ? 0 : 1, req.body.notes || '');
  res.json(db.prepare('SELECT * FROM shop_resources WHERE id=?').get(result.lastInsertRowid));
});

router.put('/resources/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id') || !requiredText(res, req.body, 'name', 'Resource name')) return;
  const tenant = shopTenantWhere(req);
  const type = RESOURCE_TYPES.has(req.body.resource_type) ? req.body.resource_type : 'other';
  const result = db.prepare(`UPDATE shop_resources SET name=?,resource_type=?,color=?,position=?,active=?,notes=? WHERE id=? AND ${tenant.clause}`)
    .run(String(req.body.name).trim(), type, WORKFLOW_COLORS.has(req.body.color) ? req.body.color : '#6B7280', Number(req.body.position)||0, req.body.active === false ? 0 : 1, req.body.notes || '', req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Shop resource not found' });
  res.json(db.prepare('SELECT * FROM shop_resources WHERE id=?').get(req.params.id));
});

router.delete('/resources/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  const tenant = shopTenantWhere(req);
  if (db.prepare('SELECT 1 FROM jobs WHERE resource_id=? LIMIT 1').get(req.params.id) || db.prepare('SELECT 1 FROM appointments WHERE resource_id=? LIMIT 1').get(req.params.id)) {
    return fail(res, 'id', 'This resource has scheduling history. Mark it inactive instead of deleting it.', 409);
  }
  const result = db.prepare(`DELETE FROM shop_resources WHERE id=? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Shop resource not found' });
  res.json({ success: true });
});

router.put('/jobs/:id/workflow', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  const job = tenantJob(req, req.params.id);
  if (!job) return res.status(404).json({ error: 'Repair order not found' });
  const tenant = shopTenantWhere(req);
  if (req.body.workflow_column_id && !db.prepare(`SELECT id FROM workflow_columns WHERE id=? AND is_active=1 AND ${tenant.clause}`).get(req.body.workflow_column_id, ...tenant.values)) return fail(res, 'workflow_column_id', 'Workflow column not found', 404);
  if (req.body.resource_id && !db.prepare(`SELECT id FROM shop_resources WHERE id=? AND active=1 AND ${tenant.clause}`).get(req.body.resource_id, ...tenant.values)) return fail(res, 'resource_id', 'Bay or mobile unit not found', 404);
  const priority = ['Low','Normal','High','Urgent'].includes(req.body.priority) ? req.body.priority : 'Normal';
  db.prepare(`UPDATE jobs SET workflow_column_id=?,resource_id=?,promised_at=?,priority=? WHERE id=?`)
    .run(req.body.workflow_column_id || null, req.body.resource_id || null, req.body.promised_at || null, priority, job.id);
  res.json(db.prepare('SELECT * FROM jobs WHERE id=?').get(job.id));
});

router.post('/inspection-templates', (req, res) => {
  if (!requiredText(res, req.body, 'name', 'Template name')) return;
  if (!validateTemplateItems(res,req.body.items)) return;
  const result = db.transaction(() => {
    const templateId = db.prepare(`INSERT INTO inspection_templates (shop_id,name,description,active) VALUES (?,?,?,?)`)
      .run(resolveShopId(req), String(req.body.name).trim(), req.body.description || '', req.body.active === false ? 0 : 1).lastInsertRowid;
    const insert = db.prepare(`INSERT INTO inspection_template_items (template_id,category,item_name,input_type,measurement_unit,position_label,quick_notes,sort_order) VALUES (?,?,?,?,?,?,?,?)`);
    req.body.items.forEach((item,index) => insert.run(templateId,item.category||'',item.item_name||'Inspection item',item.input_type||'condition',item.measurement_unit||'',item.position_label||'',JSON.stringify(Array.isArray(item.quick_notes)?item.quick_notes:[]),Number(item.sort_order)||index+1));
    return templateId;
  })();
  const template = db.prepare('SELECT * FROM inspection_templates WHERE id=?').get(result);
  template.items = db.prepare('SELECT * FROM inspection_template_items WHERE template_id=? ORDER BY sort_order,id').all(result);
  template.items.forEach(item=>{try{item.quick_notes=JSON.parse(item.quick_notes||'[]');}catch(_){item.quick_notes=[];}});
  res.json(template);
});

router.put('/inspection-templates/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id') || !requiredText(res, req.body, 'name', 'Template name')) return;
  if (req.body.items!==undefined&&!validateTemplateItems(res,req.body.items)) return;
  const tenant = shopTenantWhere(req);
  if (!db.prepare(`SELECT id FROM inspection_templates WHERE id=? AND ${tenant.clause}`).get(req.params.id, ...tenant.values)) return res.status(404).json({ error: 'Inspection template not found' });
  db.transaction(() => {
    db.prepare(`UPDATE inspection_templates SET name=?,description=?,active=?,updated_at=datetime('now') WHERE id=?`).run(String(req.body.name).trim(),req.body.description||'',req.body.active===false?0:1,req.params.id);
    if (Array.isArray(req.body.items)) {
      db.prepare('DELETE FROM inspection_template_items WHERE template_id=?').run(req.params.id);
      const insert=db.prepare(`INSERT INTO inspection_template_items (template_id,category,item_name,input_type,measurement_unit,position_label,quick_notes,sort_order) VALUES (?,?,?,?,?,?,?,?)`);
      req.body.items.forEach((item,index)=>insert.run(req.params.id,item.category||'',item.item_name||'Inspection item',item.input_type||'condition',item.measurement_unit||'',item.position_label||'',JSON.stringify(Array.isArray(item.quick_notes)?item.quick_notes:[]),Number(item.sort_order)||index+1));
    }
  })();
  res.json({ success:true });
});

router.post('/authorizations', (req, res) => {
  const { job_id, estimate_id, item_type, item_id } = req.body;
  if ((!job_id && !estimate_id) || (job_id && estimate_id)) return fail(res, 'job_id', 'Select one repair order or estimate');
  if (!positiveId(res, job_id || estimate_id, job_id ? 'job_id' : 'estimate_id', { required:true })) return;
  if (!positiveId(res, item_id, 'item_id', { required:true })) return;
  if (!['job_item','estimate_item'].includes(item_type)) return fail(res, 'item_type', 'Authorization item type is invalid');
  if (!AUTH_STATUSES.has(req.body.status)) return fail(res, 'status', 'Authorization status is invalid');
  const order = job_id ? tenantJob(req, job_id) : tenantEstimate(req, estimate_id);
  if (!order) return res.status(404).json({ error: job_id ? 'Repair order not found' : 'Estimate not found' });
  const itemTable = item_type === 'job_item' ? 'job_items' : 'estimate_items';
  const ownerColumn = item_type === 'job_item' ? 'job_id' : 'estimate_id';
  const item = db.prepare(`SELECT * FROM ${itemTable} WHERE id=? AND ${ownerColumn}=?`).get(item_id, job_id || estimate_id);
  if (!item) return fail(res, 'item_id', 'Service line item not found', 404);
  if (req.body.employee_id && !tenantEmployee(req,req.body.employee_id)) return fail(res,'employee_id','Employee not found',404);
  for (const [field,limit] of [['customer_name',120],['signature',200],['authorization_method',80],['notes',1000]]) {
    if (req.body[field]!==undefined && (typeof req.body[field]!=='string'||req.body[field].length>limit)) return fail(res,field,`${field.replaceAll('_',' ')} must be text no longer than ${limit} characters`);
  }
  const now = req.body.status === 'pending' ? null : new Date().toISOString().replace('T',' ').split('.')[0];
  const result = db.transaction(() => {
    const authId = db.prepare(`INSERT INTO service_authorizations
      (shop_id,job_id,estimate_id,item_type,item_id,status,authorization_method,customer_name,signature,authorized_price,notes,employee_id,authorized_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(resolveShopId(req),job_id||null,estimate_id||null,item_type,item_id,req.body.status,req.body.authorization_method||'',req.body.customer_name||'',req.body.signature||'',Number(item.amount)||0,req.body.notes||'',req.body.employee_id||null,now).lastInsertRowid;
    if (['declined','deferred'].includes(req.body.status)) {
      const existing = db.prepare(`SELECT id FROM deferred_services WHERE source_type=? AND source_id=? AND source_item_id=? AND status='open'`).get(item_type,job_id||estimate_id,item_id);
      if (!existing) db.prepare(`INSERT INTO deferred_services (shop_id,customer_id,vehicle_id,source_type,source_id,source_item_id,description,qty,rate,amount,status,deferred_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(resolveShopId(req),order.customer_id,order.vehicle_id||null,item_type,job_id||estimate_id,item_id,item.description||'Recommended service',Number(item.qty)||1,Number(item.rate)||0,Number(item.amount)||0,'open',req.body.notes||req.body.status);
    }
    return authId;
  })();
  res.json(db.prepare('SELECT * FROM service_authorizations WHERE id=?').get(result));
});

router.put('/deferred-services/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  const tenant = shopTenantWhere(req);
  const status = ['open','scheduled','completed','dismissed'].includes(req.body.status) ? req.body.status : null;
  if (!status) return fail(res, 'status', 'Deferred-service status is invalid');
  const result = db.prepare(`UPDATE deferred_services SET status=?,resolved_at=CASE WHEN ? IN ('completed','dismissed') THEN datetime('now') ELSE NULL END WHERE id=? AND ${tenant.clause}`)
    .run(status,status,req.params.id,...tenant.values);
  if (!result.changes) return res.status(404).json({ error:'Deferred service not found' });
  res.json({ success:true });
});

router.post('/deferred-services/:id/add-to-estimate', (req, res) => {
  if (!positiveId(res, req.params.id, 'id') || !positiveId(res, req.body.estimate_id, 'estimate_id', {required:true})) return;
  const tenant = shopTenantWhere(req);
  const deferred = db.prepare(`SELECT * FROM deferred_services WHERE id=? AND status='open' AND ${tenant.clause}`).get(req.params.id,...tenant.values);
  const estimate = tenantEstimate(req, req.body.estimate_id);
  if (!deferred) return res.status(404).json({ error:'Deferred service not found' });
  if (!estimate || estimate.customer_id !== deferred.customer_id || (deferred.vehicle_id && estimate.vehicle_id !== deferred.vehicle_id)) return fail(res,'estimate_id','Select an estimate for the same customer and vehicle',409);
  const itemId=db.prepare(`INSERT INTO estimate_items (estimate_id,type,description,qty,rate,amount) VALUES (?,?,?,?,?,?)`).run(estimate.id,'labor',deferred.description,deferred.qty,deferred.rate,deferred.amount).lastInsertRowid;
  db.prepare(`UPDATE deferred_services SET status='scheduled',resolved_at=datetime('now') WHERE id=?`).run(deferred.id);
  res.json({id:itemId,estimate_id:estimate.id});
});

router.post('/reservations', (req, res) => {
  if (!positiveId(res, req.body.inventory_id, 'inventory_id', {required:true})) return;
  if (!nonNegativeNumber(res, req.body, 'quantity', {required:true,label:'Reserved quantity'}) || Number(req.body.quantity)<=0) return fail(res,'quantity','Reserved quantity must be greater than zero');
  if ((!req.body.job_id&&!req.body.estimate_id)||(req.body.job_id&&req.body.estimate_id)) return fail(res,'job_id','Select exactly one repair order or estimate');
  const tenant=shopTenantWhere(req);
  const part=db.prepare(`SELECT * FROM parts_inventory WHERE id=? AND ${tenant.clause}`).get(req.body.inventory_id,...tenant.values);
  if (!part) return res.status(404).json({error:'Inventory item not found'});
  if (req.body.job_id && !tenantJob(req,req.body.job_id)) return res.status(404).json({error:'Repair order not found'});
  if (req.body.estimate_id && !tenantEstimate(req,req.body.estimate_id)) return res.status(404).json({error:'Estimate not found'});
  const reserved=Number(db.prepare(`SELECT COALESCE(SUM(quantity),0) total FROM inventory_reservations WHERE inventory_id=? AND status='reserved'`).get(part.id).total);
  if (reserved+Number(req.body.quantity)>Number(part.quantity)) return res.status(409).json({error:`Only ${Math.max(0,Number(part.quantity)-reserved)} ${part.name} available to reserve`,field:'quantity'});
  const id=db.prepare(`INSERT INTO inventory_reservations (shop_id,inventory_id,job_id,estimate_id,quantity) VALUES (?,?,?,?,?)`).run(resolveShopId(req),part.id,req.body.job_id||null,req.body.estimate_id||null,Number(req.body.quantity)).lastInsertRowid;
  res.json(db.prepare('SELECT * FROM inventory_reservations WHERE id=?').get(id));
});

router.put('/reservations/:id/release', (req,res)=>{
  if(!positiveId(res,req.params.id,'id'))return;
  const tenant=shopTenantWhere(req);
  const result=db.prepare(`UPDATE inventory_reservations SET status='released',released_at=datetime('now') WHERE id=? AND status='reserved' AND ${tenant.clause}`).run(req.params.id,...tenant.values);
  if(!result.changes)return res.status(404).json({error:'Active reservation not found'});
  res.json({success:true});
});

router.post('/vendors',(req,res)=>{
  if(!requiredText(res,req.body,'name','Vendor name'))return;
  const id=db.prepare(`INSERT INTO vendors (shop_id,name,phone,email,account_number,notes) VALUES (?,?,?,?,?,?)`).run(resolveShopId(req),String(req.body.name).trim(),req.body.phone||'',req.body.email||'',req.body.account_number||'',req.body.notes||'').lastInsertRowid;
  res.json(db.prepare('SELECT * FROM vendors WHERE id=?').get(id));
});

function nextPoNumber(req){
  const tenant=shopTenantWhere(req);
  const rows=db.prepare(`SELECT po_number FROM purchase_orders WHERE ${tenant.clause}`).all(...tenant.values);
  const highest=rows.reduce((max,row)=>{const match=String(row.po_number||'').match(/^PO-(\d+)$/i);return match?Math.max(max,Number(match[1])):max;},1000);
  return `PO-${String(highest+1).padStart(4,'0')}`;
}

function validatePo(req,res){
  if(req.body.vendor_id&&!positiveId(res,req.body.vendor_id,'vendor_id'))return false;
  if(req.body.job_id&&!positiveId(res,req.body.job_id,'job_id'))return false;
  if(!PO_STATUSES.has(req.body.status||'Draft'))return fail(res,'status','Purchase-order status is invalid');
  if(!Array.isArray(req.body.items)||!req.body.items.length)return fail(res,'items','Add at least one purchase-order item');
  for(const item of req.body.items){
    if(!String(item?.description||'').trim())return fail(res,'items','Every purchase-order item needs a description');
    for(const field of ['quantity_ordered','quantity_received','unit_cost'])if(!nonNegativeNumber(res,item,field,{required:true,label:field.replaceAll('_',' ')}))return false;
    if(Number(item.quantity_received)>Number(item.quantity_ordered))return fail(res,'quantity_received','Received quantity cannot exceed ordered quantity');
  }
  return true;
}

function validatePoRelationships(req,res){
  const tenant=shopTenantWhere(req);
  if(req.body.vendor_id&&!db.prepare(`SELECT id FROM vendors WHERE id=? AND active=1 AND ${tenant.clause}`).get(req.body.vendor_id,...tenant.values))return fail(res,'vendor_id','Vendor not found',404);
  if(req.body.job_id&&!tenantJob(req,req.body.job_id))return fail(res,'job_id','Repair order not found',404);
  for(const item of req.body.items)if(item.inventory_id&&!tenantInventory(req,item.inventory_id))return fail(res,'inventory_id','Inventory item not found',404);
  return true;
}

router.post('/purchase-orders',(req,res)=>{
  if(!validatePo(req,res)||!validatePoRelationships(req,res))return;
  const poId=db.transaction(()=>{
    const id=db.prepare(`INSERT INTO purchase_orders (shop_id,po_number,vendor_id,job_id,status,vendor_invoice_number,ordered_at,notes) VALUES (?,?,?,?,?,?,?,?)`).run(resolveShopId(req),nextPoNumber(req),req.body.vendor_id||null,req.body.job_id||null,req.body.status||'Draft',req.body.vendor_invoice_number||'',req.body.status==='Ordered'?new Date().toISOString():null,req.body.notes||'').lastInsertRowid;
    const insert=db.prepare(`INSERT INTO purchase_order_items (purchase_order_id,inventory_id,description,part_number,quantity_ordered,quantity_received,unit_cost,add_to_inventory) VALUES (?,?,?,?,?,?,?,?)`);
    req.body.items.forEach(item=>{
      insert.run(id,item.inventory_id||null,String(item.description).trim(),item.part_number||'',Number(item.quantity_ordered),Number(item.quantity_received),Number(item.unit_cost),item.add_to_inventory?1:0);
      if(Number(item.quantity_received)>0&&item.add_to_inventory&&item.inventory_id)db.prepare('UPDATE parts_inventory SET quantity=quantity+?,cost=? WHERE id=?').run(Number(item.quantity_received),Number(item.unit_cost),item.inventory_id);
    });
    return id;
  })();
  res.json({id:poId,po_number:db.prepare('SELECT po_number FROM purchase_orders WHERE id=?').get(poId).po_number});
});

router.put('/purchase-orders/:id',(req,res)=>{
  if(!positiveId(res,req.params.id,'id')||!validatePo(req,res)||!validatePoRelationships(req,res))return;
  const tenant=shopTenantWhere(req);
  const current=db.prepare(`SELECT * FROM purchase_orders WHERE id=? AND ${tenant.clause}`).get(req.params.id,...tenant.values);
  if(!current)return res.status(404).json({error:'Purchase order not found'});
  db.transaction(()=>{
    db.prepare(`UPDATE purchase_orders SET vendor_id=?,job_id=?,status=?,vendor_invoice_number=?,ordered_at=CASE WHEN ?='Ordered' AND ordered_at IS NULL THEN datetime('now') ELSE ordered_at END,notes=?,updated_at=datetime('now') WHERE id=?`).run(req.body.vendor_id||null,req.body.job_id||null,req.body.status||'Draft',req.body.vendor_invoice_number||'',req.body.status||'Draft',req.body.notes||'',current.id);
    const existing=db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id=?').all(current.id),existingById=new Map(existing.map(item=>[Number(item.id),item])),kept=new Set();
    const insert=db.prepare(`INSERT INTO purchase_order_items (purchase_order_id,inventory_id,description,part_number,quantity_ordered,quantity_received,unit_cost,add_to_inventory) VALUES (?,?,?,?,?,?,?,?)`);
    const update=db.prepare(`UPDATE purchase_order_items SET inventory_id=?,description=?,part_number=?,quantity_ordered=?,quantity_received=?,unit_cost=?,add_to_inventory=? WHERE id=? AND purchase_order_id=?`);
    req.body.items.forEach(item=>{
      const old=existingById.get(Number(item.id)),received=Number(item.quantity_received);
      if(old){
        if(received<Number(old.quantity_received))throw Object.assign(new Error('Received quantity cannot be reduced after inventory is updated'),{status:400,field:'quantity_received'});
        if(Number(old.quantity_received)>0&&(Number(item.inventory_id||0)!==Number(old.inventory_id||0)||Boolean(item.add_to_inventory)!==Boolean(old.add_to_inventory)))throw Object.assign(new Error('The inventory destination cannot change after quantities are received'),{status:409,field:'inventory_id'});
        const delta=received-Number(old.quantity_received);
        update.run(item.inventory_id||null,String(item.description).trim(),item.part_number||'',Number(item.quantity_ordered),received,Number(item.unit_cost),item.add_to_inventory?1:0,old.id,current.id);kept.add(old.id);
        if(delta>0&&item.add_to_inventory&&item.inventory_id)db.prepare('UPDATE parts_inventory SET quantity=quantity+?,cost=? WHERE id=?').run(delta,Number(item.unit_cost),item.inventory_id);
      }else{
        const itemId=insert.run(current.id,item.inventory_id||null,String(item.description).trim(),item.part_number||'',Number(item.quantity_ordered),received,Number(item.unit_cost),item.add_to_inventory?1:0).lastInsertRowid;kept.add(Number(itemId));
        if(received>0&&item.add_to_inventory&&item.inventory_id)db.prepare('UPDATE parts_inventory SET quantity=quantity+?,cost=? WHERE id=?').run(received,Number(item.unit_cost),item.inventory_id);
      }
    });
    for(const old of existing)if(!kept.has(Number(old.id))){if(Number(old.quantity_received)>0)throw Object.assign(new Error('Received purchase-order lines cannot be removed'),{status:409,field:'items'});db.prepare('DELETE FROM purchase_order_items WHERE id=?').run(old.id);}
    const counts=db.prepare('SELECT SUM(quantity_ordered) ordered,SUM(quantity_received) received FROM purchase_order_items WHERE purchase_order_id=?').get(current.id);
    if(Number(counts.received)>=Number(counts.ordered))db.prepare(`UPDATE purchase_orders SET status='Fulfilled' WHERE id=?`).run(current.id);
    else if(Number(counts.received)>0)db.prepare(`UPDATE purchase_orders SET status='Received' WHERE id=?`).run(current.id);
  })();
  res.json({success:true});
});

router.post('/purchase-orders/:id/receive',(req,res)=>{
  if(!positiveId(res,req.params.id,'id')||!Array.isArray(req.body.items))return fail(res,'items','Received quantities are required');
  const tenant=shopTenantWhere(req);
  const po=db.prepare(`SELECT * FROM purchase_orders WHERE id=? AND ${tenant.clause}`).get(req.params.id,...tenant.values);
  if(!po)return res.status(404).json({error:'Purchase order not found'});
  db.transaction(()=>{
    for(const received of req.body.items){
      const item=db.prepare('SELECT * FROM purchase_order_items WHERE id=? AND purchase_order_id=?').get(received.id,po.id);
      const newQty=Number(received.quantity_received);
      if(!item||!Number.isFinite(newQty)||newQty<Number(item.quantity_received)||newQty>Number(item.quantity_ordered))throw Object.assign(new Error('Received quantity is invalid'),{status:400,field:'quantity_received'});
      const delta=newQty-Number(item.quantity_received);
      db.prepare('UPDATE purchase_order_items SET quantity_received=? WHERE id=?').run(newQty,item.id);
      if(delta>0&&item.add_to_inventory&&item.inventory_id)db.prepare(`UPDATE parts_inventory SET quantity=quantity+?,cost=? WHERE id=?`).run(delta,item.unit_cost,item.inventory_id);
    }
    const counts=db.prepare(`SELECT SUM(quantity_ordered) ordered,SUM(quantity_received) received FROM purchase_order_items WHERE purchase_order_id=?`).get(po.id);
    const status=Number(counts.received)>=Number(counts.ordered)?'Fulfilled':Number(counts.received)>0?'Received':po.status;
    db.prepare(`UPDATE purchase_orders SET status=?,updated_at=datetime('now') WHERE id=?`).run(status,po.id);
  })();
  res.json({success:true});
});

router.post('/tasks',(req,res)=>{
  if(!positiveId(res,req.body.job_id,'job_id',{required:true})||!requiredText(res,req.body,'description','Task description'))return;
  if(!tenantJob(req,req.body.job_id))return res.status(404).json({error:'Repair order not found'});
  if(req.body.job_item_id&&!db.prepare('SELECT id FROM job_items WHERE id=? AND job_id=?').get(req.body.job_item_id,req.body.job_id))return fail(res,'job_item_id','Labor operation not found on this repair order',404);
  if(req.body.employee_id&&!tenantEmployee(req,req.body.employee_id))return fail(res,'employee_id','Employee not found',404);
  if(!nonNegativeNumber(res,req.body,'estimated_hours',{label:'Estimated hours'}))return;
  const status=TASK_STATUSES.has(req.body.status)?req.body.status:'Not Started';
  const id=db.prepare(`INSERT INTO job_tasks (job_id,job_item_id,employee_id,description,estimated_hours,status,sort_order,completed_at) VALUES (?,?,?,?,?,?,?,?)`).run(req.body.job_id,req.body.job_item_id||null,req.body.employee_id||null,String(req.body.description).trim(),Number(req.body.estimated_hours)||0,status,Number(req.body.sort_order)||0,status==='Complete'?new Date().toISOString():null).lastInsertRowid;
  res.json(db.prepare('SELECT * FROM job_tasks WHERE id=?').get(id));
});

router.put('/tasks/:id',(req,res)=>{
  if(!positiveId(res,req.params.id,'id')||!requiredText(res,req.body,'description','Task description'))return;
  const current=db.prepare('SELECT * FROM job_tasks WHERE id=?').get(req.params.id);
  if(!current||!tenantJob(req,current.job_id))return res.status(404).json({error:'Task not found'});
  if(req.body.job_item_id&&!db.prepare('SELECT id FROM job_items WHERE id=? AND job_id=?').get(req.body.job_item_id,current.job_id))return fail(res,'job_item_id','Labor operation not found on this repair order',404);
  if(req.body.employee_id&&!tenantEmployee(req,req.body.employee_id))return fail(res,'employee_id','Employee not found',404);
  if(!nonNegativeNumber(res,req.body,'estimated_hours',{label:'Estimated hours'}))return;
  const status=TASK_STATUSES.has(req.body.status)?req.body.status:current.status;
  db.prepare(`UPDATE job_tasks SET job_item_id=?,employee_id=?,description=?,estimated_hours=?,status=?,sort_order=?,completed_at=CASE WHEN ?='Complete' THEN COALESCE(completed_at,datetime('now')) ELSE NULL END WHERE id=?`).run(req.body.job_item_id||null,req.body.employee_id||null,String(req.body.description).trim(),Number(req.body.estimated_hours)||0,status,Number(req.body.sort_order)||0,status,current.id);
  res.json({success:true});
});

router.post('/service-events',(req,res)=>{
  if(!positiveId(res,req.body.job_id,'job_id',{required:true}))return;
  if(!EVENT_TYPES.has(req.body.event_type))return fail(res,'event_type','Service event type is invalid');
  const job=tenantJob(req,req.body.job_id);
  if(!job)return res.status(404).json({error:'Repair order not found'});
  if(!nonNegativeNumber(res,req.body,'mileage',{label:'Mileage'}))return;
  if(req.body.employee_id&&!tenantEmployee(req,req.body.employee_id))return fail(res,'employee_id','Employee not found',404);
  if(req.body.photos!==undefined&&(!Array.isArray(req.body.photos)||req.body.photos.some(photo=>typeof photo!=='string'||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))||Buffer.byteLength(JSON.stringify(req.body.photos),'utf8')>750000))return fail(res,'photos','Condition photos must be JPEG, PNG, or WebP images smaller than 750 KB total');
  const id=db.transaction(()=>{
    const eventId=db.prepare(`INSERT INTO vehicle_service_events (shop_id,job_id,event_type,mileage,fuel_level,warning_lights,exterior_damage,keys_received,road_test_notes,checklist,photos,employee_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(resolveShopId(req),job.id,req.body.event_type,Number(req.body.mileage)||0,req.body.fuel_level||'',req.body.warning_lights||'',req.body.exterior_damage||'',req.body.keys_received||'',req.body.road_test_notes||'',JSON.stringify(req.body.checklist||{}),JSON.stringify(req.body.photos||[]),req.body.employee_id||null).lastInsertRowid;
    if(Number(req.body.mileage)>Number(job.miles||0)){
      db.prepare('UPDATE jobs SET miles=? WHERE id=?').run(Number(req.body.mileage),job.id);
      db.prepare('UPDATE vehicles SET miles=MAX(COALESCE(miles,0),?) WHERE id=?').run(Number(req.body.mileage),job.vehicle_id);
    }
    return eventId;
  })();
  res.json(db.prepare('SELECT * FROM vehicle_service_events WHERE id=?').get(id));
});

module.exports = router;
