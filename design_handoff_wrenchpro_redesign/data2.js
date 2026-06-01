/* global window, DATA */
// Extended mock data — leads, estimates, plans, payments, expenses, employees, time, services, warranties

window.DATA2 = (function () {
  const leads = [
    { id: 'L1', name: 'Aaron Mosley',     phone: '(214) 555-0211', email: 'amosley@gmail.com',   vehicle: '2015 Chevy Silverado 1500', service: 'Squealing brakes — front',        source: 'Google Maps',     value: 480,  followUp: 'Today',     status: 'New',       hot: true,  createdAt: '2 hr ago' },
    { id: 'L2', name: 'Janet Liu',        phone: '(469) 555-0287', email: 'jliu.tx@yahoo.com',   vehicle: '2018 Honda Pilot',           service: 'Check engine light',              source: 'Referral — RD',   value: 250,  followUp: 'Today',     status: 'New',       hot: true,  createdAt: '4 hr ago' },
    { id: 'L3', name: 'Cole Henderson',   phone: '(972) 555-0119', email: 'colehend@outlook.com', vehicle: '2020 Ram 1500',              service: 'Oil leak, plus 60k service',      source: 'Yelp',            value: 920,  followUp: 'Tomorrow',  status: 'Contacted', hot: false, createdAt: 'Yesterday' },
    { id: 'L4', name: 'Marisol Patton',   phone: '(214) 555-0144', email: 'mpatton@gmail.com',   vehicle: '2017 Mazda CX-5',            service: 'AC blowing warm',                 source: 'Facebook',        value: 380,  followUp: 'Tomorrow',  status: 'Contacted', hot: false, createdAt: 'Yesterday' },
    { id: 'L5', name: 'Tomas Rivera',     phone: '(469) 555-0193', email: 'trivera@gmail.com',   vehicle: '2016 BMW 328i',              service: 'Squeak on cold start',            source: 'Google',          value: 0,    followUp: 'Mon May 25',status: 'Contacted', hot: false, createdAt: '2 days ago' },
    { id: 'L6', name: 'WestSide Bakery',  phone: '(214) 555-0167', email: 'ops@westsidebake.com', vehicle: '2019 Ford E-350 box',        service: 'PM + brake inspection',           source: 'Cold outreach',   value: 1240, followUp: 'Thu May 28',status: 'Quoted',    hot: true,  createdAt: '3 days ago' },
    { id: 'L7', name: 'Greta Forsyth',    phone: '(972) 555-0238', email: 'gforsyth@gmail.com',  vehicle: '2014 Subaru Forester',       service: 'Suspension knock',                source: 'Referral — MW',   value: 540,  followUp: '—',         status: 'Quoted',    hot: false, createdAt: '4 days ago' },
    { id: 'L8', name: 'Curtis Beale',     phone: '(214) 555-0142', email: 'curtis.b@outlook.com', vehicle: '2021 Tesla Model Y',         service: 'Tire rotation + alignment',       source: 'Google',          value: 180,  followUp: 'Fri May 29',status: 'Scheduled', hot: false, createdAt: '5 days ago' },
    { id: 'L9', name: 'Maya Brooks',      phone: '(469) 555-0099', email: 'maya@brookspt.com',   vehicle: '2018 Toyota 4Runner',        service: 'Pre-purchase inspection',         source: 'Referral — HO',   value: 220,  followUp: 'Sat May 30',status: 'Scheduled', hot: false, createdAt: '1 wk ago' },
    { id: 'L10',name: 'Eli Park',         phone: '(214) 555-0177', email: 'epark.tx@gmail.com',  vehicle: '2013 Acura TL',              service: 'Misfire under load',              source: 'Google',          value: 720,  followUp: '—',         status: 'Won',       hot: false, createdAt: '1 wk ago' },
  ];

  const estimates = [
    { id: 'E1', no: 'EST-0145', customerId: 'c3', vehicleId: 'v6', date: '2026-05-19', expires: '2026-06-18', total: 1842.50, status: 'Sent',     sentDays: 1 },
    { id: 'E2', no: 'EST-0144', customerId: 'c6', vehicleId: 'v9', date: '2026-05-18', expires: '2026-06-17', total: 980.00,  status: 'Sent',     sentDays: 2 },
    { id: 'E3', no: 'EST-0143', customerId: 'c2', vehicleId: 'v3', date: '2026-05-17', expires: '2026-06-16', total: 412.50,  status: 'Approved', sentDays: 3 },
    { id: 'E4', no: 'EST-0142', customerId: 'c8', vehicleId: 'v11', date: '2026-05-15', expires: '2026-06-14', total: 1480.20, status: 'Approved', sentDays: 5 },
    { id: 'E5', no: 'EST-0141', customerId: 'c7', vehicleId: 'v10', date: '2026-05-14', expires: '2026-06-13', total: 642.80,  status: 'Draft',    sentDays: '—' },
    { id: 'E6', no: 'EST-0140', customerId: 'c1', vehicleId: 'v2', date: '2026-05-12', expires: '2026-06-11', total: 320.00,  status: 'Declined', sentDays: 8 },
    { id: 'E7', no: 'EST-0139', customerId: 'c4', vehicleId: 'v7', date: '2026-04-28', expires: '2026-05-28', total: 268.00,  status: 'Expired',  sentDays: 22 },
  ];

  const employees = [
    { id: 'E01', initials: 'BV', name: 'Brandon Vega',    color: 'amber',  role: 'Owner / Lead Tech', phone: '(214) 555-0100', email: 'brandon@wrenchpro.tx', rate: 75, jobs: 6, revenue: 4280.50, status: 'Active'  },
    { id: 'E02', initials: 'DR', name: 'Diego Ramirez',   color: 'blue',   role: 'Senior Technician', phone: '(214) 555-0143', email: 'diego@wrenchpro.tx',   rate: 38, jobs: 4, revenue: 2640.20, status: 'On job' },
    { id: 'E03', initials: 'KT', name: 'Kayla Tran',      color: 'rose',   role: 'Apprentice Tech',   phone: '(214) 555-0188', email: 'kayla@wrenchpro.tx',   rate: 22, jobs: 2, revenue: 880.00,  status: 'Active'  },
    { id: 'E04', initials: 'JM', name: 'Jordan Marshall', color: 'violet', role: 'Service Advisor',   phone: '(214) 555-0166', email: 'jordan@wrenchpro.tx',  rate: 28, jobs: 0, revenue: 0,       status: 'Off'    },
  ];

  const timeEntries = [
    { id: 't1',  emp: 'Diego Ramirez',   type: 'Repair',     in: '2026-05-20 09:38', out: null,                duration: 'In progress', job: 'WO-2041', notes: 'On-site brake job' },
    { id: 't2',  emp: 'Diego Ramirez',   type: 'Travel',     in: '2026-05-20 09:00', out: '2026-05-20 09:38', duration: '0:38',        job: 'WO-2041', notes: '' },
    { id: 't3',  emp: 'Brandon Vega',    type: 'Repair',     in: '2026-05-19 13:45', out: '2026-05-19 16:10', duration: '2:25',        job: 'WO-2037', notes: 'Coolant flush + thermostat' },
    { id: 't4',  emp: 'Diego Ramirez',   type: 'Repair',     in: '2026-05-19 09:15', out: '2026-05-19 13:30', duration: '4:15',        job: 'WO-2033', notes: 'Front brake job' },
    { id: 't5',  emp: 'Kayla Tran',      type: 'Admin',      in: '2026-05-19 14:00', out: '2026-05-19 16:00', duration: '2:00',        job: '—',       notes: 'Inventory cycle count' },
    { id: 't6',  emp: 'Brandon Vega',    type: 'Diagnostic', in: '2026-05-18 11:00', out: '2026-05-18 12:30', duration: '1:30',        job: 'WO-2036', notes: 'P0401 EGR diag' },
    { id: 't7',  emp: 'Diego Ramirez',   type: 'Repair',     in: '2026-05-18 14:00', out: '2026-05-18 15:10', duration: '1:10',        job: 'WO-2034', notes: 'Plugs + air filter' },
    { id: 't8',  emp: 'Brandon Vega',    type: 'Repair',     in: '2026-05-17 09:00', out: '2026-05-17 13:30', duration: '4:30',        job: 'WO-2032', notes: 'Timing belt + WP' },
  ];

  const plans = [
    { id: 'P1', customerId: 'c5', desc: 'Alternator + battery replacement', total: 720,  paid: 240,  remaining: 480,  installments: 4, paidCount: 1, nextDue: '2026-05-27', overdue: false, freq: 'Weekly' },
    { id: 'P2', customerId: 'c7', desc: 'Engine work — timing service',     total: 1240, paid: 620,  remaining: 620,  installments: 4, paidCount: 2, nextDue: '2026-05-30', overdue: false, freq: 'Bi-weekly' },
    { id: 'P3', customerId: 'c4', desc: 'Multiple repairs (Camry)',         total: 880,  paid: 220,  remaining: 660,  installments: 4, paidCount: 1, nextDue: '2026-05-12', overdue: true,  freq: 'Bi-weekly' },
    { id: 'P4', customerId: 'c1', desc: 'Timing belt + tires',              total: 1560, paid: 1560, remaining: 0,    installments: 4, paidCount: 4, nextDue: '—',         overdue: false, freq: 'Monthly', done: true },
  ];

  const payments = [
    { id: 'Y1', date: '2026-05-20', customerId: 'c2', desc: 'WO-2041 deposit',          method: 'Zelle',  amount: 200.00 },
    { id: 'Y2', date: '2026-05-19', customerId: 'c6', desc: 'WO-2037 — coolant flush',  method: 'Check',  amount: 178.45 },
    { id: 'Y3', date: '2026-05-19', customerId: 'c4', desc: 'WO-2036 — diagnostic',     method: 'Card',   amount: 198.50 },
    { id: 'Y4', date: '2026-05-18', customerId: 'c8', desc: 'WO-2035 — AC service',     method: 'Venmo',  amount: 203.40 },
    { id: 'Y5', date: '2026-05-18', customerId: 'c7', desc: 'WO-2034 — partial pmt',    method: 'Cash',   amount: 150.00 },
    { id: 'Y6', date: '2026-05-17', customerId: 'c3', desc: 'WO-2033 — Transit brakes', method: 'Check',  amount: 642.80 },
    { id: 'Y7', date: '2026-05-17', customerId: 'c1', desc: 'WO-2032 — timing belt',    method: 'Zelle',  amount: 921.10 },
    { id: 'Y8', date: '2026-05-16', customerId: 'c5', desc: 'P1 installment 1',         method: 'CashApp',amount: 240.00 },
    { id: 'Y9', date: '2026-05-15', customerId: 'c2', desc: 'Estimate deposit',         method: 'Card',   amount: 50.00 },
    { id: 'Y10', date: '2026-05-14', customerId: 'c8', desc: 'Tip',                     method: 'Cash',   amount: 30.00 },
  ];

  const expenses = [
    { id: 'X1', date: '2026-05-20', desc: 'Brake pads + rotors (Highlander)', category: 'Parts & supplies', amount: 184.50, vendor: 'AutoZone' },
    { id: 'X2', date: '2026-05-19', desc: 'Diesel for service van',           category: 'Fuel',             amount: 92.40,  vendor: 'Shell' },
    { id: 'X3', date: '2026-05-18', desc: 'Spark plugs (NGK iridium)',         category: 'Parts & supplies', amount: 64.99,  vendor: "O'Reilly" },
    { id: 'X4', date: '2026-05-17', desc: 'Liability insurance — May',         category: 'Insurance',        amount: 412.00, vendor: 'Progressive Commercial' },
    { id: 'X5', date: '2026-05-15', desc: 'Snap-on torque wrench',             category: 'Tools & equipment',amount: 348.00, vendor: 'Snap-on' },
    { id: 'X6', date: '2026-05-14', desc: 'Google Local Services ads',         category: 'Marketing',        amount: 220.00, vendor: 'Google' },
    { id: 'X7', date: '2026-05-12', desc: 'Coolant + thermostat',              category: 'Parts & supplies', amount: 88.75,  vendor: 'NAPA' },
    { id: 'X8', date: '2026-05-10', desc: 'Diesel for service van',            category: 'Fuel',             amount: 88.20,  vendor: 'Shell' },
    { id: 'X9', date: '2026-05-08', desc: 'Shop towels + nitrile gloves',      category: 'Other',            amount: 64.30,  vendor: 'Amazon Business' },
    { id: 'X10', date: '2026-05-05', desc: 'Snap-on diagnostic subscription',  category: 'Tools & equipment',amount: 79.00,  vendor: 'Snap-on' },
  ];

  const services = [
    { id: 'S1', name: 'Oil change — full synthetic (up to 6 qt)',    cat: 'Maintenance', hrs: 0.5, price: 89.99,  taxable: true, notes: 'Mobil 1 or equiv.' },
    { id: 'S2', name: 'Brake pad replacement — front axle',          cat: 'Brakes',      hrs: 1.5, price: 245.00, taxable: true, notes: 'Customer-supplied or shop' },
    { id: 'S3', name: 'Brake pad + rotor replacement — front axle',  cat: 'Brakes',      hrs: 2.0, price: 420.00, taxable: true, notes: '' },
    { id: 'S4', name: 'Tire rotation',                                cat: 'Maintenance', hrs: 0.3, price: 35.00,  taxable: true, notes: '' },
    { id: 'S5', name: 'Coolant flush',                                cat: 'Maintenance', hrs: 1.0, price: 145.00, taxable: true, notes: '' },
    { id: 'S6', name: 'Diagnostic scan + report',                     cat: 'Diagnostic',  hrs: 1.0, price: 99.00,  taxable: false,notes: 'Applied to repair if approved' },
    { id: 'S7', name: 'Alternator replacement',                       cat: 'Electrical',  hrs: 2.5, price: 395.00, taxable: true, notes: '' },
    { id: 'S8', name: 'Battery test + replacement',                   cat: 'Electrical',  hrs: 0.4, price: 180.00, taxable: true, notes: '' },
    { id: 'S9', name: 'Spark plug replacement — 4 cyl',               cat: 'Engine',      hrs: 1.0, price: 145.00, taxable: true, notes: '' },
    { id: 'S10', name: 'Timing belt + water pump',                    cat: 'Engine',      hrs: 4.5, price: 920.00, taxable: true, notes: 'Labor-intensive, confirm interval' },
    { id: 'S11', name: 'AC recharge (R-1234yf)',                      cat: 'HVAC',        hrs: 1.0, price: 165.00, taxable: true, notes: 'Per oz pricing varies' },
    { id: 'S12', name: 'Mobile trip / service fee',                   cat: 'Other',       hrs: 0,   price: 50.00,  taxable: false,notes: 'Standard within 30 mi' },
  ];

  const warranties = [
    { id: 'W1', customerId: 'c2', vehicleId: 'v3', desc: 'Front brake job (pads + rotors)', laborMo: 12, partsMo: 24, mileLimit: 12000, expires: '2027-05-17', status: 'Active'  },
    { id: 'W2', customerId: 'c3', vehicleId: 'v5', desc: 'Brake job + fluid flush',         laborMo: 12, partsMo: 12, mileLimit: 12000, expires: '2027-05-17', status: 'Active'  },
    { id: 'W3', customerId: 'c1', vehicleId: 'v2', desc: 'Timing belt + water pump',         laborMo: 24, partsMo: 36, mileLimit: 60000, expires: '2028-05-17', status: 'Active'  },
    { id: 'W4', customerId: 'c5', vehicleId: 'v8', desc: 'Alternator replacement',           laborMo: 12, partsMo: 24, mileLimit: 12000, expires: '—',          status: 'Pending' },
    { id: 'W5', customerId: 'c8', vehicleId: 'v11',desc: 'AC service',                       laborMo: 6,  partsMo: 12, mileLimit: 12000, expires: '2025-11-18', status: 'Expired' },
    { id: 'W6', customerId: 'c4', vehicleId: 'v7', desc: 'Diagnostic + EGR clean',           laborMo: 3,  partsMo: 6,  mileLimit: 3000,  expires: '2026-08-19', status: 'Active'  },
  ];

  return { leads, estimates, employees, timeEntries, plans, payments, expenses, services, warranties };
})();
