/* global React, DATA, byId, fmt$, fmt$0, Card, JobStatusPill, InvoicePill, Avatar, Icons */

const JOB_BOARD_STAGES = [
  { id: 'Pending',          color: 'var(--neutral-fg)',  soft: 'var(--neutral-soft)' },
  { id: 'Confirmed',        color: 'var(--info-fg)',     soft: 'var(--info-soft)' },
  { id: 'En Route',         color: 'var(--warning-fg)',  soft: 'var(--warning-soft)' },
  { id: 'In Progress',      color: 'var(--accent-fg)',   soft: 'var(--accent-soft)' },
  { id: 'Waiting on Parts', color: 'var(--warning-fg)',  soft: 'var(--warning-soft)' },
  { id: 'Complete',         color: 'var(--success-fg)',  soft: 'var(--success-soft)' },
];

function Jobs({ selectedId, onSelect }) {
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [view, setView] = React.useState('table');

  const filtered = DATA.jobs.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (!q) return true;
    const c = byId(DATA.customers, j.customerId);
    const v = byId(DATA.vehicles, j.vehicleId);
    const hay = `${j.no} ${j.service} ${c.name} ${v.year} ${v.make} ${v.model}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const selected = byId(DATA.jobs, selectedId);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Jobs</div>
          <div className="page-sub">{filtered.length} of {DATA.jobs.length} · {DATA.jobs.filter(j=>j.status==='In Progress').length} in progress · {DATA.jobs.filter(j=>j.status==='Waiting on Parts').length} waiting</div>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : ''}`} style={{ border: 'none', borderRadius: 0 }} onClick={() => setView('table')}>Table</button>
            <button className={`btn btn-sm ${view === 'board' ? 'btn-primary' : ''}`} style={{ border: 'none', borderRadius: 0, borderLeft: '1px solid var(--border)' }} onClick={() => setView('board')}>Board</button>
          </div>
          <button className="btn"><Icons.Filter size={14}/> Filters</button>
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> New job</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedId && view === 'table' ? '1.4fr 1fr' : '1fr', gap: 16, alignItems: 'flex-start' }}>
        {view === 'table' ? (
          <>
          <Card pad={false}>
          <div style={{
            padding: 12,
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elev)',
            flexWrap: 'wrap',
          }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
              <input
                className="input" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search WO, customer, vehicle, VIN…"
                style={{ paddingLeft: 30 }}
              />
            </div>
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
              <option value="">All statuses</option>
              {Object.keys({Pending:1, Confirmed:1, 'En Route':1, 'In Progress':1, 'Waiting on Parts':1, Complete:1, Canceled:1}).map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="input" defaultValue="" style={{ width: 140 }}>
              <option value="">All technicians</option>
              <option>Owner</option><option>Diego R.</option>
            </select>
          </div>

          <table className="tbl">
            <thead>
              <tr>
                <th>Work order</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Tech</th>
                <th className="col-num">Total</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(j => {
                const c = byId(DATA.customers, j.customerId);
                const v = byId(DATA.vehicles, j.vehicleId);
                const total = j.laborHrs * j.laborRate + j.parts + j.fee;
                return (
                  <tr key={j.id} className={selectedId === j.id ? 'selected' : ''} onClick={() => onSelect(j.id)}>
                    <td>
                      <div className="mono" style={{ fontWeight: 600, fontSize: 12 }}>{j.no}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{j.date}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar initials={c.initials} color={c.avatar} size="sm"/>
                        <div className="strong">{c.name}</div>
                      </div>
                    </td>
                    <td>
                      <div>{v.year} {v.make} {v.model}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{v.plate}</div>
                    </td>
                    <td>
                      <div>{j.service}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{j.complaint}</div>
                    </td>
                    <td className="muted">{j.assignedTo}</td>
                    <td className="col-num mono strong">{fmt$(total)}</td>
                    <td><JobStatusPill status={j.status}/></td>
                    <td><InvoicePill status={j.invStatus}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {selected && view === 'table' && <JobDetail job={selected} onClose={() => onSelect(null)} />}
        </>
        ) : (
          <JobsBoard jobs={filtered} onOpenJob={onSelect}/>
        )}
      </div>
    </>
  );
}

function JobsBoard({ jobs, onOpenJob }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${JOB_BOARD_STAGES.length}, minmax(0, 1fr))`,
      gap: 12,
      minHeight: 'calc(100vh - 260px)',
    }}>
      {JOB_BOARD_STAGES.map(stage => {
        const items = jobs.filter(j => j.status === stage.id);
        const value = items.reduce((s, j) => s + j.laborHrs * j.laborRate + j.parts + j.fee, 0);
        return (
          <div key={stage.id} style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: stage.color, flexShrink: 0 }}/>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stage.id}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{items.length}</span>
              </div>
              <span className="mono num" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{value > 0 ? fmt$0(value) : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {items.map(j => {
                const c = byId(DATA.customers, j.customerId);
                const v = byId(DATA.vehicles, j.vehicleId);
                const total = j.laborHrs * j.laborRate + j.parts + j.fee;
                return (
                  <div key={j.id} onClick={() => onOpenJob(j.id)} style={{
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 10,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-faint)', fontWeight: 600 }}>{j.no}</span>
                      <InvoicePill status={j.invStatus}/>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, lineHeight: 1.3 }}>{j.service}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginBottom: 6 }}>{c.name} · {v.year} {v.make} {v.model}</div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      paddingTop: 7, borderTop: '1px solid var(--border)',
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-muted)' }}>
                        <Avatar initials={c.initials} color={c.avatar} size="sm"/>
                        {j.assignedTo === 'Owner' ? 'BV' : 'DR'}
                      </span>
                      <span className="mono num" style={{ fontSize: 12, fontWeight: 600 }}>{fmt$0(total)}</span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div style={{
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 8,
                  padding: 14,
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--fg-faint)',
                }}>No jobs</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobDetail({ job, onClose }) {
  const c = byId(DATA.customers, job.customerId);
  const v = byId(DATA.vehicles, job.vehicleId);
  const labor = job.laborHrs * job.laborRate;
  const subtotal = labor + job.parts + job.fee;
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;

  return (
    <div className="card" style={{ position: 'sticky', top: 0 }}>
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)', fontWeight: 600 }}>{job.no}</span>
            <JobStatusPill status={job.status}/>
            <InvoicePill status={job.invStatus}/>
          </div>
          <div className="card-title" style={{ fontSize: 15 }}>{job.service}</div>
          <div className="card-sub">{job.date} · {job.assignedTo} · {job.eta !== '—' ? `ETA ${job.eta}` : 'Unscheduled'}</div>
        </div>
        <button className="icon-btn" onClick={onClose}><Icons.Close size={14}/></button>
      </div>

      <div style={{ padding: 18 }}>
        {/* Customer + vehicle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 10 }}>
            <div className="label-up" style={{ marginBottom: 4 }}>Customer</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar initials={c.initials} color={c.avatar} size="sm"/>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div className="muted mono" style={{ fontSize: 11 }}>{c.phone}</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 10 }}>
            <div className="label-up" style={{ marginBottom: 4 }}>Vehicle</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{v.year} {v.make} {v.model}</div>
            <div className="muted" style={{ fontSize: 11 }}>{v.trim} · {v.engine}</div>
            <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{v.plate} · {(v.miles/1000).toFixed(1)}k mi</div>
          </div>
        </div>

        {/* Complaint / diagnosis */}
        <div style={{ marginBottom: 12 }}>
          <div className="label-up" style={{ marginBottom: 4 }}>Customer concern</div>
          <div style={{ fontSize: 13 }}>{job.complaint}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div className="label-up" style={{ marginBottom: 4 }}>Service address</div>
          <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icons.Pin size={12}/> {job.addr}
          </div>
        </div>

        {/* Charges */}
        <div className="label-up" style={{ marginBottom: 8 }}>Charges</div>
        <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
          <Row label={`Labor · ${job.laborHrs} hr × ${fmt$(job.laborRate)}/hr`} value={fmt$(labor)}/>
          <Row label="Parts" value={fmt$(job.parts)}/>
          <Row label="Trip fee" value={fmt$(job.fee)}/>
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }}/>
          <Row label="Subtotal" value={fmt$(subtotal)} muted/>
          <Row label="Tax (8.25%)" value={fmt$(tax)} muted/>
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }}/>
          <Row label="Total" value={fmt$(total)} strong/>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm"><Icons.Bolt size={12}/> Mark in progress</button>
          <button className="btn btn-sm"><Icons.Send size={12}/> Send invoice</button>
          <button className="btn btn-sm"><Icons.Print size={12}/> Print</button>
          <button className="btn btn-sm"><Icons.Edit size={12}/> Edit</button>
        </div>

        {/* Notify customer */}
        <NotifyCustomer customerName={c.name.split(' ')[0]} />

        {/* Timeline */}
        <div className="label-up" style={{ marginTop: 18, marginBottom: 8 }}>Timeline</div>
        <div style={{ position: 'relative', paddingLeft: 14 }}>
          <div style={{ position: 'absolute', left: 5, top: 8, bottom: 8, width: 1, background: 'var(--border)' }}/>
          {[
            { t: 'Today, 9:42 AM',  who: 'Diego R.', what: 'Status → In Progress' },
            { t: 'Today, 9:38 AM',  who: 'Diego R.', what: 'Arrived on site' },
            { t: 'Today, 8:15 AM',  who: 'Diego R.', what: 'En route — 22 min ETA' },
            { t: 'Yesterday, 4:20 PM', who: 'Owner', what: 'Job confirmed by customer' },
            { t: 'Yesterday, 11:00 AM', who: 'Owner', what: 'Estimate EST-0141 approved' },
          ].map((e, i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: 11 }}>
              <div style={{ position: 'absolute', left: -12, top: 5, width: 7, height: 7, borderRadius: 999, background: i === 0 ? 'var(--accent)' : 'var(--border-strong)' }}/>
              <div style={{ fontSize: 12.5 }}><strong style={{ fontWeight: 600 }}>{e.who}</strong> <span className="muted">{e.what}</span></div>
              <div className="faint" style={{ fontSize: 11, marginTop: 1 }}>{e.t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted, strong }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      color: muted ? 'var(--fg-muted)' : 'var(--fg)',
      fontWeight: strong ? 600 : 400,
    }}>
      <span>{label}</span>
      <span className="mono num">{value}</span>
    </div>
  );
}

function NotifyCustomer({ customerName }) {
  const [enabled, setEnabled] = React.useState(true);
  return (
    <div style={{
      marginTop: 16,
      padding: '12px 14px',
      background: 'var(--bg-subtle)',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: enabled ? 'var(--accent-soft)' : 'var(--neutral-soft)',
        color: enabled ? 'var(--accent-fg)' : 'var(--fg-faint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icons.Send size={14}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>Auto-text {customerName} when en route</div>
        <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          {enabled
            ? <>Will send: <span style={{ color: 'var(--fg)' }}>"Hey {customerName}, this is Brandon with Vega Mobile Mechanic — on my way, ETA ~22 min."</span></>
            : 'Customer will not receive an arrival text on status change.'}
        </div>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        style={{
          width: 32, height: 18, borderRadius: 999,
          background: enabled ? 'var(--accent)' : 'var(--border-strong)',
          border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
          flexShrink: 0, marginTop: 2,
          transition: 'background 0.15s',
        }}
        aria-pressed={enabled}
      >
        <span style={{
          position: 'absolute', top: 2, left: enabled ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}/>
      </button>
    </div>
  );
}

window.Jobs = Jobs;
