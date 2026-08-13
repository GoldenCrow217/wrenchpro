const { roundCurrency } = require('./pricing');

function jobFinancials(db, jobId, fallbackTaxRate = 0) {
  const job = db.prepare('SELECT labor, parts, travel_fee, tax_rate, invoice_status FROM jobs WHERE id=?').get(jobId);
  if (!job) return null;
  const items = db.prepare('SELECT amount, taxable FROM job_items WHERE job_id=?').all(jobId);
  const labor = roundCurrency(items.length ? items.filter(item => !item.taxable).reduce((sum, item) => sum + Number(item.amount || 0), 0) : Number(job.labor || 0));
  const parts = roundCurrency(items.length ? items.filter(item => item.taxable).reduce((sum, item) => sum + Number(item.amount || 0), 0) : Number(job.parts || 0));
  const taxRate = Number(job.tax_rate ?? fallbackTaxRate) || 0;
  const tax = roundCurrency(parts * taxRate / 100);
  const total = roundCurrency(labor + parts + tax + Number(job.travel_fee || 0));
  const paid = roundCurrency(db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE job_id=?').get(jobId).total);
  return { ...job, labor, parts, taxRate, tax, total, paid, balance: roundCurrency(Math.max(0, total - paid)) };
}

function reconcileJobInvoiceStatus(db, jobId, fallbackTaxRate = 0) {
  if (!jobId) return null;
  const finances = jobFinancials(db, jobId, fallbackTaxRate);
  if (!finances) return null;
  if (finances.invoice_status === 'Voided') return 'Voided';
  const status = finances.paid <= 0.004 ? 'Unpaid' : finances.paid + 0.005 >= finances.total ? 'Paid' : 'Partial';
  db.prepare('UPDATE jobs SET invoice_status=? WHERE id=?').run(status, jobId);
  return status;
}

module.exports = { jobFinancials, reconcileJobInvoiceStatus };
