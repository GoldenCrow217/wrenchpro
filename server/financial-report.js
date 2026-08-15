const { calculateJobTotals, roundCurrency, isTaxablePart } = require('./pricing');

function jobIncomeComponents(job) {
  const items = Array.isArray(job.items) ? job.items : [];
  let labor = Number(job.labor) || 0;
  let parts = Number(job.parts) || 0;
  let otherFees = 0;
  if (items.length) {
    labor = items.filter(item => String(item.type || '').toLowerCase() === 'labor').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    parts = items.filter(isTaxablePart).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    otherFees = items.filter(item => !isTaxablePart(item) && String(item.type || '').toLowerCase() !== 'labor').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }
  const totals = calculateJobTotals(labor + otherFees, parts, job.travel_fee, job.discount, job.tax_rate);
  const discountFactor = totals.subtotal > 0 ? Math.max(0, totals.subtotal - Math.min(totals.discount, totals.subtotal)) / totals.subtotal : 0;
  return {
    labor: roundCurrency(labor * discountFactor),
    parts: totals.netParts,
    fees: roundCurrency(otherFees * discountFactor + totals.travelFee),
    tax: totals.tax,
  };
}

function paymentIncomeMetrics(payments = [], jobs = [], period = 'all') {
  const inPeriod = date => Boolean(date) && (period === 'all' || String(date).startsWith(period));
  const income = { labor: 0, parts: 0, tax: 0, fees: 0, unallocated: 0, credits: 0 };
  const jobMap = new Map(jobs.map(job => [Number(job.id), job]));
  const allocatedByJob = new Map();
  [...payments].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || Number(a.id || 0) - Number(b.id || 0)).forEach(payment => {
    const amount = Math.max(0, Number(payment.amount) || 0);
    const lateFee = Math.min(amount, Math.max(0, Number(payment.late_fee_amount) || 0));
    const invoicePayment = roundCurrency(amount - lateFee);
    const job = jobMap.get(Number(payment.job_id));
    if (!job) {
      if (inPeriod(payment.date)) income.unallocated += invoicePayment;
      if (inPeriod(payment.date)) income.fees += lateFee;
      return;
    }
    if (job.deleted_at || job.status === 'Canceled' || job.invoice_status === 'Voided') {
      if (inPeriod(payment.date)) income.credits += amount;
      return;
    }
    const components = jobIncomeComponents(job);
    const jobTotal = components.labor + components.parts + components.tax + components.fees;
    const previouslyAllocated = allocatedByJob.get(job.id) || 0;
    const invoiceAmount = Math.min(invoicePayment, Math.max(0, jobTotal - previouslyAllocated));
    allocatedByJob.set(job.id, previouslyAllocated + invoiceAmount);
    if (!inPeriod(payment.date)) return;
    if (jobTotal > 0) Object.keys(components).forEach(key => { income[key] += invoiceAmount * components[key] / jobTotal; });
    else income.unallocated += invoiceAmount;
    income.fees += lateFee;
    income.credits += invoicePayment - invoiceAmount;
  });
  Object.keys(income).forEach(key => { income[key] = roundCurrency(income[key]); });
  return income;
}

module.exports = { jobIncomeComponents, paymentIncomeMetrics };
