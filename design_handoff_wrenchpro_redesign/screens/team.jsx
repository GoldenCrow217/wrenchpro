/* global React, DATA2, fmt$, fmt$0, Card, Pill, Avatar, Icons */

function Employees() {
  const emps = DATA2.employees;
  const totalRevenue = emps.reduce((s, e) => s + e.revenue, 0);
  const activeJobs = emps.reduce((s, e) => s + e.jobs, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Employees</div>
          <div className="page-sub">{emps.length} on team · {activeJobs} jobs in progress · {fmt$0(totalRevenue)} labor revenue this month</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Clock size={14}/> Time clock</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> Add employee</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 18 }}>
        {emps.map(e => (
          <Card key={e.id} pad>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <Avatar initials={e.initials} color={e.color} size="lg"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{e.name}</span>
                  <Pill kind={e.status === 'On job' ? 'accent' : e.status === 'Active' ? 'green' : 'gray'} dot>{e.status}</Pill>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{e.role}</div>
                <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>{e.phone}</div>
              </div>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              borderTop: '1px solid var(--border)',
              paddingTop: 12, gap: 6,
            }}>
              <Stat label="Pay rate" value={`$${e.rate}/hr`}/>
              <Stat label="Active jobs" value={e.jobs}/>
              <Stat label="Labor (MTD)" value={fmt$0(e.revenue)}/>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="label-up" style={{ marginBottom: 2 }}>{label}</div>
      <div className="mono num" style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function TimeTracking() {
  const entries = DATA2.timeEntries;
  const open = entries.filter(e => !e.out).length;

  // Compute totals per type
  const totalsByType = {};
  entries.forEach(e => {
    if (!e.out) return;
    const [h, m] = e.duration.split(':').map(Number);
    totalsByType[e.type] = (totalsByType[e.type] || 0) + h + m / 60;
  });
  const totalHrs = Object.values(totalsByType).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Time Tracking</div>
          <div className="page-sub">{entries.length} entries this week · {totalHrs.toFixed(1)} hrs logged · {open} clock-in active</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export timesheet</button>
          <button className="btn btn-primary"><Icons.Bolt size={14}/> Clock in</button>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Total hours</div><div className="kpi-value">{totalHrs.toFixed(1)}</div><div className="kpi-meta">last 7 days</div></div>
        <div className="kpi"><div className="kpi-label">Repair</div><div className="kpi-value">{(totalsByType['Repair'] || 0).toFixed(1)}</div><div className="kpi-meta">billable</div></div>
        <div className="kpi"><div className="kpi-label">Diagnostic</div><div className="kpi-value">{(totalsByType['Diagnostic'] || 0).toFixed(1)}</div><div className="kpi-meta">billable</div></div>
        <div className="kpi"><div className="kpi-label">Travel + Admin</div><div className="kpi-value">{((totalsByType['Travel']||0) + (totalsByType['Admin']||0)).toFixed(1)}</div><div className="kpi-meta">non-billable</div></div>
      </div>

      <Card pad={false}>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <select className="input" style={{ width: 180 }}>
            <option>All employees</option>
            {DATA2.employees.map(e => <option key={e.id}>{e.name}</option>)}
          </select>
          <select className="input" style={{ width: 160 }}>
            <option>All time</option><option>Today</option><option>This week</option><option>This month</option>
          </select>
          <select className="input" style={{ width: 160 }}>
            <option>All types</option><option>Repair</option><option>Diagnostic</option><option>Travel</option><option>Admin</option>
          </select>
        </div>
        <table className="tbl">
          <thead><tr><th>Employee</th><th>Type</th><th>Clock in</th><th>Clock out</th><th className="col-num">Duration</th><th>Job</th><th>Notes</th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td className="strong">{e.emp}</td>
                <td><Pill kind={({Repair:'accent',Diagnostic:'blue',Travel:'amber',Admin:'gray',General:'gray'})[e.type] || 'gray'}>{e.type}</Pill></td>
                <td className="mono" style={{ fontSize: 12 }}>{e.in.split(' ').join(' · ')}</td>
                <td className="mono" style={{ fontSize: 12 }}>{e.out ? e.out.split(' ').join(' · ') : <span style={{ color: 'var(--accent-fg)', fontWeight: 600 }}>In progress</span>}</td>
                <td className="col-num mono strong">{e.duration}</td>
                <td><span className="mono" style={{ fontSize: 12 }}>{e.job}</span></td>
                <td className="muted" style={{ fontSize: 12 }}>{e.notes || <span className="faint">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

window.Employees = Employees;
window.TimeTracking = TimeTracking;
