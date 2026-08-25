const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId, shopTenantWhere, customerTenantWhere, getTenantCustomer } = require('../tenant');
const { fail, positiveId, isoDate, clockTime } = require('../validation');

function validateTenantRefs(req, res, customerId, vehicleId, estimateId) {
  const tenant = customerTenantWhere(req, 'c');
  if (customerId) {
    const { customer } = getTenantCustomer(req, customerId, 'c');
    if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);
  }
  if (vehicleId) {
    const vehicle = db.prepare(`
      SELECT v.id FROM vehicles v
      JOIN customers c ON v.customer_id = c.id
      WHERE v.id = ? AND v.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
      ${customerId ? 'AND v.customer_id = ?' : ''}
    `).get(vehicleId, ...tenant.values, ...(customerId ? [customerId] : []));
    if (!vehicle) return fail(res, 'vehicle_id', 'Vehicle not found', 404);
  }
  if (estimateId) {
    const estimate = db.prepare(`
      SELECT e.id FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      WHERE e.id = ? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND ${tenant.clause}
      ${customerId ? 'AND e.customer_id = ?' : ''}
    `).get(estimateId, ...tenant.values, ...(customerId ? [customerId] : []));
    if (!estimate) return fail(res, 'estimate_id', 'Estimate not found', 404);
  }
  return true;
}

function validateAppointment(req, res) {
  const body = req.body;
  if (!isoDate(res, body, 'date', { required: true, label: 'Appointment date' })) return false;
  if (!clockTime(res, body, 'time')) return false;
  for (const field of ['customer_id', 'vehicle_id', 'estimate_id', 'resource_id']) {
    if (!positiveId(res, body[field], field)) return false;
  }
  if (body.duration_minutes !== undefined && (!Number.isSafeInteger(Number(body.duration_minutes)) || Number(body.duration_minutes) < 15 || Number(body.duration_minutes) > 1440)) return fail(res, 'duration_minutes', 'Appointment duration must be between 15 minutes and 24 hours');
  if (body.recurrence_rule && !['weekly','monthly'].includes(body.recurrence_rule)) return fail(res, 'recurrence_rule', 'Appointment recurrence is not supported');
  if (body.recurrence_count !== undefined && (!Number.isSafeInteger(Number(body.recurrence_count)) || Number(body.recurrence_count) < 1 || Number(body.recurrence_count) > 52)) return fail(res, 'recurrence_count', 'Recurring appointments must contain between 1 and 52 appointments');
  if (body.resource_id) {
    const resourceTenant=shopTenantWhere(req);
    if (!db.prepare(`SELECT id FROM shop_resources WHERE id=? AND active=1 AND ${resourceTenant.clause}`).get(body.resource_id,...resourceTenant.values)) return fail(res,'resource_id','Bay or mobile unit not found',404);
  }
  return validateTenantRefs(req, res, body.customer_id, body.vehicle_id, body.estimate_id);
}

function timeMinutes(value){const [hours,minutes]=String(value||'00:00').split(':').map(Number);return hours*60+minutes;}
function resourceConflict(req,{resourceId,date,time,duration,excludeId=null}){
  if(!resourceId||!time)return null;
  const tenant=shopTenantWhere(req,'a'),start=timeMinutes(time),end=start+duration;
  return db.prepare(`SELECT a.id,a.cust,a.time,a.duration_minutes FROM appointments a WHERE a.resource_id=? AND a.date=? AND a.id<>? AND ${tenant.clause}`).all(resourceId,date,excludeId||0,...tenant.values).find(row=>{const otherStart=timeMinutes(row.time),otherEnd=otherStart+Number(row.duration_minutes||60);return start<otherEnd&&end>otherStart;});
}
function recurringDate(date,index,rule){
  const [year,month,day]=date.split('-').map(Number),value=new Date(Date.UTC(year,month-1,day));
  if(rule==='weekly')value.setUTCDate(value.getUTCDate()+index*7);
  else if(rule==='monthly'){const originalDay=value.getUTCDate();value.setUTCDate(1);value.setUTCMonth(value.getUTCMonth()+index);value.setUTCDate(Math.min(originalDay,new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth()+1,0)).getUTCDate()));}
  return value.toISOString().slice(0,10);
}

router.get('/', (req, res) => {
  const tenant = shopTenantWhere(req, 'a');
  const appts = db.prepare(`
    SELECT a.*,
           c.first AS cust_first, c.last AS cust_last,
           v.year AS veh_year, v.make AS veh_make, v.model AS veh_model,
           sr.name AS resource_name, sr.resource_type
    FROM appointments a
    LEFT JOIN customers c
      ON a.customer_id = c.id
     AND c.deleted_at IS NULL
     AND ((a.shop_id IS NULL AND c.shop_id IS NULL) OR a.shop_id = c.shop_id)
    LEFT JOIN vehicles v
      ON a.vehicle_id = v.id
     AND v.deleted_at IS NULL
     AND v.customer_id = c.id
    LEFT JOIN shop_resources sr ON sr.id=a.resource_id
    WHERE ${tenant.clause}
    ORDER BY a.date, a.time
  `).all(...tenant.values);
  res.json(appts);
});

router.post('/', (req, res) => {
  if (!validateAppointment(req, res)) return;
  const { cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id, resource_id, recurrence_rule } = req.body;
  const duration=Number(req.body.duration_minutes)||60,recurrenceCount=recurrence_rule?Number(req.body.recurrence_count)||1:1;
  const shopId = resolveShopId(req);
  const dates=Array.from({length:recurrenceCount},(_,index)=>recurringDate(date,index,recurrence_rule));
  for(const occurrenceDate of dates){const conflict=resourceConflict(req,{resourceId:resource_id,date:occurrenceDate,time,duration});if(conflict)return res.status(409).json({error:`${conflict.cust||'Another appointment'} already uses this resource at ${conflict.time}`,field:'resource_id'});}
  const ids=db.transaction(()=>{const insert=db.prepare(`INSERT INTO appointments (shop_id,cust,phone,service,date,time,customer_id,vehicle_id,address,notes,estimate_id,resource_id,duration_minutes,recurrence_rule) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);return dates.map(occurrenceDate=>Number(insert.run(shopId,cust||'',phone||'',service||'',occurrenceDate,time||'',customer_id||null,vehicle_id||null,address||'',notes||'',estimate_id||null,resource_id||null,duration,recurrence_rule||'').lastInsertRowid));})();
  res.json({ id: ids[0], recurrence_ids: ids, shop_id: shopId, ...req.body });
});

router.put('/:id', (req, res) => {
  if (!positiveId(res, req.params.id, 'id')) return;
  if (!validateAppointment(req, res)) return;
  const { cust, phone, service, date, time, customer_id, vehicle_id, address, notes, estimate_id, resource_id } = req.body;
  const duration=Number(req.body.duration_minutes)||60;
  const tenant = shopTenantWhere(req);
  const conflict=resourceConflict(req,{resourceId:resource_id,date,time,duration,excludeId:Number(req.params.id)});if(conflict)return res.status(409).json({error:`${conflict.cust||'Another appointment'} already uses this resource at ${conflict.time}`,field:'resource_id'});
  const result = db.prepare(`
    UPDATE appointments
    SET cust=?, phone=?, service=?, date=?, time=?, customer_id=?, vehicle_id=?, address=?, notes=?, estimate_id=?,resource_id=?,duration_minutes=?
    WHERE id=? AND ${tenant.clause}
  `).run(cust || '', phone || '', service || '', date, time || '', customer_id || null, vehicle_id || null, address || '', notes || '', estimate_id || null,resource_id||null,duration, req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const tenant = shopTenantWhere(req);
  const result = db.prepare(`DELETE FROM appointments WHERE id = ? AND ${tenant.clause}`).run(req.params.id, ...tenant.values);
  if (!result.changes) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ success: true });
});

module.exports = router;
