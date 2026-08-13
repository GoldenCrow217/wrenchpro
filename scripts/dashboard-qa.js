const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const helperStart = html.indexOf('function localDateKey(');
const helperEnd = html.indexOf('\nasync function renderDashboard()', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'dashboard calculation helpers must be extractable');

const context = {
  fmt$: value => `$${Number(value || 0).toFixed(2)}`,
  planBalance: plan => Number(plan.balance || 0),
};
vm.runInNewContext(`${html.slice(helperStart, helperEnd)};globalThis.qa={localDateKey,dashboardJobTotal,dashboardJobBalance,dashboardMetrics};`, context);

const qa = context.qa;
assert.strictEqual(qa.localDateKey(new Date(2026, 7, 12, 23, 30)), '2026-08-12', 'dashboard dates must use the local calendar date');
assert.strictEqual(qa.dashboardJobTotal({ labor: 100, parts: 50, travel_fee: 25 }, 10), 180, 'job totals must include labor, parts-only tax, and trip fees');
assert.strictEqual(qa.dashboardJobBalance({ id: 1, labor: 100, parts: 50, travel_fee: 25 }, [{ job_id: 1, amount: 55 }], 10), 125, 'job balances must subtract linked payments');

const now = new Date(2026, 7, 12, 12, 0);
const snapshot = {
  settings: { tax_rate: 10 },
  jobs: [
    { id: 1, status: 'Complete', closed_at: '2026-08-10 12:00:00', date: '2026-08-10', invoice_status: 'Partial', labor: 100, parts: 50, travel_fee: 25, first: 'Closed' },
    { id: 2, status: 'Pending', closed_at: null, date: '2026-08-12', invoice_status: 'Unpaid', labor: 20, parts: 0, travel_fee: 0, first: 'Today' },
    { id: 3, status: 'Canceled', closed_at: '2026-08-11 12:00:00', date: '2026-08-11', invoice_status: 'Unpaid', labor: 999, parts: 999 },
  ],
  payments: [
    { id: 1, job_id: 1, date: '2026-08-11', amount: 55, first: 'Closed' },
    { id: 2, job_id: 2, date: '2026-08-12', amount: 20, first: 'Today' },
    { id: 3, job_id: null, date: '2026-08-01', amount: 100, first: 'Old' },
  ],
  plans: [{ id: 1, job_id: 1, balance: 500 }, { id: 2, job_id: null, balance: 30 }],
  leads: [
    { id: 1, status: 'New', created_at: '2026-08-01 09:00:00' },
    { id: 2, status: 'New', created_at: '2026-06-01 09:00:00' },
  ],
};
const metrics = qa.dashboardMetrics(snapshot, now);
assert.strictEqual(metrics.active.length, 1, 'only nonterminal, nonclosed jobs must count as active');
assert.deepStrictEqual(Array.from(metrics.todayJobs, job => job.id), [2], 'today route must exclude completed and canceled jobs');
assert.strictEqual(metrics.weekTotal, 75, 'seven-day revenue must exclude older payments');
assert.strictEqual(metrics.outstanding, 155, 'outstanding must include job balances and only unlinked legacy plan balances');
assert.deepStrictEqual(Array.from(metrics.overdueInvoices, job => job.id), [1], 'overdue invoices must use invoice status and closed date');
assert.deepStrictEqual(Array.from(metrics.recentPayments, payment => payment.id), [2, 1], 'recent payments must be limited to the last seven days and sorted newest first');
assert.deepStrictEqual(Array.from(metrics.recentLeads, lead => lead.id), [1], 'pipeline must be limited to the last 30 days');
assert.strictEqual(metrics.activity[0].id, 2, 'activity must select the newest records rather than array-tail records');

const reportStart = html.indexOf('function reportMetrics(');
const reportEnd = html.indexOf('\nfunction renderReport()', reportStart);
assert.ok(reportStart >= 0 && reportEnd > reportStart, 'P&L calculation helper must be extractable');
const reportContext = { dashboardJobBalance: qa.dashboardJobBalance, planBalance: context.planBalance };
vm.runInNewContext(`${html.slice(reportStart, reportEnd)};globalThis.reportMetrics=reportMetrics;`, reportContext);
const overpaymentReport = reportContext.reportMetrics({
  settings: { tax_rate: 10 },
  jobs: [{ id: 9, status: 'Complete', invoice_status: 'Paid', labor: 100, parts: 50, travel_fee: 0, first: 'Credit' }],
  payments: [{ id: 1, job_id: 9, date: '2026-08-01', amount: 155 }, { id: 2, job_id: 9, date: '2026-08-02', amount: 45 }],
  expenses: [], plans: [],
});
assert.strictEqual(overpaymentReport.income.labor, 100, 'Overpayment must not inflate labor revenue');
assert.strictEqual(overpaymentReport.income.parts, 50, 'Overpayment must not inflate parts revenue');
assert.strictEqual(overpaymentReport.income.tax, 5, 'Overpayment must not inflate sales-tax liability');
assert.strictEqual(overpaymentReport.income.credits, 45, 'Excess receipts must be classified as customer-credit liability');
assert.strictEqual(overpaymentReport.totalIncome, 150, 'Customer credits must not count as operating income');
assert.strictEqual(overpaymentReport.totalReceived, 200, 'Cash received must still include the overpayment');

assert.match(html, /const netProfit = Number\(data\.monthNetProfit\)\|\|0/, 'dashboard monthly profit must use monthly server totals');
assert.match(html, /Revenue · last 7 days/, 'revenue period label must match its calculation');
assert.match(html, /class="kpi-value">\$\{fmt\$\(weekTotal\)\}/, 'dashboard revenue must display cents without whole-dollar rounding');
assert.match(html, /class="kpi-value">\$\{fmt\$\(outstanding\)\}/, 'dashboard outstanding balance must display cents');
assert.match(html, /dashboardJobTotal\(j,state\.settings\.tax_rate\)/, 'today route must display the complete job total');
assert.match(html, /dashboardJobBalance\(job,state\.payments,state\.settings\.tax_rate\)/, 'overdue amount must display remaining invoice balances');

console.log('Dashboard calculation QA passed');
