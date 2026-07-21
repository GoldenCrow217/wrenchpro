/* global React, DATA, byId, Card, Pill, Icons */

function Vehicles() {
  const [q, setQ] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);
  const all = DATA.vehicles.map(v => ({ ...v, owner: byId(DATA.customers, v.customerId) }));
  const filtered = all.filter(v => {
    if (!q) return true;
    const hay = `${v.year} ${v.make} ${v.model} ${v.plate} ${v.vin} ${v.owner.name}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const oilSoon = all.filter(v => v.miles >= v.oilDue - 3000).length;
  const oilOverdue = all.filter(v => v.miles >= v.oilDue).length;
  const fleet = all.filter(v => ['Fleet', 'Commercial'].includes(v.owner.type)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Vehicles</div>
          <div className="page-sub">{all.length} tracked · {fleet} fleet · {oilSoon} due for oil · {oilOverdue} overdue</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Icons.Plus size={14}/> Add vehicle</button>
        </div>
      </div>

      {addOpen && <AddVehicleModal onClose={() => setAddOpen(false)} />}

      <Card pad={false}>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search make, model, plate, VIN, owner…" style={{ paddingLeft: 30 }}/>
          </div>
          <select className="input" defaultValue="" style={{ width: 140 }}>
            <option value="">All fuel types</option>
            <option>Gasoline</option><option>Diesel</option><option>Hybrid</option><option>Electric</option>
          </select>
          <select className="input" defaultValue="" style={{ width: 140 }}>
            <option value="">All states</option>
            <option>Active</option><option>Oil soon</option><option>Oil overdue</option>
          </select>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Vehicle</th><th>Plate / VIN</th><th>Owner</th><th className="col-num">Mileage</th>
              <th className="col-num">Next oil</th><th>Fuel</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => {
              const remaining = v.oilDue - v.miles;
              const overdue = remaining < 0;
              const soon = remaining >= 0 && remaining < 3000;
              return (
                <tr key={v.id}>
                  <td>
                    <div className="strong">{v.year} {v.make} {v.model}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{v.trim} · {v.engine}</div>
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: 12 }}>{v.plate} · {v.state}</div>
                    <div className="muted mono" style={{ fontSize: 10.5, marginTop: 1, letterSpacing: '0.02em' }}>{v.vin}</div>
                  </td>
                  <td className="muted">{v.owner.name}</td>
                  <td className="col-num mono strong">{v.miles.toLocaleString()}</td>
                  <td className="col-num mono">{v.oilDue.toLocaleString()}</td>
                  <td className="muted">{v.fuel}</td>
                  <td>
                    {overdue ? <Pill kind="red" dot>Oil overdue</Pill>
                      : soon ? <Pill kind="amber" dot>Oil soon</Pill>
                      : <Pill kind="green" dot>OK</Pill>}
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

window.Vehicles = Vehicles;

// Add Vehicle modal with VIN decoder demo (NHTSA vPIC API)
function AddVehicleModal({ onClose }) {
  const [vin, setVin] = React.useState('');
  const [decoding, setDecoding] = React.useState(false);
  const [decoded, setDecoded] = React.useState(null);

  const sampleVin = '1FTEW1EP5JKF12345';

  const onDecode = () => {
    setDecoding(true);
    setDecoded(null);
    setTimeout(() => {
      setDecoded({
        year: '2018',
        make: 'Ford',
        model: 'F-150',
        trim: 'XLT SuperCrew 4x4',
        engine: '5.0L V8 (302 cid)',
        transmission: 'Automatic (10-Speed)',
        fuel: 'Gasoline',
        body: 'Pickup Truck',
        plantCity: 'Dearborn, MI',
      });
      setDecoding(false);
    }, 850);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(20, 15, 8, 0.4)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      paddingTop: '6vh',
      backdropFilter: 'blur(2px)',
      overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth: '92vw',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(20, 15, 8, 0.25)',
        overflow: 'hidden',
        marginBottom: 40,
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Add vehicle</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Enter the VIN to auto-fill from the NHTSA database</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icons.Close size={14}/></button>
        </div>

        <div style={{ padding: 22 }}>
          {/* VIN Decoder Section */}
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: 16, marginBottom: 18 }}>
            <div className="label-up" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.Bolt size={11} style={{ color: 'var(--accent)' }}/> VIN Decode
              <span className="faint" style={{ fontSize: 10, marginLeft: 'auto', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                via NHTSA vPIC · free
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={vin}
                onChange={e => setVin(e.target.value.toUpperCase())}
                placeholder="Paste or type a 17-character VIN"
                maxLength={17}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', fontSize: 13 }}
              />
              <button className="btn btn-primary" onClick={onDecode} disabled={!vin || vin.length < 11}>
                {decoding ? 'Decoding…' : 'Decode VIN'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-muted)' }}>
              Try: <button onClick={() => setVin(sampleVin)} style={{
                background: 'none', border: 'none', padding: 0,
                color: 'var(--accent)', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                textDecoration: 'underline',
              }}>{sampleVin}</button> (Ford F-150)
            </div>

            {decoded && (
              <div style={{
                marginTop: 14,
                padding: '12px 14px',
                background: 'var(--bg-elev)',
                border: '1px solid var(--success)',
                borderRadius: 8,
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Icons.Pass size={14} style={{ color: 'var(--success)' }}/>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success-fg)' }}>Decoded successfully</span>
                  <span className="faint" style={{ fontSize: 11, marginLeft: 'auto' }}>9 fields populated below</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  {Object.entries(decoded).map(([k, v]) => (
                    <div key={k}>
                      <div className="label-up" style={{ fontSize: 9, marginBottom: 1 }}>{k}</div>
                      <div style={{ fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual fields */}
          <div className="label-up" style={{ marginBottom: 8 }}>Vehicle details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Fld label="Year" v={decoded?.year}/>
            <Fld label="Make" v={decoded?.make}/>
            <Fld label="Model" v={decoded?.model}/>
            <Fld label="Trim" v={decoded?.trim} span={2}/>
            <Fld label="Engine" v={decoded?.engine}/>
            <Fld label="Fuel type" v={decoded?.fuel}/>
            <Fld label="Transmission" v={decoded?.transmission}/>
            <Fld label="Body style" v={decoded?.body}/>
          </div>

          <div className="label-up" style={{ marginBottom: 8, marginTop: 14 }}>Plate & registration</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 10 }}>
            <Fld label="License plate" mono/>
            <Fld label="State" v="TX"/>
            <Fld label="Color"/>
          </div>

          <div className="label-up" style={{ marginBottom: 8, marginTop: 14 }}>Service status</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Fld label="Current mileage" mono/>
            <Fld label="Next oil (mi)" mono/>
            <div>
              <div className="label-up" style={{ marginBottom: 5 }}>Owner</div>
              <select className="input"><option>— Select customer —</option>{DATA.customers.map(c => <option key={c.id}>{c.name}</option>)}</select>
            </div>
          </div>
        </div>

        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div className="muted" style={{ fontSize: 11.5 }}>
            <Icons.Shield size={11} style={{ verticalAlign: '-1px', marginRight: 4 }}/>
            VIN decode requires internet; all other fields work offline.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary">Save vehicle</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fld({ label, v, mono, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div className="label-up" style={{ marginBottom: 5 }}>{label}</div>
      <input
        className="input"
        defaultValue={v || ''}
        style={mono ? { fontFamily: 'var(--font-mono)' } : null}
      />
    </div>
  );
}
