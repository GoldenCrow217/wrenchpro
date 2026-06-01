/* global React, Icons */

const NAV = [
  { section: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
  ]},
  { section: 'Pipeline', items: [
    { id: 'leads',     label: 'Leads',     icon: 'Lead',     badge: 4 },
    { id: 'estimates', label: 'Estimates', icon: 'Estimate', badge: 3 },
  ]},
  { section: 'Operations', items: [
    { id: 'jobs',        label: 'Jobs',         icon: 'Jobs',     badge: 12 },
    { id: 'schedule',    label: 'Schedule',     icon: 'Calendar' },
    { id: 'inspections', label: 'Inspections',  icon: 'Check' },
  ]},
  { section: 'Customers', items: [
    { id: 'customers', label: 'Customers', icon: 'Users' },
    { id: 'vehicles',  label: 'Vehicles',  icon: 'Car' },
  ]},
  { section: 'Resources', items: [
    { id: 'inventory',  label: 'Parts & Inventory', icon: 'Box',     badge: 1 },
    { id: 'catalog',    label: 'Service Catalog',   icon: 'Catalog' },
    { id: 'warranties', label: 'Warranties',        icon: 'Shield' },
  ]},
  { section: 'Team', items: [
    { id: 'employees', label: 'Employees',     icon: 'Badge' },
    { id: 'time',      label: 'Time Tracking', icon: 'Clock' },
  ]},
  { section: 'Finance', items: [
    { id: 'finance',  label: 'Payments',      icon: 'Dollar' },
    { id: 'plans',    label: 'Payment Plans', icon: 'Plan' },
    { id: 'expenses', label: 'Expenses',      icon: 'Expense' },
    { id: 'report',   label: 'P&L Report',    icon: 'Report' },
  ]},
  { section: 'Account', items: [
    { id: 'settings', label: 'Settings', icon: 'Settings' },
  ]},
];

function Sidebar({ active, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.7-2.7 2-2.6Z"/>
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">WrenchPro</span>
          <span className="brand-sub">v1.0.13</span>
        </div>
      </div>

      <div className="sidebar-scroll">
        {NAV.map(group => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map(item => {
              const I = Icons[item.icon];
              return (
                <div
                  key={item.id}
                  className={`nav-item${active === item.id ? ' active' : ''}`}
                  onClick={() => onNav(item.id)}
                  title={item.label}
                >
                  <span className="nav-icon"><I size={16} stroke={1.7} /></span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <span className="avatar avatar-amber" style={{ width: 28, height: 28, fontSize: 11 }}>BV</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>Brandon Vega</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Owner / Tech</div>
        </div>
        <button className="icon-btn" title="Menu"><Icons.More size={14}/></button>
      </div>
    </aside>
  );
}

function Topbar({ title, crumbs = [], actions, search = true, onSearchFocus }) {
  return (
    <div className="topbar">
      <div className="crumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <span>{c}</span>
            <span className="sep"><Icons.ChevRight size={12} /></span>
          </React.Fragment>
        ))}
        <span className="current">{title}</span>
      </div>
      {search && (
        <div className="topbar-search" onClick={onSearchFocus} style={{ cursor: 'text' }}>
          <Icons.Search size={14} />
          <input
            placeholder="Search customers, vehicles, jobs, VINs…"
            readOnly
            onFocus={(e) => { e.target.blur(); onSearchFocus && onSearchFocus(); }}
            style={{ cursor: 'text' }}
          />
          <kbd>⌘K</kbd>
        </div>
      )}
      <div className="topbar-actions">
        <button className="icon-btn" title="Notifications"><Icons.Bell size={16} /></button>
        {actions}
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
