/* global React, DATA, DATA2, Icons */

// Global ⌘K command palette
function CommandPalette({ onNav, onClose }) {
  const [q, setQ] = React.useState('');
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  // Build command list
  const commands = React.useMemo(() => {
    const nav = [
      { kind: 'nav', icon: 'Dashboard', label: 'Go to Dashboard', target: 'dashboard' },
      { kind: 'nav', icon: 'Lead',      label: 'Go to Leads',     target: 'leads' },
      { kind: 'nav', icon: 'Estimate',  label: 'Go to Estimates', target: 'estimates' },
      { kind: 'nav', icon: 'Jobs',      label: 'Go to Jobs',      target: 'jobs' },
      { kind: 'nav', icon: 'Calendar',  label: 'Go to Schedule',  target: 'schedule' },
      { kind: 'nav', icon: 'Check',     label: 'Go to Inspections', target: 'inspections' },
      { kind: 'nav', icon: 'Users',     label: 'Go to Customers', target: 'customers' },
      { kind: 'nav', icon: 'Car',       label: 'Go to Vehicles',  target: 'vehicles' },
      { kind: 'nav', icon: 'Box',       label: 'Go to Parts & Inventory', target: 'inventory' },
      { kind: 'nav', icon: 'Catalog',   label: 'Go to Service Catalog', target: 'catalog' },
      { kind: 'nav', icon: 'Shield',    label: 'Go to Warranties',target: 'warranties' },
      { kind: 'nav', icon: 'Badge',     label: 'Go to Employees', target: 'employees' },
      { kind: 'nav', icon: 'Clock',     label: 'Go to Time Tracking', target: 'time' },
      { kind: 'nav', icon: 'Dollar',    label: 'Go to Payments',  target: 'finance' },
      { kind: 'nav', icon: 'Plan',      label: 'Go to Payment Plans', target: 'plans' },
      { kind: 'nav', icon: 'Expense',   label: 'Go to Expenses',  target: 'expenses' },
      { kind: 'nav', icon: 'Report',    label: 'Go to P&L Report',target: 'report' },
      { kind: 'nav', icon: 'Settings',  label: 'Go to Settings',  target: 'settings' },
    ];
    const actions = [
      { kind: 'action', icon: 'Plus',  label: 'New job',        hint: 'WO' },
      { kind: 'action', icon: 'Plus',  label: 'New estimate',   hint: 'EST' },
      { kind: 'action', icon: 'Plus',  label: 'New customer',   hint: '' },
      { kind: 'action', icon: 'Plus',  label: 'New lead',       hint: '' },
      { kind: 'action', icon: 'Bolt',  label: 'Quick entry (historical job)', hint: '' },
      { kind: 'action', icon: 'Dollar',label: 'Record payment', hint: '' },
      { kind: 'action', icon: 'Check', label: 'New inspection', hint: '' },
    ];
    const customers = DATA.customers.map(c => ({ kind: 'customer', icon: 'Users', label: c.name, sub: `${c.type} · ${c.phone}`, c }));
    const jobs = DATA.jobs.slice(0, 6).map(j => ({ kind: 'job', icon: 'Jobs', label: `${j.no} — ${j.service}`, sub: j.date }));
    return [...nav, ...actions, ...customers, ...jobs];
  }, []);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands.slice(0, 8);
    return commands.filter(c =>
      c.label.toLowerCase().includes(needle) ||
      (c.sub && c.sub.toLowerCase().includes(needle))
    ).slice(0, 12);
  }, [q, commands]);

  React.useEffect(() => { setIdx(0); }, [q]);

  const onKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(filtered.length - 1, i + 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    if (e.key === 'Enter')     {
      e.preventDefault();
      const hit = filtered[idx];
      if (!hit) return;
      if (hit.kind === 'nav') { onNav(hit.target); onClose(); }
      else onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(20, 15, 8, 0.32)',
        display: 'flex', justifyContent: 'center',
        paddingTop: '12vh',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '92vw',
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(20, 15, 8, 0.25)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <Icons.Search size={18} style={{ color: 'var(--fg-faint)' }}/>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to anything — customers, jobs, screens, actions…"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--fg)',
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fg-faint)',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 6px',
          }}>esc</kbd>
        </div>

        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: '30px 16px' }}>No matches for "{q}"</div>
          ) : filtered.map((it, i) => {
            const I = Icons[it.icon];
            const active = i === idx;
            return (
              <div
                key={i}
                onMouseEnter={() => setIdx(i)}
                onClick={() => { if (it.kind === 'nav') onNav(it.target); onClose(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: active ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  color: active ? 'var(--accent-fg)' : 'var(--fg-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <I size={14}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{it.label}</div>
                  {it.sub && <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>{it.sub}</div>}
                </div>
                <span className="faint" style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                  fontWeight: 600,
                }}>
                  {it.kind === 'nav' ? 'Jump' : it.kind === 'action' ? 'Action' : it.kind === 'customer' ? 'Customer' : 'Job'}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          gap: 14,
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--fg-muted)',
        }}>
          <Kbd>↑</Kbd><Kbd>↓</Kbd><span>navigate</span>
          <Kbd>↵</Kbd><span>select</span>
          <Kbd>esc</Kbd><span>close</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }) {
  return <kbd style={{
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--fg-muted)',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '1px 5px',
    marginRight: -10,
  }}>{children}</kbd>;
}

window.CommandPalette = CommandPalette;
