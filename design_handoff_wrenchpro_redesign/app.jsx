/* global React, ReactDOM,
   Sidebar, Topbar, Dashboard, Jobs, Schedule, Customers, Customer, Inspection,
   Leads, Estimates, Vehicles, Inventory, Catalog, Warranties,
   Employees, TimeTracking, Payments, PaymentPlans, Expenses, Report, Settings,
   CommandPalette, ComingSoon, Icons,
   useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "daylight",
  "accent": "amber",
  "density": "comfortable",
  "sidebar": "labeled"
}/*EDITMODE-END*/;

function App() {
  const [page, setPage] = React.useState('dashboard');
  const [jobId, setJobId] = React.useState('j2041');
  const [customerId, setCustomerId] = React.useState('c3');
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply theme tokens to <html>
  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme',   t.theme);
    root.setAttribute('data-accent',  t.accent);
    root.setAttribute('data-density', t.density);
    root.setAttribute('data-sidebar', t.sidebar);
  }, [t]);

  // ⌘K / Ctrl+K global shortcut
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const headers = {
    dashboard:   { title: 'Dashboard',   crumbs: [] },
    leads:       { title: 'Leads',       crumbs: ['Pipeline'] },
    estimates:   { title: 'Estimates',   crumbs: ['Pipeline'] },
    jobs:        { title: 'Jobs',        crumbs: ['Operations'] },
    schedule:    { title: 'Schedule',    crumbs: ['Operations'] },
    inspections: { title: 'Inspections', crumbs: ['Operations'] },
    customers:   { title: 'Customers',   crumbs: ['Customers'] },
    vehicles:    { title: 'Vehicles',    crumbs: ['Customers'] },
    inventory:   { title: 'Parts & Inventory', crumbs: ['Resources'] },
    catalog:     { title: 'Service Catalog',   crumbs: ['Resources'] },
    warranties:  { title: 'Warranties',  crumbs: ['Resources'] },
    employees:   { title: 'Employees',   crumbs: ['Team'] },
    time:        { title: 'Time Tracking', crumbs: ['Team'] },
    finance:     { title: 'Payments',    crumbs: ['Finance'] },
    plans:       { title: 'Payment Plans', crumbs: ['Finance'] },
    expenses:    { title: 'Expenses',    crumbs: ['Finance'] },
    report:      { title: 'P&L Report',  crumbs: ['Finance'] },
    settings:    { title: 'Settings',    crumbs: ['Account'] },
    'customer-detail': { title: 'Customer detail', crumbs: ['Customers'] },
  };
  const head = headers[page] || { title: page, crumbs: [] };

  // Page renderer
  let body;
  switch (page) {
    case 'dashboard':
      body = <Dashboard onNav={setPage} onOpenJob={(id) => { setJobId(id); setPage('jobs'); }}/>;
      break;
    case 'leads':       body = <Leads/>; break;
    case 'estimates':   body = <Estimates/>; break;
    case 'jobs':        body = <Jobs selectedId={jobId} onSelect={setJobId}/>; break;
    case 'schedule':    body = <Schedule/>; break;
    case 'inspections': body = <Inspection/>; break;
    case 'customers':   body = <Customers onOpen={(id) => { setCustomerId(id); setPage('customer-detail'); }}/>; break;
    case 'customer-detail':
      body = <Customer customerId={customerId} onBack={() => setPage('customers')} onOpenJob={(id) => { setJobId(id); setPage('jobs'); }}/>;
      break;
    case 'vehicles':   body = <Vehicles/>; break;
    case 'inventory':  body = <Inventory/>; break;
    case 'catalog':    body = <Catalog/>; break;
    case 'warranties': body = <Warranties/>; break;
    case 'employees':  body = <Employees/>; break;
    case 'time':       body = <TimeTracking/>; break;
    case 'finance':    body = <Payments/>; break;
    case 'plans':      body = <PaymentPlans/>; break;
    case 'expenses':   body = <Expenses/>; break;
    case 'report':     body = <Report/>; break;
    case 'settings':   body = <Settings/>; break;
    default:
      body = <ComingSoon title={head.title} subtitle="Mock not yet expanded" blurb="Tell me which screen to expand next."/>;
  }

  // Top action button per page
  const topAction = (() => {
    const map = {
      jobs:        { icon: 'Plus', label: 'New job' },
      schedule:    { icon: 'Plus', label: 'New appointment' },
      customers:   { icon: 'Plus', label: 'New customer' },
      vehicles:    { icon: 'Plus', label: 'Add vehicle' },
      inspections: { icon: 'Plus', label: 'New inspection' },
      leads:       { icon: 'Plus', label: 'New lead' },
      estimates:   { icon: 'Plus', label: 'New estimate' },
      inventory:   { icon: 'Plus', label: 'Add part' },
      catalog:     { icon: 'Plus', label: 'Add service' },
      warranties:  { icon: 'Plus', label: 'New warranty' },
      employees:   { icon: 'Plus', label: 'Add employee' },
      time:        { icon: 'Bolt', label: 'Clock in' },
      finance:     { icon: 'Plus', label: 'Record payment' },
      plans:       { icon: 'Plus', label: 'New plan' },
      expenses:    { icon: 'Plus', label: 'Add expense' },
    };
    const m = map[page];
    if (!m) return null;
    const I = Icons[m.icon];
    return <button className="btn btn-primary btn-sm"><I size={13}/> {m.label}</button>;
  })();

  return (
    <div className="app">
      <Sidebar active={page === 'customer-detail' ? 'customers' : page} onNav={setPage}/>
      <div className="main">
        <Topbar
          title={head.title}
          crumbs={head.crumbs}
          actions={topAction}
          onSearchFocus={() => setCmdOpen(true)}
        />
        <div className="content">
          {body}
        </div>
      </div>

      {cmdOpen && (
        <CommandPalette
          onNav={(p) => setPage(p)}
          onClose={() => setCmdOpen(false)}
        />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio
            label="Mode"
            value={t.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'daylight', label: 'Daylight' },
              { value: 'garage',   label: 'Garage (dark)' },
            ]}
          />
          <TweakSelect
            label="Accent color"
            value={t.accent}
            onChange={(v) => setTweak('accent', v)}
            options={[
              { value: 'amber',  label: 'Amber (shop)' },
              { value: 'blue',   label: 'Blue (classic)' },
              { value: 'green',  label: 'Green (cash)' },
              { value: 'violet', label: 'Violet' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact',     label: 'Compact' },
            ]}
          />
          <TweakRadio
            label="Sidebar"
            value={t.sidebar}
            onChange={(v) => setTweak('sidebar', v)}
            options={[
              { value: 'labeled', label: 'Labels' },
              { value: 'icon',    label: 'Icons only' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
