const express = require('express');
const router = express.Router();
const db = require('../database');
const { customerTenantWhere, resolveShopId } = require('../tenant');
const { fail, finiteNumber, positiveId, isoDate } = require('../validation');
const { reconcileJobInvoiceStatus } = require('../job-finance');

function currentTaxRate(req) {
  const shopId = resolveShopId(req);
  const settings = (shopId ? db.prepare('SELECT tax_rate FROM shop_settings WHERE shop_id=?').get(shopId) : null)
    || db.prepare('SELECT tax_rate FROM settings WHERE id=1').get() || {};
  return Number(settings.tax_rate) || 0;
}

function validatePayment(res, body, includeRelationships) {
  if (includeRelationships && !positiveId(res, body.customer_id, 'customer_id', { required: true })) return false;
  if (includeRelationships && !positiveId(res, body.job_id, 'job_id')) return false;
  if (includeRelationships && !positiveId(res, body.plan_id, 'plan_id')) return false;
  if (!finiteNumber(res, body, 'amount', { required: true, label: 'Amount' })) return false;
  if (Number(body.amount) <= 0) return fail(res, 'amount', 'Payment amount must be greater than zero');
  return isoDate(res, body, 'date', { required: true, label: 'Payment date' });
}

router.get('/', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const payments = db.prepare(`
    SELECT p.*, c.first, c.last, j.repair_order_number
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    LEFT JOIN jobs j ON p.job_id = j.id
    WHERE ${tenant.clause}
    ORDER BY p.date DESC
  `).all(...tenant.values);
  res.json(payments);
});

router.post('/', (req, res) => {
  if (!validatePayment(res, req.body, true)) return;
  const { customer_id, plan_id, job_id, description, amount, method, date, note } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const customer = db.prepare(`SELECT c.id FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}`)
    .get(customer_id, ...tenant.values);
  if (!customer) return fail(res, 'customer_id', 'Customer not found', 404);

  let resolvedJobId = job_id ? Number(job_id) : null;
  let plan = null;
  if (plan_id) {
    plan = db.prepare('SELECT id, job_id FROM payment_plans WHERE id = ? AND customer_id = ?').get(plan_id, customer_id);
    if (!plan) return fail(res, 'plan_id', 'Payment plan not found or does not belong to this customer', 404);
    if (resolvedJobId && plan.job_id && resolvedJobId !== plan.job_id) return fail(res, 'job_id', 'Payment repair order does not match the selected payment plan');
    resolvedJobId = plan.job_id || resolvedJobId;
  }

  let job = null;
  if (resolvedJobId) {
    job = db.prepare('SELECT id, repair_order_number FROM jobs WHERE id = ? AND customer_id = ? AND deleted_at IS NULL').get(resolvedJobId, customer_id);
    if (!job) return fail(res, 'job_id', 'Job not found or does not belong to this customer', 404);
  }

  const savePayment = db.transaction(() => {
    const result = db.prepare(`INSERT INTO payments (customer_id, plan_id, job_id, late_fee_amount, description, amount, method, date, note) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`)
      .run(customer_id, plan_id || null, resolvedJobId, description || '', amount, method || 'Cash', date, note || '');
    const allocations = [];
    let lateFeeAmount = 0;
    const isDownPayment = String(note || '').trim().toLowerCase() === 'down payment';
    if (plan && !isDownPayment) {
      const shopId = resolveShopId(req);
      const settings = (shopId ? db.prepare('SELECT payment_grace_days, late_fee FROM shop_settings WHERE shop_id=?').get(shopId) : null)
        || db.prepare('SELECT payment_grace_days, late_fee FROM settings WHERE id=1').get() || {};
      let remaining = Number(amount);
      const installments = db.prepare('SELECT * FROM installments WHERE plan_id=? AND paid=0 ORDER BY due_date,id').all(plan.id);
      for (const inst of installments) {
        if (remaining <= 0) break;
        const cutoff = inst.due_date ? new Date(`${inst.due_date}T00:00:00Z`) : null;
        if (cutoff) cutoff.setUTCDate(cutoff.getUTCDate() + (Number(settings.payment_grace_days) || 0));
        const lateFee = cutoff && date > cutoff.toISOString().slice(0,10) ? Number(inst.late_fee || settings.late_fee) || 0 : Number(inst.late_fee) || 0;
        const due = Math.max(0, Number(inst.amount) + lateFee - Number(inst.amount_paid || 0));
        const applied = Math.min(remaining, due);
        if (!(applied > 0)) continue;
        db.prepare('INSERT INTO payment_allocations (payment_id,installment_id,amount) VALUES (?,?,?)').run(result.lastInsertRowid, inst.id, applied);
        const newPaid = Number(inst.amount_paid || 0) + applied;
        const previousFeePaid = Math.max(0, Number(inst.amount_paid || 0) - Number(inst.amount || 0));
        const newFeePaid = Math.max(0, newPaid - Number(inst.amount || 0));
        lateFeeAmount += Math.max(0, newFeePaid - previousFeePaid);
        const complete = newPaid + .005 >= Number(inst.amount) + lateFee;
        db.prepare('UPDATE installments SET amount_paid=?, late_fee=?, paid=?, paid_date=? WHERE id=?').run(newPaid, lateFee, complete ? 1 : 0, complete ? date : null, inst.id);
        allocations.push({ installment_id: inst.id, amount: applied });
        remaining = Math.round((remaining - applied) * 100) / 100;
      }
      if (lateFeeAmount > 0) db.prepare('UPDATE payments SET late_fee_amount=? WHERE id=?').run(Math.round(lateFeeAmount * 100) / 100, result.lastInsertRowid);
    }
    const jobInvoiceStatus = reconcileJobInvoiceStatus(db, resolvedJobId, currentTaxRate(req));
    return { id: result.lastInsertRowid, allocations, lateFeeAmount: Math.round(lateFeeAmount * 100) / 100, jobInvoiceStatus };
  });
  const saved = savePayment();
  const planInstallments = plan ? db.prepare('SELECT * FROM installments WHERE plan_id=? ORDER BY due_date').all(plan.id) : undefined;
  res.json({ id: saved.id, ...req.body, job_id: resolvedJobId, repair_order_number: job?.repair_order_number || null, late_fee_amount: saved.lateFeeAmount, allocations: saved.allocations, plan_installments: planInstallments, job_invoice_status: saved.jobInvoiceStatus });
});

router.post('/:id/refund', (req, res) => {
  if (!finiteNumber(res, req.body, 'amount', { required: true, label: 'Refund amount' })) return;
  if (Number(req.body.amount) <= 0) return fail(res, 'amount', 'Refund amount must be greater than zero');
  if (!isoDate(res, req.body, 'date', { required: true, label: 'Refund date' })) return;
  const tenant = customerTenantWhere(req, 'c');
  const payment = db.prepare(`SELECT p.*,c.first,c.last,j.repair_order_number FROM payments p JOIN customers c ON p.customer_id=c.id LEFT JOIN jobs j ON p.job_id=j.id WHERE p.id=? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!payment) return fail(res, 'payment_id', 'Payment not found', 404);
  if (payment.payment_type === 'refund' || Number(payment.amount) <= 0) return fail(res, 'payment_id', 'A refund cannot be refunded again', 409);
  if (payment.plan_id || payment.installment_id) return fail(res, 'payment_id', 'Payment-plan funds must be corrected from the payment plan so installment balances remain accurate', 409);
  const alreadyRefunded = Math.abs(Number(db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE parent_payment_id=? AND payment_type='refund'`).get(payment.id).total || 0));
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const remaining = Math.round((Number(payment.amount) - alreadyRefunded) * 100) / 100;
  if (amount > remaining + 0.005) return fail(res, 'amount', `Refund amount cannot exceed the remaining refundable amount of $${remaining.toFixed(2)}`);
  const saved = db.transaction(() => {
    const result = db.prepare(`INSERT INTO payments (customer_id,job_id,description,amount,method,date,note,payment_type,parent_payment_id) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(payment.customer_id,payment.job_id||null,`Refund — ${payment.description||'Payment'}`,-amount,req.body.method||payment.method||'Cash',req.body.date,req.body.note||'', 'refund',payment.id);
    const jobInvoiceStatus = reconcileJobInvoiceStatus(db, payment.job_id, currentTaxRate(req));
    return { id: result.lastInsertRowid, jobInvoiceStatus };
  })();
  res.json({ id:saved.id,customer_id:payment.customer_id,job_id:payment.job_id||null,repair_order_number:payment.repair_order_number||null,first:payment.first,last:payment.last,description:`Refund — ${payment.description||'Payment'}`,amount:-amount,method:req.body.method||payment.method||'Cash',date:req.body.date,note:req.body.note||'',payment_type:'refund',parent_payment_id:payment.id,job_invoice_status:saved.jobInvoiceStatus });
});

router.put('/:id', (req, res) => {
  if (!validatePayment(res, req.body, false)) return;
  const { description, amount, method, date, note } = req.body;
  const tenant = customerTenantWhere(req, 'c');
  const payment = db.prepare(`SELECT p.* FROM payments p JOIN customers c ON p.customer_id=c.id WHERE p.id=? AND c.deleted_at IS NULL AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.payment_type === 'refund') return res.status(409).json({ error: 'Refund records cannot be edited. Delete the refund and record it again.' });
  if (payment.plan_id && String(payment.note || '').trim().toLowerCase() === 'down payment') return res.status(409).json({ error: 'Plan down payments cannot be edited separately from their payment plan' });
  if (payment.installment_id) return res.status(409).json({ error: 'Installment payments cannot be edited; delete and re-record the payment instead' });
  const allocated = db.prepare(`SELECT pa.id FROM payment_allocations pa JOIN payments p ON pa.payment_id=p.id JOIN customers c ON p.customer_id=c.id WHERE p.id=? AND c.deleted_at IS NULL AND ${tenant.clause} LIMIT 1`).get(req.params.id, ...tenant.values);
  if (allocated) return res.status(409).json({ error: 'Allocated plan payments cannot be edited; delete and re-record the payment instead' });
  const result = db.transaction(() => {
    const update = db.prepare(`
      UPDATE payments SET description=?, amount=?, method=?, date=?, note=?
      WHERE id IN (
        SELECT p.id FROM payments p
        JOIN customers c ON p.customer_id = c.id
        WHERE p.id = ? AND c.deleted_at IS NULL AND ${tenant.clause}
      )
    `).run(description || '', amount, method || 'Cash', date, note || '', req.params.id, ...tenant.values);
    if (update.changes) reconcileJobInvoiceStatus(db, payment.job_id, currentTaxRate(req));
    return update;
  })();
  if (!result.changes) return res.status(404).json({ error: 'Payment not found' });
  res.json({ success: true, job_id: payment.job_id || null, job_invoice_status: payment.job_id ? db.prepare('SELECT invoice_status FROM jobs WHERE id=?').get(payment.job_id)?.invoice_status : null });
});

router.delete('/:id', (req, res) => {
  const tenant = customerTenantWhere(req, 'c');
  const payment = db.prepare(`SELECT p.* FROM payments p JOIN customers c ON p.customer_id=c.id WHERE p.id=? AND ${tenant.clause}`).get(req.params.id, ...tenant.values);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.payment_type !== 'refund' && db.prepare(`SELECT id FROM payments WHERE parent_payment_id=? AND payment_type='refund' LIMIT 1`).get(payment.id)) {
    return res.status(409).json({ error: 'Delete linked refund records before deleting the original payment' });
  }
  if (payment.plan_id && String(payment.note || '').trim().toLowerCase() === 'down payment') {
    return res.status(409).json({ error: 'Delete the payment plan first. Its down payment will remain in the ledger and can then be deleted safely.' });
  }
  db.transaction(() => {
    const allocations = db.prepare('SELECT * FROM payment_allocations WHERE payment_id=?').all(payment.id);
    const affectedInstallments = new Set(allocations.map(allocation => Number(allocation.installment_id)));
    if (payment.installment_id) affectedInstallments.add(Number(payment.installment_id));
    db.prepare('DELETE FROM payment_allocations WHERE payment_id=?').run(payment.id);
    db.prepare('DELETE FROM payments WHERE id=?').run(payment.id);
    for (const installmentId of affectedInstallments) {
      const installment = db.prepare('SELECT * FROM installments WHERE id=?').get(installmentId);
      if (!installment) continue;
      const allocationSummary = db.prepare(`
        SELECT COALESCE(SUM(pa.amount),0) AS amount_paid, MAX(p.date) AS last_paid_date
        FROM payment_allocations pa
        JOIN payments p ON p.id=pa.payment_id
        WHERE pa.installment_id=?
      `).get(installmentId);
      const amountPaid = Math.round(Number(allocationSummary.amount_paid || 0) * 100) / 100;
      const lateFee = amountPaid > 0 ? Number(installment.late_fee || 0) : 0;
      const paid = amountPaid + .005 >= Number(installment.amount || 0) + lateFee;
      db.prepare('UPDATE installments SET amount_paid=?, late_fee=?, paid=?, paid_date=? WHERE id=?')
        .run(amountPaid, lateFee, paid ? 1 : 0, paid ? allocationSummary.last_paid_date : null, installmentId);
    }
    reconcileJobInvoiceStatus(db, payment.job_id, currentTaxRate(req));
  })();
  const planInstallments = payment.plan_id ? db.prepare('SELECT * FROM installments WHERE plan_id=? ORDER BY due_date').all(payment.plan_id) : undefined;
  res.json({ success: true, job_id: payment.job_id || null, plan_id: payment.plan_id || null, plan_installments: planInstallments, job_invoice_status: payment.job_id ? db.prepare('SELECT invoice_status FROM jobs WHERE id=?').get(payment.job_id)?.invoice_status : null });
});

module.exports = router;
