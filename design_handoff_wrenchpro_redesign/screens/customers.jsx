/* global React, DATA, fmt$0, Card, Avatar, Pill, Icons */

function Customers({ onOpen }) {
  const [q, setQ] = React.useState('');
  const filtered = DATA.customers.filter(c => {
    if (!q) return true;
    return `${c.name} ${c.phone} ${c.email} ${c.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Customers</div>
          <div className="page-sub">{DATA.customers.length} total · {DATA.customers.filter(c=>c.status==='VIP').length} VIP · {DATA.customers.filter(c=>c.type==='Fleet'||c.type==='Commercial').length} commercial</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> New customer</button>
        </div>
      </div>

      <Card pad={false}>
        <div style={{
          padding: 12,
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
            <input
              className="input" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search by name, phone, email, tag…"
              style={{ paddingLeft: 30 }}
            />
          </div>
          <select className="input" defaultValue="" style={{ width: 140 }}>
            <option value="">All types</option>
            <option>Personal</option><option>Fleet</option><option>Commercial</option><option>Dealership</option>
          </select>
          <select className="input" defaultValue="" style={{ width: 140 }}>
            <option value="">All statuses</option>
            <option>Active</option><option>VIP</option><option>Inactive</option><option>Prospect</option>
          </select>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Contact</th>
              <th className="col-num">Vehicles</th>
              <th className="col-num">Jobs</th>
              <th className="col-num">Lifetime value</th>
              <th>Last service</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const vehicles = DATA.vehicles.filter(v => v.customerId === c.id).length;
              const jobs = DATA.jobs.filter(j => j.customerId === c.id).length;
              return (
                <tr key={c.id} onClick={() => onOpen(c.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initials={c.initials} color={c.avatar}/>
                      <div>
                        <div className="strong">{c.name}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>Joined {c.joined}</div>
                      </div>
                    </div>
                  </td>
                  <td><Pill kind={c.type === 'Fleet' || c.type === 'Commercial' ? 'blue' : 'gray'}>{c.type}</Pill></td>
                  <td>
                    <div className="mono" style={{ fontSize: 12 }}>{c.phone}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{c.email}</div>
                  </td>
                  <td className="col-num mono">{vehicles}</td>
                  <td className="col-num mono">{jobs}</td>
                  <td className="col-num mono strong">{fmt$0(c.ltv)}</td>
                  <td className="muted">{c.lastSvc}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.status === 'VIP' && <Pill kind="accent">VIP</Pill>}
                      {c.tags.slice(0, 2).map(t => <span key={t} className="tag">#{t}</span>)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// Lightweight placeholder for screens we haven't built out in full detail
function ComingSoon({ title, subtitle, blurb }) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-sub">{subtitle}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary"><Icons.Plus size={14}/> New</button>
        </div>
      </div>
      <Card>
        <div className="empty" style={{ padding: '64px 24px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: 'var(--accent-soft)',
            color: 'var(--accent-fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <Icons.Wrench size={26}/>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>{title} screen</div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', maxWidth: 380, margin: '0 auto', lineHeight: 1.55 }}>
            {blurb}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 12 }}>
            The five most impactful screens (Dashboard, Jobs, Schedule, Customer, Inspections) are mocked in full detail. Tell me which others to expand next.
          </div>
        </div>
      </Card>
    </>
  );
}

window.Customers = Customers;
window.ComingSoon = ComingSoon;
