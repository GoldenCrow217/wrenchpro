/* global React, DATA, DATA2, byId, fmt$, fmt$0, Card, Pill, Avatar, Icons */

function Estimates() {
  const [selectedId, setSelectedId] = React.useState('E1');
  const estimates = DATA2.estimates;

  const pipeline = estimates.filter(e => ['Draft', 'Sent'].includes(e.status)).reduce((s, e) => s + e.total, 0);
  const approved = estimates.filter(e => e.status === 'Approved').reduce((s, e) => s + e.total, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Estimates</div>
          <div className="page-sub">{estimates.length} total · {fmt$0(pipeline)} pipeline · {fmt$0(approved)} approved (convert to job)</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> New estimate</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'flex-start' }}>
        <Card pad={false}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
              <input className="input" placeholder="Search estimates, customers…" style={{ paddingLeft: 30 }}/>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>Estimate</th><th>Customer</th><th className="col-num">Total</th><th>Status</th></tr></thead>
            <tbody>
              {estimates.map(e => {
                const c = byId(DATA.customers, e.customerId);
                return (
                  <tr key={e.id} className={selectedId === e.id ? 'selected' : ''} onClick={() => setSelectedId(e.id)}>
                    <td>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{e.no}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{e.date}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar initials={c.initials} color={c.avatar} size="sm"/>
                        <span className="strong">{c.name}</span>
                      </div>
                    </td>
                    <td className="col-num mono strong">{fmt$(e.total)}</td>
                    <td><Pill kind={({Draft:'gray',Sent:'blue',Approved:'green',Declined:'red',Expired:'amber'})[e.status]} dot>{e.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <EstimateBuilder estimate={byId(DATA2.estimates, selectedId)}/>
      </div>
    </>
  );
}

function EstimateBuilder({ estimate }) {
  // Synth line items for the selected estimate
  const baseItems = [
    { type: 'Labor',     desc: 'Front brake pads + rotors replacement', qty: 2.0, rate: 75, taxable: false },
    { type: 'Parts',     desc: 'Brake pads — ceramic (front axle)',     qty: 1,   rate: 89.99, taxable: true },
    { type: 'Parts',     desc: 'Brake rotors — coated (front, pair)',   qty: 1,   rate: 154.40, taxable: true },
    { type: 'Parts',     desc: 'Brake fluid DOT 4 (32 oz)',              qty: 1,   rate: 24.50, taxable: true },
    { type: 'Diagnostic',desc: 'Pre-service brake inspection',          qty: 1,   rate: 99.00, taxable: false },
    { type: 'Fee',       desc: 'Mobile service trip fee',                qty: 1,   rate: 50.00, taxable: false },
  ];
  const c = estimate ? byId(DATA.customers, estimate.customerId) : null;
  const v = estimate ? byId(DATA.vehicles, estimate.vehicleId) : null;

  const subtotal = baseItems.reduce((s, it) => s + it.qty * it.rate, 0);
  const tax = baseItems.filter(it => it.taxable).reduce((s, it) => s + it.qty * it.rate, 0) * 0.0825;
  const total = subtotal + tax;

  if (!estimate) return <Card><div className="empty">Select an estimate.</div></Card>;

  const typeColors = {
    Labor:      'var(--info-fg)',
    Parts:      'var(--accent-fg)',
    Diagnostic: 'var(--warning-fg)',
    Fee:        'var(--neutral-fg)',
    Sublet:     'var(--neutral-fg)',
  };
  const typeBg = {
    Labor:      'var(--info-soft)',
    Parts:      'var(--accent-soft)',
    Diagnostic: 'var(--warning-soft)',
    Fee:        'var(--neutral-soft)',
    Sublet:     'var(--neutral-soft)',
  };

  return (
    <Card pad={false}>
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-faint)' }}>{estimate.no}</span>
            <Pill kind={({Draft:'gray',Sent:'blue',Approved:'green',Declined:'red',Expired:'amber'})[estimate.status]} dot>{estimate.status}</Pill>
          </div>
          <div className="card-title" style={{ fontSize: 16 }}>{c.name} · {v.year} {v.make} {v.model}</div>
          <div className="card-sub">Issued {estimate.date} · Expires {estimate.expires}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm"><Icons.Print size={12}/> Print</button>
          <button className="btn btn-sm"><Icons.Send size={12}/> Send</button>
          {estimate.status === 'Approved' && <button className="btn btn-sm btn-primary"><Icons.Arrow size={12}/> Convert to job</button>}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {/* Line items */}
        <div className="label-up" style={{ marginBottom: 8 }}>Line items</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 60px 80px 90px 32px',
            gap: 8,
            padding: '8px 10px',
            background: 'var(--bg-subtle)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            <div>Type</div><div>Description</div><div className="right">Qty</div><div className="right">Rate</div><div className="right">Amount</div><div/>
          </div>
          {baseItems.map((it, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 60px 80px 90px 32px',
              gap: 8,
              padding: '10px',
              alignItems: 'center',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <div>
                <span className="pill" style={{ background: typeBg[it.type], color: typeColors[it.type] }}>{it.type}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                {it.desc}
                {it.taxable && <span className="faint" style={{ fontSize: 10, marginLeft: 6 }}>· taxable</span>}
              </div>
              <div className="mono num right" style={{ fontSize: 12 }}>{it.qty}</div>
              <div className="mono num right" style={{ fontSize: 12 }}>{fmt$(it.rate)}</div>
              <div className="mono num right strong" style={{ fontSize: 13 }}>{fmt$(it.qty * it.rate)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="icon-btn"><Icons.More size={12}/></button>
              </div>
            </div>
          ))}
          <div style={{
            padding: '10px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
          }}>
            <button className="btn btn-sm"><Icons.Plus size={12}/> Add labor</button>
            <button className="btn btn-sm"><Icons.Plus size={12}/> Add part</button>
            <button className="btn btn-sm"><Icons.Plus size={12}/> From catalog</button>
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18, marginTop: 18 }}>
          <div>
            <div className="label-up" style={{ marginBottom: 6 }}>Customer-facing notes</div>
            <div style={{ background: 'var(--bg-subtle)', padding: 10, borderRadius: 8, fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
              Recommended front brake service includes pads, rotors, and brake fluid flush. Estimate valid for 30 days. 12 month / 12,000 mile warranty on parts and labor. We come to you — no shop drop-off needed.
            </div>
          </div>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 14px' }}>
            <SumRow label="Subtotal" value={fmt$(subtotal)}/>
            <SumRow label="Tax (8.25%)" value={fmt$(tax)} muted/>
            <SumRow label="Discount" value="—" muted/>
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }}/>
            <SumRow label="Total" value={fmt$(total)} strong large/>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SumRow({ label, value, muted, strong, large }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '5px 0',
      color: muted ? 'var(--fg-muted)' : 'var(--fg)',
      fontWeight: strong ? 700 : 400,
      fontSize: large ? 15 : 13,
    }}>
      <span>{label}</span>
      <span className="mono num">{value}</span>
    </div>
  );
}

window.Estimates = Estimates;
