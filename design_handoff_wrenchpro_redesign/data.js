/* ============================================================
   WrenchPro — Mock data
   Realistic mobile-mechanic data: F-150s, Sprinter vans, Camrys,
   real-sounding part numbers, Dallas-area addresses.
   ============================================================ */

window.DATA = (function () {
  const customers = [
    { id: 'c1', name: 'Marcus Whitfield', type: 'Personal', phone: '(214) 555-0142', email: 'marcus.w@gmail.com', addr: '4128 Belmont Ave, Dallas, TX', city: 'Dallas', initials: 'MW', avatar: 'blue', tags: ['referral', 'oil-svc'], status: 'Active', ltv: 4280, joined: '2022-03', lastSvc: '12 days ago' },
    { id: 'c2', name: 'Reina Delgado', type: 'Personal', phone: '(972) 555-0118', email: 'reina.d@yahoo.com', addr: '882 Pin Oak Dr, Plano, TX', city: 'Plano', initials: 'RD', avatar: 'rose', tags: ['vip'], status: 'VIP', ltv: 9540, joined: '2021-08', lastSvc: '3 days ago' },
    { id: 'c3', name: 'Pinnacle Logistics LLC', type: 'Fleet', phone: '(469) 555-0193', email: 'fleet@pinnaclelogistics.com', addr: '2200 Empire Central, Dallas, TX', city: 'Dallas', initials: 'PL', avatar: 'violet', tags: ['fleet', 'priority'], status: 'Active', ltv: 22680, joined: '2020-11', lastSvc: '1 day ago' },
    { id: 'c4', name: 'Devon Park', type: 'Personal', phone: '(214) 555-0107', email: 'dpark@outlook.com', addr: '5114 Live Oak St, Dallas, TX', city: 'Dallas', initials: 'DP', avatar: 'green', tags: [], status: 'Active', ltv: 1240, joined: '2024-01', lastSvc: '34 days ago' },
    { id: 'c5', name: 'Sofia Aguilar', type: 'Personal', phone: '(214) 555-0166', email: 'sofiaag@gmail.com', addr: '1809 Greenville Ave, Dallas, TX', city: 'Dallas', initials: 'SA', avatar: 'amber', tags: ['cash'], status: 'Active', ltv: 880, joined: '2024-09', lastSvc: '8 days ago' },
    { id: 'c6', name: 'Bayside Plumbing', type: 'Commercial', phone: '(972) 555-0144', email: 'service@baysideplumbing.tx', addr: '700 N Central Expy, Richardson, TX', city: 'Richardson', initials: 'BP', avatar: 'blue', tags: ['fleet', 'monthly-inv'], status: 'Active', ltv: 11430, joined: '2022-06', lastSvc: '6 days ago' },
    { id: 'c7', name: 'Tyler Brennan', type: 'Personal', phone: '(214) 555-0179', email: 'tyler.brennan@gmail.com', addr: '3215 Knight St, Dallas, TX', city: 'Dallas', initials: 'TB', avatar: 'violet', tags: [], status: 'Active', ltv: 1620, joined: '2023-11', lastSvc: '21 days ago' },
    { id: 'c8', name: 'Helen Okafor', type: 'Personal', phone: '(469) 555-0151', email: 'hokafor.dvm@gmail.com', addr: '6601 Hillcrest Ave, University Park, TX', city: 'University Park', initials: 'HO', avatar: 'rose', tags: ['referral'], status: 'Active', ltv: 3210, joined: '2023-02', lastSvc: '47 days ago' },
  ];

  const vehicles = [
    { id: 'v1', customerId: 'c1', year: 2018, make: 'Ford', model: 'F-150', trim: 'XLT SuperCrew', engine: '5.0L V8', plate: 'KZX-4421', state: 'TX', vin: '1FTEW1EP5JKF12345', miles: 92400, oilDue: 95000, fuel: 'Gasoline', color: 'Magnetic Gray' },
    { id: 'v2', customerId: 'c1', year: 2014, make: 'Honda', model: 'Civic', trim: 'EX', engine: '1.8L I4', plate: 'BNR-9012', state: 'TX', vin: '2HGFB2F58EH123456', miles: 138210, oilDue: 142000, fuel: 'Gasoline', color: 'White' },
    { id: 'v3', customerId: 'c2', year: 2021, make: 'Toyota', model: 'Highlander', trim: 'XLE AWD', engine: '3.5L V6', plate: 'TLR-0834', state: 'TX', vin: '5TDGZRBH7MS123456', miles: 48700, oilDue: 53000, fuel: 'Gasoline', color: 'Blueprint' },
    { id: 'v4', customerId: 'c3', year: 2020, make: 'Mercedes', model: 'Sprinter 2500', trim: '170 WB', engine: '3.0L V6 TD', plate: 'CMR-7791', state: 'TX', vin: 'WD3PE8CD0LP123456', miles: 184320, oilDue: 187000, fuel: 'Diesel', color: 'Arctic White' },
    { id: 'v5', customerId: 'c3', year: 2019, make: 'Ford', model: 'Transit 250', trim: 'Med Roof', engine: '3.5L V6 EcoBoost', plate: 'CMR-7792', state: 'TX', vin: '1FTBR1Y84KKB12345', miles: 152610, oilDue: 156000, fuel: 'Gasoline', color: 'Oxford White' },
    { id: 'v6', customerId: 'c3', year: 2021, make: 'Ford', model: 'Transit 250', trim: 'High Roof', engine: '3.5L V6 EcoBoost', plate: 'CMR-7793', state: 'TX', vin: '1FTBR1Y90MKA12345', miles: 89320, oilDue: 93000, fuel: 'Gasoline', color: 'Oxford White' },
    { id: 'v7', customerId: 'c4', year: 2016, make: 'Toyota', model: 'Camry', trim: 'SE', engine: '2.5L I4', plate: 'PFG-2218', state: 'TX', vin: '4T1BF1FK3GU123456', miles: 116450, oilDue: 119000, fuel: 'Gasoline', color: 'Silver' },
    { id: 'v8', customerId: 'c5', year: 2013, make: 'Nissan', model: 'Altima', trim: 'S', engine: '2.5L I4', plate: 'JHQ-5510', state: 'TX', vin: '1N4AL3AP7DC123456', miles: 184220, oilDue: 185000, fuel: 'Gasoline', color: 'Storm Blue' },
    { id: 'v9', customerId: 'c6', year: 2019, make: 'Ram', model: 'ProMaster 1500', trim: 'Cargo', engine: '3.6L V6', plate: 'BSP-0042', state: 'TX', vin: '3C6TRVAG4KE123456', miles: 142800, oilDue: 145000, fuel: 'Gasoline', color: 'Bright White' },
    { id: 'v10', customerId: 'c7', year: 2020, make: 'Subaru', model: 'Outback', trim: 'Premium', engine: '2.5L H4', plate: 'TVR-1187', state: 'TX', vin: '4S4BTACC5L3123456', miles: 64300, oilDue: 68000, fuel: 'Gasoline', color: 'Magnetite Gray' },
    { id: 'v11', customerId: 'c8', year: 2017, make: 'Lexus', model: 'RX 350', trim: 'Base', engine: '3.5L V6', plate: 'HKO-0301', state: 'TX', vin: '2T2BZMCA4HC123456', miles: 88450, oilDue: 92000, fuel: 'Gasoline', color: 'Eminent White Pearl' },
  ];

  const jobs = [
    { id: 'j2041', no: 'WO-2041', date: '2026-05-20', customerId: 'c2', vehicleId: 'v3', service: 'Brake pads + rotors (front)', complaint: 'Grinding noise on stops, vibration through pedal', assignedTo: 'Diego R.', laborHrs: 1.8, laborRate: 75, parts: 184.50, fee: 50, status: 'In Progress', invStatus: 'Unpaid', mileage: 48700, eta: '2:30 PM', addr: '882 Pin Oak Dr, Plano, TX' },
    { id: 'j2040', no: 'WO-2040', date: '2026-05-20', customerId: 'c3', vehicleId: 'v4', service: 'Diesel oil + fuel filters', complaint: 'Scheduled fleet PM', assignedTo: 'Owner', laborHrs: 1.2, laborRate: 65, parts: 142.30, fee: 50, status: 'En Route', invStatus: 'Unpaid', mileage: 184320, eta: '11:45 AM', addr: '2200 Empire Central, Dallas, TX' },
    { id: 'j2039', no: 'WO-2039', date: '2026-05-20', customerId: 'c5', vehicleId: 'v8', service: 'Alternator replacement', complaint: 'Battery light on, slow crank', assignedTo: 'Diego R.', laborHrs: 2.5, laborRate: 75, parts: 286.00, fee: 50, status: 'Waiting on Parts', invStatus: 'Unpaid', mileage: 184220, eta: '—', addr: '1809 Greenville Ave, Dallas, TX' },
    { id: 'j2038', no: 'WO-2038', date: '2026-05-20', customerId: 'c1', vehicleId: 'v1', service: 'Oil & filter, tire rotation', complaint: '5,000 mi service', assignedTo: 'Owner', laborHrs: 0.6, laborRate: 75, parts: 64.20, fee: 50, status: 'Confirmed', invStatus: 'Unpaid', mileage: 92400, eta: '4:00 PM', addr: '4128 Belmont Ave, Dallas, TX' },
    { id: 'j2037', no: 'WO-2037', date: '2026-05-19', customerId: 'c6', vehicleId: 'v9', service: 'Coolant flush + thermostat', complaint: 'Running hot in afternoon', assignedTo: 'Diego R.', laborHrs: 1.4, laborRate: 65, parts: 88.75, fee: 0, status: 'Complete', invStatus: 'Paid', mileage: 142800, eta: '—', addr: '700 N Central Expy, Richardson, TX' },
    { id: 'j2036', no: 'WO-2036', date: '2026-05-19', customerId: 'c4', vehicleId: 'v7', service: 'Diagnostic + EGR clean', complaint: 'CEL on, code P0401', assignedTo: 'Owner', laborHrs: 1.5, laborRate: 99, parts: 0, fee: 50, status: 'Complete', invStatus: 'Paid', mileage: 116450, eta: '—', addr: '5114 Live Oak St, Dallas, TX' },
    { id: 'j2035', no: 'WO-2035', date: '2026-05-18', customerId: 'c8', vehicleId: 'v11', service: 'AC recharge + condenser inspect', complaint: 'Blowing warm', assignedTo: 'Owner', laborHrs: 1.0, laborRate: 75, parts: 78.40, fee: 50, status: 'Complete', invStatus: 'Paid', mileage: 88450, eta: '—', addr: '6601 Hillcrest Ave, University Park, TX' },
    { id: 'j2034', no: 'WO-2034', date: '2026-05-18', customerId: 'c7', vehicleId: 'v10', service: 'Spark plugs (4) + air filter', complaint: 'Rough idle', assignedTo: 'Diego R.', laborHrs: 1.1, laborRate: 75, parts: 92.10, fee: 50, status: 'Complete', invStatus: 'Partial', mileage: 64300, eta: '—', addr: '3215 Knight St, Dallas, TX' },
    { id: 'j2033', no: 'WO-2033', date: '2026-05-17', customerId: 'c3', vehicleId: 'v5', service: 'Front brake job + flush', complaint: 'Soft pedal, due for service', assignedTo: 'Diego R.', laborHrs: 2.4, laborRate: 65, parts: 312.80, fee: 0, status: 'Complete', invStatus: 'Paid', mileage: 152610, eta: '—', addr: '2200 Empire Central, Dallas, TX' },
    { id: 'j2032', no: 'WO-2032', date: '2026-05-17', customerId: 'c1', vehicleId: 'v2', service: 'Timing belt + water pump', complaint: 'At interval', assignedTo: 'Owner', laborHrs: 4.5, laborRate: 75, parts: 421.60, fee: 50, status: 'Complete', invStatus: 'Paid', mileage: 138210, eta: '—', addr: '4128 Belmont Ave, Dallas, TX' },
  ];

  const inspectionCategories = [
    { name: 'Engine bay', items: [
      { name: 'Engine oil level & condition', status: 'pass' },
      { name: 'Coolant level & condition', status: 'pass' },
      { name: 'Power steering fluid', status: 'advisory', note: 'Slightly dark — flush at next service' },
      { name: 'Brake fluid level', status: 'pass' },
      { name: 'Belts (serpentine, accessory)', status: 'advisory', note: 'Cracking visible, est. 5k mi remaining' },
      { name: 'Hoses (radiator, heater)', status: 'pass' },
      { name: 'Battery terminals & cables', status: 'pass' },
      { name: 'Air filter', status: 'fail', note: 'Severely clogged — replace immediately' },
    ]},
    { name: 'Brakes', items: [
      { name: 'Front brake pads (thickness)', status: 'pass', note: '8mm remaining' },
      { name: 'Rear brake pads (thickness)', status: 'advisory', note: '4mm remaining — plan replacement' },
      { name: 'Front rotors', status: 'pass' },
      { name: 'Rear rotors', status: 'pass' },
      { name: 'Brake lines & hoses', status: 'pass' },
      { name: 'Parking brake operation', status: 'pass' },
    ]},
    { name: 'Tires & wheels', items: [
      { name: 'Tread depth — LF', status: 'pass', note: '7/32"' },
      { name: 'Tread depth — RF', status: 'pass', note: '7/32"' },
      { name: 'Tread depth — LR', status: 'advisory', note: '4/32" — uneven wear, recommend rotation' },
      { name: 'Tread depth — RR', status: 'advisory', note: '4/32"' },
      { name: 'Tire pressure (all four)', status: 'pass' },
      { name: 'Wheel bearings & noise', status: 'pass' },
    ]},
    { name: 'Suspension & steering', items: [
      { name: 'Shocks / struts', status: 'pass' },
      { name: 'Control arms & bushings', status: 'pass' },
      { name: 'Tie rod ends', status: 'advisory', note: 'Inner driver-side has slight play' },
      { name: 'Ball joints', status: 'pass' },
      { name: 'Sway bar links', status: 'pass' },
    ]},
    { name: 'Lights & electrical', items: [
      { name: 'Headlights (low/high)', status: 'pass' },
      { name: 'Tail & brake lights', status: 'pass' },
      { name: 'Turn signals (all)', status: 'fail', note: 'Right rear out — bulb 7440' },
      { name: 'License plate light', status: 'pass' },
      { name: 'Interior lights', status: 'pass' },
      { name: 'Battery test (CCA)', status: 'pass', note: '612 CCA / 650 rated' },
    ]},
  ];

  const parts = [
    { id: 'p1', name: 'Brake pads — F-150 front (ceramic)', sku: 'BP-F150-FC', vendor: 'AutoZone', cost: 38.40, retail: 89.99, qty: 6, reorder: 4, location: 'Van A1' },
    { id: 'p2', name: 'Oil filter — Toyota 2.5L', sku: 'OF-TOY-25', vendor: 'NAPA', cost: 6.20, retail: 14.99, qty: 12, reorder: 6, location: 'Van A2' },
    { id: 'p3', name: 'Mobil 1 Full Synth 5W-30 (1 qt)', sku: 'OIL-M1-530', vendor: 'Walmart', cost: 7.10, retail: 12.50, qty: 28, reorder: 12, location: 'Van B3' },
    { id: 'p4', name: 'Sprinter fuel filter assembly', sku: 'FF-SPR-30', vendor: 'Bosch', cost: 42.80, retail: 98.00, qty: 2, reorder: 3, location: 'Van A4', low: true },
    { id: 'p5', name: 'Spark plugs — NGK iridium (4-pk)', sku: 'SP-NGK-IX-4', vendor: 'O\'Reilly', cost: 28.40, retail: 64.99, qty: 5, reorder: 4, location: 'Van A2' },
  ];

  const appointments = [
    { day: 1, h: 8, len: 1.5, title: 'Whitfield — Oil & rotate', vehicle: 'F-150', addr: 'Belmont Ave', color: 'amber' },
    { day: 1, h: 10, len: 2.5, title: 'Pinnacle — Sprinter PM', vehicle: 'Sprinter 2500', addr: 'Empire Central', color: 'blue' },
    { day: 1, h: 14, len: 2, title: 'Delgado — Front brakes', vehicle: 'Highlander', addr: 'Plano', color: 'green' },
    { day: 2, h: 9, len: 1, title: 'Aguilar — Diagnostic', vehicle: 'Altima', addr: 'Greenville Ave', color: 'amber' },
    { day: 2, h: 11, len: 3, title: 'Pinnacle — Brake job (Transit)', vehicle: 'Transit 250', addr: 'Empire Central', color: 'blue' },
    { day: 2, h: 15, len: 1.5, title: 'Park — Diagnostic', vehicle: 'Camry', addr: 'Live Oak St', color: 'green' },
    { day: 3, h: 8.5, len: 2, title: 'Okafor — AC service', vehicle: 'RX 350', addr: 'Hillcrest Ave', color: 'amber' },
    { day: 3, h: 13, len: 4, title: 'Brennan — Timing belt', vehicle: 'Outback', addr: 'Knight St', color: 'violet' },
    { day: 4, h: 9, len: 1, title: 'Bayside — Oil change', vehicle: 'ProMaster', addr: 'Richardson', color: 'blue' },
    { day: 4, h: 10.5, len: 2.5, title: 'Whitfield — Civic timing', vehicle: 'Civic', addr: 'Belmont Ave', color: 'amber' },
    { day: 4, h: 14, len: 1.5, title: 'Aguilar — Alternator pickup', vehicle: 'Altima', addr: 'Greenville Ave', color: 'green' },
    { day: 0, h: 10, len: 2, title: 'Walk-in — Pre-purchase insp.', vehicle: 'Tacoma (2017)', addr: 'Shop', color: 'rose' },
  ];

  const activity = [
    { t: '9 min ago', who: 'Diego R.', what: 'updated WO-2041 to In Progress', kind: 'job' },
    { t: '24 min ago', who: 'Owner', what: 'recorded $620 payment from R. Delgado', kind: 'pmt' },
    { t: '1 hr ago', who: 'System', what: 'low-stock alert — Sprinter fuel filter (2 left)', kind: 'alert' },
    { t: '2 hr ago', who: 'Owner', what: 'created estimate EST-0142 for Pinnacle Logistics', kind: 'est' },
    { t: 'Yesterday', who: 'Diego R.', what: 'completed WO-2037 (Bayside Plumbing)', kind: 'job' },
    { t: 'Yesterday', who: 'Owner', what: 'added vehicle 2014 Civic to M. Whitfield', kind: 'veh' },
  ];

  return { customers, vehicles, jobs, inspectionCategories, parts, appointments, activity };
})();

window.byId = function (arr, id) { return arr.find(x => x.id === id); };
window.fmt$ = function (n) {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
window.fmt$0 = function (n) {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
};
