const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const port = process.env.QA_PORT || String(4300 + Math.floor(Math.random() * 1000));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrenchpro-api-qa-'));
const serverPath = path.join(__dirname, '..', 'server', 'index.js');
const baseUrl = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, [serverPath], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: port, WRENCHPRO_DATA: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function requestRaw(method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { ok: response.ok, status: response.status, body: parsed, text };
}

async function request(method, route, body) {
  const result = await requestRaw(method, route, body);
  if (!result.ok) throw new Error(`${method} ${route} failed: HTTP ${result.status} ${result.text}`);
  return result.body;
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) throw new Error(`Server exited early. Output:\n${output}`);
    try {
      const health = await request('GET', '/api/health');
      if (health.ok) return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`Timed out waiting for server. Output:\n${output}`);
}

(async () => {
  try {
    await waitForServer();

    const health = await request('GET', '/api/health');
    assert(health.ok && health.version, 'Desktop health response is incomplete');
    assert(!('authRequired' in health) && !('supabaseConfigured' in health), 'Health still exposes SaaS state');
    assert((await requestRaw('GET', '/api/auth/config')).status === 404, 'Removed auth API should stay unavailable');
    assert((await requestRaw('GET', '/api/shops')).status === 404, 'Removed multi-shop API should stay unavailable');

    const markupTiers = [
      { up_to: 1, markup: 125 }, { up_to: 5, markup: 75 },
      { up_to: 10, markup: 60 }, { up_to: null, markup: 15 },
    ];
    await request('PUT', '/api/settings', { parts_markup_tiers: JSON.stringify(markupTiers) });
    const savedSettings = await request('GET', '/api/settings');
    assert(JSON.stringify(JSON.parse(savedSettings.parts_markup_tiers)) === JSON.stringify(markupTiers), 'Parts markup settings did not persist');
    const invalidTiers = await requestRaw('PUT', '/api/settings', { parts_markup_tiers: '[{"up_to":1,"markup":-1}]' });
    assert(invalidTiers.status === 400 && invalidTiers.body.field === 'parts_markup_tiers', 'Invalid parts markup settings should return field-specific HTTP 400');

    const emptyCustomer = await requestRaw('POST', '/api/customers');
    assert(emptyCustomer.status === 400, `Empty JSON body should return 400, got ${emptyCustomer.status}`);

    const lead = await request('POST', '/api/leads', {
      first: 'Repeat',
      last: 'Lead',
      phone: '555-0100',
      vehicle_year: 2020,
      vehicle_make: 'Ford',
      vehicle_model: 'Transit',
      service_needed: 'Brakes',
    });
    const firstLeadConversion = await request('POST', `/api/leads/${lead.id}/convert`);
    const secondLeadConversion = await request('POST', `/api/leads/${lead.id}/convert`);
    assert(firstLeadConversion.customer_id === secondLeadConversion.customer_id, 'Repeat lead conversion created a second customer');
    assert(secondLeadConversion.already_converted === true, 'Repeat lead conversion was not identified as idempotent');

    const customer = await request('POST', '/api/customers', {
      first: 'Inventory',
      last: 'Check',
      phone: '555-0200',
    });
    const vehicle = await request('POST', '/api/vehicles', {
      customer_id: customer.id,
      year: 2019,
      make: 'Chevrolet',
      model: 'Express',
      miles: 12000,
    });
    const manualJob = await request('POST', '/api/jobs', {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      repair_order_number: '  RO-00042  ',
      service: 'Diagnostic check',
      date: '2026-07-29',
      miles: 12500,
      items: [{ type: 'labor', description: 'Diagnostic labor', qty: 1, rate: 75, amount: 75, taxable: 0 }],
    });
    assert(manualJob.labor === 75 && manualJob.parts === 0, 'Created job response did not return its calculated column totals');
    assert(manualJob.first === customer.first && manualJob.year === vehicle.year, 'Created job response was not hydrated for immediate table rendering');
    assert(manualJob.items.length === 1 && manualJob.items[0].amount === 75, 'Created job response did not return its saved line items');
    assert(manualJob.vehicle_mileage === 12500, 'Created R/O did not return the advanced vehicle mileage');
    let mileageVehicle = (await request('GET', '/api/vehicles')).find(row => row.id === vehicle.id);
    assert(mileageVehicle.miles === 12500, 'Creating an R/O did not advance vehicle mileage');
    let manualJobRecord = (await request('GET', '/api/jobs')).find(job => job.id === manualJob.id);
    assert(manualJobRecord.repair_order_number === 'RO-00042', 'Repair order number was not trimmed and persisted');
    assert(manualJobRecord.items[0].inventory_id === null, 'Manual job QA requires a null inventory link');
    const updatedManualJob = await request('PUT', `/api/jobs/${manualJob.id}`, {
      repair_order_number: 'RO-00043',
      service: manualJobRecord.service,
      date: manualJobRecord.date,
      status: manualJobRecord.status,
      items: manualJobRecord.items,
    });
    assert(updatedManualJob.labor === 75 && updatedManualJob.parts === 0, 'Updated job response did not return recalculated column totals');
    assert(updatedManualJob.repair_order_number === 'RO-00043' && updatedManualJob.first === customer.first, 'Updated job response was not ready for immediate table rendering');
    const advancedMileageJob = await request('PUT', `/api/jobs/${manualJob.id}`, {
      repair_order_number: 'RO-00043', service: manualJobRecord.service, date: manualJobRecord.date, status: manualJobRecord.status, miles: 13000, items: manualJobRecord.items,
    });
    assert(advancedMileageJob.vehicle_mileage === 13000, 'Editing an R/O did not return the advanced vehicle mileage');
    await request('PUT', `/api/jobs/${manualJob.id}`, {
      repair_order_number: 'RO-00043', service: manualJobRecord.service, date: manualJobRecord.date, status: manualJobRecord.status, miles: 11000, items: manualJobRecord.items,
    });
    mileageVehicle = (await request('GET', '/api/vehicles')).find(row => row.id === vehicle.id);
    assert(mileageVehicle.miles === 13000, 'Editing an older R/O reduced the vehicle mileage');
    const negativeMileage = await requestRaw('PUT', `/api/jobs/${manualJob.id}`, { date: manualJobRecord.date, miles: -1 });
    assert(negativeMileage.status === 400 && negativeMileage.body.field === 'miles', 'Negative R/O mileage should return field-specific HTTP 400');
    const recalculatedManualJob = await request('PUT', `/api/jobs/${manualJob.id}`, {
      repair_order_number: 'RO-00043', service: manualJobRecord.service, date: manualJobRecord.date, status: manualJobRecord.status,
      items: [{ type: 'labor', description: 'Diagnostic labor', qty: 2, rate: 75, amount: 150, taxable: 0 }, { type: 'part', description: 'Test part', qty: 1, rate: 25, amount: 25, taxable: 1 }],
    });
    assert(recalculatedManualJob.labor === 150 && recalculatedManualJob.parts === 25, 'Changed line items were not reflected immediately in the updated job response');
    await request('PUT', `/api/jobs/${manualJob.id}`, {
      repair_order_number: 'RO-00043', service: manualJobRecord.service, date: manualJobRecord.date, status: manualJobRecord.status,
      items: manualJobRecord.items,
    });
    manualJobRecord = (await request('GET', '/api/jobs')).find(job => job.id === manualJob.id);
    assert(manualJobRecord.repair_order_number === 'RO-00043', 'Repair order number did not persist after editing');
    await request('PUT', '/api/settings', { tax_rate: 10, default_pay_method: 'Card' });
    await request('POST', '/api/payments', { customer_id: customer.id, job_id: manualJob.id, description: 'Deposit', amount: 20, method: 'Cash', date: '2026-07-29' });
    const paidJobItems = [...manualJobRecord.items, { type: 'part', description: 'Shop part', qty: 1, rate: 50, amount: 50, taxable: 1 }];
    const markedPaid = await request('PUT', `/api/jobs/${manualJob.id}`, {
      repair_order_number: manualJobRecord.repair_order_number,
      service: manualJobRecord.service,
      date: manualJobRecord.date,
      status: manualJobRecord.status,
      invoice_status: 'Paid',
      travel_fee: 25,
      items: paidJobItems,
    });
    assert(markedPaid.payment && markedPaid.payment.amount === 135, `Marking job paid should record the $135 remaining balance including parts tax, got ${JSON.stringify(markedPaid.payment)}`);
    assert(markedPaid.payment.method === 'Card', 'Automatic job payment did not use the configured default payment method');
    const paidAgain = await request('PUT', `/api/jobs/${manualJob.id}`, {
      repair_order_number: manualJobRecord.repair_order_number,
      service: manualJobRecord.service,
      date: manualJobRecord.date,
      status: manualJobRecord.status,
      invoice_status: 'Paid',
      travel_fee: 25,
      items: paidJobItems,
    });
    assert(paidAgain.payment === null, 'Repeated Paid job save created another automatic payment');
    const manualJobPayments = (await request('GET', '/api/payments')).filter(payment => payment.job_id === manualJob.id);
    assert(manualJobPayments.length === 2 && manualJobPayments.reduce((sum, payment) => sum + payment.amount, 0) === 155, 'Job payments do not equal the paid job total with parts-only tax');
    assert(manualJobPayments.every(payment => payment.repair_order_number === 'RO-00043'), 'Job-linked payments did not return their repair-order number');

    const rollbackJob = await request('POST', '/api/jobs', {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      repair_order_number: 'RO-00044',
      service: 'Payment rollback check',
      date: '2026-07-29',
      items: [{ type: 'labor', description: 'Labor', qty: 1, rate: 50, amount: 50, taxable: 0 }],
    });
    const qaDb = new Database(path.join(dataDir, 'wrenchpro.db'));
    qaDb.exec(`CREATE TRIGGER qa_fail_job_payment BEFORE INSERT ON payments WHEN NEW.job_id=${rollbackJob.id} BEGIN SELECT RAISE(ABORT, 'injected job payment failure'); END`);
    const failedPaidUpdate = await requestRaw('PUT', `/api/jobs/${rollbackJob.id}`, { repair_order_number: 'RO-00044', service: 'Payment rollback check', date: '2026-07-29', invoice_status: 'Paid', items: [{ type: 'labor', description: 'Labor', qty: 1, rate: 50, amount: 50, taxable: 0 }] });
    qaDb.exec('DROP TRIGGER qa_fail_job_payment');
    qaDb.close();
    assert(failedPaidUpdate.status === 500, 'Injected automatic-payment failure did not fail the job update');
    const rollbackJobRecord = (await request('GET', '/api/jobs')).find(job => job.id === rollbackJob.id);
    assert(rollbackJobRecord.invoice_status === 'Unpaid', 'Payment failure left the job marked Paid');
    assert(!(await request('GET', '/api/payments')).some(payment => payment.job_id === rollbackJob.id), 'Payment failure left a partial payment');
    const invalidRepairOrder = await requestRaw('PUT', `/api/jobs/${manualJob.id}`, { date: manualJobRecord.date, repair_order_number: { invalid: true } });
    assert(invalidRepairOrder.status === 400 && invalidRepairOrder.body.field === 'repair_order_number', 'Invalid repair order input should return field-specific HTTP 400');
    const inventory = await request('POST', '/api/inventory', {
      name: 'Brake Pad Set',
      quantity: 1,
      cost: 40,
      retail_price: 80,
    });
    const estimate = await request('POST', '/api/estimates', {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      date: '2026-07-29',
      miles: 13500,
      status: 'Approved',
      customer_complaint: 'Brake noise',
      items: [{
        type: 'part',
        description: 'Brake pads',
        qty: 2,
        rate: 80,
        amount: 160,
        inventory_id: inventory.id,
      }],
    });
    const taxedEstimate = await request('POST', '/api/estimates', {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      date: '2026-07-29',
      estimate_number: 'EST-9999',
      miles: 12000,
      tax_rate: 10,
      total: 999,
      items: [
        { type: 'labor', description: 'Labor', qty: 1, rate: 100, amount: 100 },
        { type: 'parts', description: 'Part', qty: 1, rate: 50, amount: 50 },
      ],
    });
    assert(taxedEstimate.total === 155, `Estimate should tax only parts and ignore a supplied total, got ${taxedEstimate.total}`);
    const firstEstimateSequence = Number(estimate.estimate_number.match(/^EST-(\d+)$/)?.[1]);
    const secondEstimateSequence = Number(taxedEstimate.estimate_number.match(/^EST-(\d+)$/)?.[1]);
    assert(Number.isSafeInteger(firstEstimateSequence), `First estimate did not receive an EST-#### number: ${estimate.estimate_number}`);
    assert(secondEstimateSequence === firstEstimateSequence + 1, `Estimate numbers were not sequential: ${estimate.estimate_number}, ${taxedEstimate.estimate_number}`);
    assert(taxedEstimate.estimate_number !== 'EST-9999', 'Client input overrode the server-assigned estimate number');
    let estimateMileageVehicle = (await request('GET', '/api/vehicles')).find(row => row.id === vehicle.id);
    assert(estimateMileageVehicle.miles === 13500, 'Estimate creation did not advance vehicle mileage or allowed a lower estimate to reduce it');
    const negativeEstimateMileage = await requestRaw('PUT', `/api/estimates/${estimate.id}`, { miles: -1 });
    assert(negativeEstimateMileage.status === 400 && negativeEstimateMileage.body.field === 'miles', 'Negative estimate mileage should return field-specific HTTP 400');
    const orderedEstimates = await request('GET', '/api/estimates');
    assert(orderedEstimates[0].id === taxedEstimate.id && orderedEstimates[1].id === estimate.id, 'Same-day estimates were not returned newest first');

    const insufficient = await requestRaw('POST', `/api/estimates/${estimate.id}/convert`);
    assert(insufficient.status === 409, `Insufficient inventory should return 409, got ${insufficient.status}`);
    let inventoryRows = await request('GET', '/api/inventory');
    assert(inventoryRows.find(row => row.id === inventory.id).quantity === 1, 'Rejected conversion changed inventory');

    await request('PUT', `/api/estimates/${estimate.id}`, {
      status: 'Approved',
      customer_complaint: 'Brake noise',
      miles: 14000,
      items: [{
        type: 'part',
        description: 'Brake pads',
        qty: 1,
        rate: 80,
        amount: 80,
        inventory_id: inventory.id,
      }],
    });
    estimateMileageVehicle = (await request('GET', '/api/vehicles')).find(row => row.id === vehicle.id);
    assert(estimateMileageVehicle.miles === 14000, 'Editing an estimate did not advance vehicle mileage');
    await request('PUT', `/api/estimates/${taxedEstimate.id}`, { status: 'Draft', miles: 11000 });
    estimateMileageVehicle = (await request('GET', '/api/vehicles')).find(row => row.id === vehicle.id);
    assert(estimateMileageVehicle.miles === 14000, 'Editing an older estimate reduced vehicle mileage');
    const firstEstimateConversion = await request('POST', `/api/estimates/${estimate.id}/convert`);
    const secondEstimateConversion = await request('POST', `/api/estimates/${estimate.id}/convert`);
    assert(firstEstimateConversion.job_id === secondEstimateConversion.job_id, 'Repeat estimate conversion created a second job');
    assert(secondEstimateConversion.already_converted === true, 'Repeat estimate conversion was not identified as idempotent');
    assert(/^RO-\d{4,}$/.test(firstEstimateConversion.repair_order_number), `Converted estimate did not receive an RO-#### number: ${firstEstimateConversion.repair_order_number}`);
    assert(secondEstimateConversion.repair_order_number === firstEstimateConversion.repair_order_number, 'Repeat estimate conversion changed the repair-order number');
    const convertedEstimateJob = (await request('GET', '/api/jobs')).find(job => job.id === firstEstimateConversion.job_id);
    assert(convertedEstimateJob.miles === 14000, 'Estimate mileage was not carried into the converted repair order');
    await request('PUT', `/api/estimates/${taxedEstimate.id}`, { status: 'Approved', discount: 30 });
    const discountedConversion = await request('POST', `/api/estimates/${taxedEstimate.id}/convert`);
    const discountedJob = (await request('GET', '/api/jobs')).find(job => job.id === discountedConversion.job_id);
    assert(discountedJob.discount === 30, 'Estimate discount was not carried into the converted repair order');
    assert(discountedJob.tax_rate === 10, 'Partial estimate update discarded the saved tax rate before conversion');
    const discountedBalance = await request('GET', `/api/jobs/${discountedJob.id}/balance`);
    assert(discountedBalance.total === 124 && discountedBalance.tax === 4, `Converted discount pricing changed from the approved $124 total: ${JSON.stringify(discountedBalance)}`);
    const paidDiscountedJob = await request('PUT', `/api/jobs/${discountedJob.id}`, {
      service: discountedJob.service, repair_order_number: discountedJob.repair_order_number, date: discountedJob.date,
      status: 'Complete', invoice_status: 'Paid', discount: 30, items: discountedJob.items,
    });
    assert(paidDiscountedJob.payment?.amount === 124, `Paid conversion recorded ${paidDiscountedJob.payment?.amount} instead of the discounted $124 balance`);
    inventoryRows = await request('GET', '/api/inventory');
    assert(inventoryRows.find(row => row.id === inventory.id).quantity === 0, 'Successful conversion did not deduct inventory exactly once');

    await request('PUT', `/api/jobs/${firstEstimateConversion.job_id}`, {
      service: 'Brake pads',
      date: '2026-07-29',
      status: 'Complete',
      estimate_id: estimate.id,
      items: [{ type: 'part', description: 'Brake pads', qty: 1, rate: 80, amount: 80, taxable: 1 }],
    });
    let jobs = await request('GET', '/api/jobs');
    assert(jobs.find(job => job.id === firstEstimateConversion.job_id).closed_at, 'Completed job did not receive closed_at');

    await request('PUT', `/api/jobs/${firstEstimateConversion.job_id}`, {
      service: 'Brake pads',
      date: '2026-07-29',
      status: 'In Progress',
      estimate_id: estimate.id,
      items: [{ type: 'part', description: 'Brake pads', qty: 1, rate: 80, amount: 80, taxable: 1 }],
    });
    jobs = await request('GET', '/api/jobs');
    assert(jobs.find(job => job.id === firstEstimateConversion.job_id).closed_at === null, 'Reopened job retained closed_at');

    const dashboardBefore = await request('GET', '/api/dashboard');
    const dashboardDate = new Date();
    const dashboardDateString = `${dashboardDate.getFullYear()}-${String(dashboardDate.getMonth() + 1).padStart(2, '0')}-${String(dashboardDate.getDate()).padStart(2, '0')}`;
    await request('POST', '/api/payments', { customer_id: customer.id, description: 'Dashboard monthly revenue QA', amount: 123, method: 'Cash', date: dashboardDateString });
    await request('POST', '/api/expenses', { description: 'Dashboard monthly expense QA', category: 'Other', amount: 23, date: dashboardDateString });
    const dashboardAfter = await request('GET', '/api/dashboard');
    assert(dashboardAfter.monthRevenue - dashboardBefore.monthRevenue === 123, 'Dashboard monthly revenue did not use payment dates');
    assert(dashboardAfter.monthExpenses - dashboardBefore.monthExpenses === 23, 'Dashboard monthly expenses did not use expense dates');
    assert(dashboardAfter.monthNetProfit - dashboardBefore.monthNetProfit === 100, 'Dashboard monthly net profit did not equal monthly revenue minus expenses');
    assert(dashboardAfter.totalRevenue - dashboardBefore.totalRevenue === 123 && dashboardAfter.totalExpenses - dashboardBefore.totalExpenses === 23, 'Dashboard all-time totals changed inconsistently with monthly totals');

    console.log('Local desktop API QA passed:', JSON.stringify({
      port,
      leadId: lead.id,
      customerId: customer.id,
      estimateId: estimate.id,
      jobId: firstEstimateConversion.job_id,
    }));
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
