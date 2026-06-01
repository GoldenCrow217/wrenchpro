/* global React, DATA, byId, fmt$, fmt$0, Card, Avatar, JobStatusPill, InvoicePill, Pill, Icons */

function Customer({ customerId, onBack, onOpenJob }) {
  const c = byId(DATA.customers, customerId) || DATA.customers[2]; // default Pinnacle
  const vehicles = DATA.vehicles.filter(v => v.customerId === c.id);
  const history = DATA.jobs.filter(j => j.customerId === c.id);
  const [tab, setTab] = React.useState('overview');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <button className="btn btn-sm btn-ghost" onClick={onBack}><Icons.ChevLeft size={14}/> Customers</button>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar initials={c.initials} color={c.avatar} size="lg" />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{c.name}</h1>
              <Pill kind="accent">{c.status}</Pill>
              <Pill kind="gray">{c.type}</Pill>
              {c.tags.map(t => <span className="tag" key={t}>#{t}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 18, color: 'var(--fg-muted)', fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icons.Phone size={13}/><span className="mono">{c.phone}</span></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icons.Mail size={13}/>{c.email}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icons.Pin size={13}/>{c.addr}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm"><Icons.Phone size={13}/> Call</button>
            <button className="btn btn-sm"><Icons.Send size={13}/> Message</button>
            <button className="btn btn-sm"><Icons.Edit size={13}/> Edit</button>
            <button className="btn btn-primary btn-sm"><Icons.Plus size={13}/> New job</button>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { label: 'Lifetime value', value: fmt$0(c.ltv), accent: true },
            { label: 'Jobs completed', value: history.length },
            { label: 'Vehicles',       value: vehicles.length },
            { label: 'Last service',   value: c.lastSvc, small: true },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '14px 22px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <div className="label-up" style={{ marginBottom: 4 }}>{s.label}</div>
              <div style={{
                fontSize: s.small ? 15 : 22,
                fontWeight: 700,
                color: s.accent ? 'var(--accent)' : 'var(--fg)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        {[
          { id: 'overview',  label: 'Overview' },
          { id: 'vehicles',  label: `Vehicles (${vehicles.length})` },
          { id: 'history',   label: `Service history (${history.length})` },
          { id: 'crm',       label: 'CRM' },
          { id: 'invoices',  label: 'Invoices' },
          { id: 'warranties', label: 'Warranties' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: tab === t.id ? 'var(--fg)' : 'var(--fg-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Vehicles" right={<button className="btn btn-sm"><Icons.Plus size={12}/> Add vehicle</button>} pad={false}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 0 }}>
                {vehicles.map((v, i) => (
                  <div key={v.id} style={{
                    padding: 16,
                    borderRight: (i + 1) % 2 === 0 ? 'none' : '1px solid var(--border)',
                    borderBottom: i < vehicles.length - (vehicles.length % 2 || 2) ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{v.year} {v.make} {v.model}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{v.trim} · {v.engine}</div>
                      </div>
                      {v.miles >= v.oilDue - 3000 && <Pill kind="amber">Oil soon</Pill>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <span className="tag mono">{v.plate}</span>
                      <span className="tag mono">{(v.miles / 1000).toFixed(1)}k mi</span>
                      <span className="tag">{v.fuel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Recent service history" right={<span className="card-link" onClick={() => setTab('history')}>View all</span>} pad={false}>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Work order</th><th>Vehicle</th><th>Service</th><th className="col-num">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {history.slice(0, 5).map(j => {
                    const v = byId(DATA.vehicles, j.vehicleId);
                    const total = j.laborHrs * j.laborRate + j.parts + j.fee;
                    return (
                      <tr key={j.id} onClick={() => onOpenJob(j.id)}>
                        <td className="muted">{j.date}</td>
                        <td className="mono">{j.no}</td>
                        <td>{v.year} {v.make} {v.model}</td>
                        <td>{j.service}</td>
                        <td className="col-num mono strong">{fmt$(total)}</td>
                        <td><JobStatusPill status={j.status}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Interactions" right={<button className="btn btn-sm"><Icons.Plus size={12}/> Log</button>} pad={false}>
              <div>
                {[
                  { icon: 'Phone', kind: 'amber', who: 'Owner', what: 'Confirmed Sprinter PM for 11:45 today', t: '14 hr ago' },
                  { icon: 'Mail',  kind: 'blue',  who: 'System', what: 'Invoice WO-2033 sent', t: '3 days ago' },
                  { icon: 'Phone', kind: 'amber', who: 'Diego R.', what: 'Discussed brake job estimate for Transit', t: '5 days ago' },
                  { icon: 'Note',  kind: 'gray',  who: 'Owner', what: 'Customer requested quarterly service reminders', t: '1 mo ago' },
                ].map((it, i, arr) => {
                  const I = Icons[it.icon];
                  const bg = { amber: 'var(--warning-soft)', blue: 'var(--info-soft)', gray: 'var(--neutral-soft)' }[it.kind];
                  const fg = { amber: 'var(--warning-fg)', blue: 'var(--info-fg)', gray: 'var(--neutral-fg)' }[it.kind];
                  return (
                    <div key={i} style={{
                      display: 'flex', gap: 10, padding: '11px 16px',
                      borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
                    }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <I size={13}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5 }}>{it.what}</div>
                        <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{it.who} · {it.t}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Reminders" sub="Upcoming follow-ups" pad={false}>
              <div>
                {[
                  { what: 'Sprinter — next oil due', when: '~ 2,700 mi', urgent: false },
                  { what: 'Transit 250 — 90k service', when: 'Aug 2026', urgent: false },
                  { what: 'Annual safety inspection', when: 'Overdue 11 days', urgent: true },
                ].map((r, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
                    borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
                  }}>
                    <Icons.Clock size={14} style={{ color: r.urgent ? 'var(--danger)' : 'var(--fg-muted)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5 }}>{r.what}</div>
                      <div style={{ fontSize: 11, marginTop: 2, color: r.urgent ? 'var(--danger-fg)' : 'var(--fg-muted)', fontWeight: r.urgent ? 600 : 400 }}>{r.when}</div>
                    </div>
                    <button className="btn btn-sm btn-ghost">Snooze</button>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Notes">
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
                Net-30 billing. Send all invoices to <span style={{ color: 'var(--fg)' }}>ar@pinnaclelogistics.com</span> on the 1st of each month. Prefers Diego R. as lead technician on the Sprinter fleet. Has a gated lot — check in at security with photo ID.
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab !== 'overview' && (
        <Card>
          <div className="empty">
            <Icons.Wrench size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>"{tab}" tab — content shown when this section is active.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Switch back to Overview to see the full profile mock.</div>
          </div>
        </Card>
      )}
    </>
  );
}

window.Customer = Customer;
