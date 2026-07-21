/* global React, DATA, DATA2, byId, Card, Pill, Avatar, Icons */

function Warranties() {
  const warranties = DATA2.warranties;
  const active = warranties.filter(w => w.status === 'Active').length;
  const expired = warranties.filter(w => w.status === 'Expired').length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Warranties</div>
          <div className="page-sub">{warranties.length} total · {active} active · {expired} expired</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> New warranty</button>
        </div>
      </div>

      <Card pad={false}>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
            <input className="input" placeholder="Search warranties, customers…" style={{ paddingLeft: 30 }}/>
          </div>
          <select className="input" style={{ width: 140 }}>
            <option value="">All statuses</option><option>Active</option><option>Pending</option><option>Expired</option><option>Voided</option>
          </select>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th><th>Vehicle</th><th>Coverage</th>
              <th className="col-num">Labor</th><th className="col-num">Parts</th>
              <th className="col-num">Mileage limit</th>
              <th>Expires</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {warranties.map(w => {
              const c = byId(DATA.customers, w.customerId);
              const v = byId(DATA.vehicles, w.vehicleId);
              return (
                <tr key={w.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar initials={c.initials} color={c.avatar} size="sm"/>
                      <span className="strong">{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <div>{v.year} {v.make} {v.model}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{v.plate}</div>
                  </td>
                  <td>{w.desc}</td>
                  <td className="col-num mono">{w.laborMo}mo</td>
                  <td className="col-num mono">{w.partsMo}mo</td>
                  <td className="col-num mono">{w.mileLimit.toLocaleString()} mi</td>
                  <td className="muted">{w.expires}</td>
                  <td><Pill kind={({Active:'green',Pending:'amber',Expired:'red',Voided:'gray'})[w.status]} dot>{w.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

window.Warranties = Warranties;
