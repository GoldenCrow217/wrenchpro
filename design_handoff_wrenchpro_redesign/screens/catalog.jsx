/* global React, DATA, DATA2, byId, fmt$, Card, Pill, Icons */

function Catalog() {
  const services = DATA2.services;
  const cats = [...new Set(services.map(s => s.cat))];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Service Catalog</div>
          <div className="page-sub">{services.length} reusable services across {cats.length} categories</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> Add service</button>
        </div>
      </div>

      <Card pad={false}>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
            <input className="input" placeholder="Search service templates…" style={{ paddingLeft: 30 }}/>
          </div>
          <select className="input" defaultValue="" style={{ width: 160 }}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Service name</th><th>Category</th>
              <th className="col-num">Default hrs</th><th className="col-num">Default price</th>
              <th>Taxable</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => (
              <tr key={s.id}>
                <td className="strong">{s.name}</td>
                <td><Pill kind={({Maintenance:'green',Brakes:'amber',Diagnostic:'blue',Electrical:'accent',Engine:'red',HVAC:'blue',Other:'gray'})[s.cat] || 'gray'}>{s.cat}</Pill></td>
                <td className="col-num mono">{s.hrs.toFixed(1)}</td>
                <td className="col-num mono strong">{fmt$(s.price)}</td>
                <td>{s.taxable ? <Pill kind="gray">Taxable</Pill> : <span className="faint" style={{ fontSize: 11 }}>—</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{s.notes || <span className="faint">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

window.Catalog = Catalog;
