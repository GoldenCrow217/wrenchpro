/* global React, DATA, DATA2, fmt$, fmt$0, Card, Pill, Avatar, Icons */

const LEAD_STAGES = [
  { id: 'New',       label: 'New',       color: 'var(--info)' },
  { id: 'Contacted', label: 'Contacted', color: 'var(--info)' },
  { id: 'Quoted',    label: 'Quoted',    color: 'var(--warning)' },
  { id: 'Scheduled', label: 'Scheduled', color: 'var(--accent)' },
  { id: 'Won',       label: 'Won',       color: 'var(--success)' },
  { id: 'Lost',      label: 'Lost',      color: 'var(--danger)' },
];

function Leads() {
  const [view, setView] = React.useState('board');
  const leads = DATA2.leads;
  const totalValue = leads.reduce((s, l) => s + l.value, 0);
  const hotCount = leads.filter(l => l.hot).length;
  const wonRate = Math.round(leads.filter(l => l.status === 'Won').length / leads.length * 100);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">{leads.length} active leads · {fmt$0(totalValue)} pipeline · {hotCount} marked hot</div>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button className={`btn btn-sm ${view === 'board' ? 'btn-primary' : ''}`} style={{ border: 'none', borderRadius: 0 }} onClick={() => setView('board')}>Board</button>
            <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : ''}`} style={{ border: 'none', borderRadius: 0, borderLeft: '1px solid var(--border)' }} onClick={() => setView('table')}>Table</button>
          </div>
          <button className="btn"><Icons.Filter size={14}/> Filters</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> New lead</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Open leads</div><div className="kpi-value">{leads.filter(l => !['Won','Lost'].includes(l.status)).length}</div><div className="kpi-meta">across 4 stages</div></div>
        <div className="kpi"><div className="kpi-label">Pipeline value</div><div className="kpi-value">{fmt$0(totalValue)}</div><div className="kpi-meta">est. avg ticket</div></div>
        <div className="kpi"><div className="kpi-label">Hot leads</div><div className="kpi-value">{hotCount}</div><div className="kpi-meta"><span className="kpi-delta up">action today</span></div></div>
        <div className="kpi"><div className="kpi-label">Win rate</div><div className="kpi-value">{wonRate}%</div><div className="kpi-meta">last 30 days</div></div>
      </div>

      {view === 'board' ? <LeadsBoard leads={leads}/> : <LeadsTable leads={leads}/>}
    </>
  );
}

function LeadsBoard({ leads }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
      gap: 12,
      minHeight: 'calc(100vh - 280px)',
    }}>
      {LEAD_STAGES.map(stage => {
        const items = leads.filter(l => l.status === stage.id);
        const val = items.reduce((s, l) => s + l.value, 0);
        return (
          <div key={stage.id} style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 10,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '2px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: stage.color }}/>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{stage.label}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{items.length}</span>
              </div>
              <span className="mono num" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{val > 0 ? fmt$0(val) : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(l => (
                <div key={l.id} style={{
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 10,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{l.name}</div>
                    {l.hot && <span style={{
                      fontSize: 9, fontWeight: 700, color: 'var(--danger-fg)',
                      background: 'var(--danger-soft)', padding: '1px 6px',
                      borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>Hot</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginBottom: 6, lineHeight: 1.35 }}>
                    {l.service}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginBottom: 8 }}>
                    {l.vehicle}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: 7, borderTop: '1px solid var(--border)',
                  }}>
                    <span className="mono num" style={{ fontSize: 12, fontWeight: 600 }}>
                      {l.value > 0 ? fmt$0(l.value) : <span className="muted">—</span>}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>
                      {l.followUp !== '—' ? `f/u ${l.followUp}` : l.source}
                    </span>
                  </div>
                </div>
              ))}
              <button style={{
                background: 'transparent',
                border: '1px dashed var(--border-strong)',
                borderRadius: 8,
                padding: '8px',
                fontSize: 12,
                color: 'var(--fg-faint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                cursor: 'pointer',
              }}>
                <Icons.Plus size={12}/> Add
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadsTable({ leads }) {
  return (
    <Card pad={false}>
      <table className="tbl">
        <thead><tr><th>Lead</th><th>Contact</th><th>Vehicle</th><th>Service</th><th>Source</th><th>Follow-up</th><th className="col-num">Value</th><th>Status</th></tr></thead>
        <tbody>
          {leads.map(l => (
            <tr key={l.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="strong">{l.name}</div>
                  {l.hot && <Pill kind="red">Hot</Pill>}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{l.createdAt}</div>
              </td>
              <td>
                <div className="mono" style={{ fontSize: 12 }}>{l.phone}</div>
                <div className="muted" style={{ fontSize: 11 }}>{l.email}</div>
              </td>
              <td>{l.vehicle}</td>
              <td>{l.service}</td>
              <td className="muted">{l.source}</td>
              <td className="muted">{l.followUp}</td>
              <td className="col-num mono strong">{l.value > 0 ? fmt$0(l.value) : '—'}</td>
              <td><Pill kind={({New:'blue',Contacted:'blue',Quoted:'amber',Scheduled:'accent',Won:'green',Lost:'red'})[l.status]} dot>{l.status}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

window.Leads = Leads;
