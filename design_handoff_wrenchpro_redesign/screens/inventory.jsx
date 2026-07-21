/* global React, DATA, fmt$, fmt$0, Card, Pill, Icons */

function Inventory() {
  const parts = DATA.parts;
  const value = parts.reduce((s, p) => s + p.qty * p.cost, 0);
  const margin = parts.reduce((s, p) => s + (p.retail - p.cost) * p.qty, 0);
  const lowCount = parts.filter(p => p.qty <= p.reorder).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Parts & Inventory</div>
          <div className="page-sub">{parts.length} SKUs · {fmt$0(value)} on hand · {lowCount} below reorder threshold</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn"><Icons.Box size={14}/> Cycle count</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> Add part</button>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Inventory value</div><div className="kpi-value">{fmt$0(value)}</div><div className="kpi-meta">at cost</div></div>
        <div className="kpi"><div className="kpi-label">Projected margin</div><div className="kpi-value">{fmt$0(margin)}</div><div className="kpi-meta">at retail</div></div>
        <div className="kpi"><div className="kpi-label">Low stock</div><div className="kpi-value" style={{ color: lowCount > 0 ? 'var(--danger-fg)' : 'var(--fg)' }}>{lowCount}</div><div className="kpi-meta">{lowCount > 0 ? 'needs reorder' : 'all stocked'}</div></div>
        <div className="kpi"><div className="kpi-label">Avg margin %</div><div className="kpi-value">{Math.round((margin / value) * 100)}%</div><div className="kpi-meta">across catalog</div></div>
      </div>

      <Card pad={false}>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
            <input className="input" placeholder="Search by name, SKU, vendor, location…" style={{ paddingLeft: 30 }}/>
          </div>
          <select className="input" style={{ width: 160 }}><option>All parts</option><option>Low stock only</option></select>
          <select className="input" style={{ width: 160 }}><option>All vendors</option><option>AutoZone</option><option>NAPA</option><option>O'Reilly</option></select>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Part</th><th>SKU</th><th>Vendor</th>
              <th className="col-num">Cost</th><th className="col-num">Retail</th>
              <th className="col-num">Margin</th>
              <th className="col-num">On hand</th><th>Stock</th><th>Location</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(p => {
              const low = p.qty <= p.reorder;
              const pct = Math.min(100, (p.qty / (p.reorder * 2 || 1)) * 100);
              const marginPct = Math.round(((p.retail - p.cost) / p.retail) * 100);
              return (
                <tr key={p.id}>
                  <td className="strong">{p.name}</td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{p.sku}</span></td>
                  <td className="muted">{p.vendor}</td>
                  <td className="col-num mono">{fmt$(p.cost)}</td>
                  <td className="col-num mono">{fmt$(p.retail)}</td>
                  <td className="col-num mono" style={{ color: 'var(--success-fg)' }}>{marginPct}%</td>
                  <td className="col-num mono strong" style={{ color: low ? 'var(--danger-fg)' : 'var(--fg)' }}>{p.qty}</td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          width: pct + '%', height: '100%',
                          background: low ? 'var(--danger)' : pct < 50 ? 'var(--warning)' : 'var(--success)',
                        }}/>
                      </div>
                      {low && <Pill kind="red">Low</Pill>}
                    </div>
                    <div className="faint" style={{ fontSize: 10, marginTop: 2 }}>reorder at {p.reorder}</div>
                  </td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{p.location}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

window.Inventory = Inventory;
