/* global React, Card, Icons */

function Settings() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Business profile, rates, invoicing, and document defaults</div>
        </div>
        <div className="page-actions">
          <button className="btn">Discard</button>
          <button className="btn btn-primary">Save changes</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18, alignItems: 'flex-start' }}>
        {/* Nav rail */}
        <div className="card" style={{ padding: 6, position: 'sticky', top: 0 }}>
          {['Business profile', 'Branding', 'Labor rates', 'Invoicing', 'Vehicle defaults', 'Documents', 'Team & roles', 'Backup'].map((s, i) => (
            <div key={s} style={{
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 6,
              cursor: 'pointer',
              background: i === 0 ? 'var(--bg-subtle)' : 'transparent',
              color: i === 0 ? 'var(--fg)' : 'var(--fg-muted)',
              fontWeight: i === 0 ? 600 : 500,
            }}>{s}</div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Business profile" sub="Shown on invoices, estimates, and emails">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Business name" defaultValue="Vega Mobile Mechanic"/>
              <Field label="Owner / operator" defaultValue="Brandon Vega"/>
              <Field label="Phone" defaultValue="(214) 555-0100" mono/>
              <Field label="Email" defaultValue="brandon@vegamobilemech.com"/>
              <Field label="Tax ID / EIN" defaultValue="47-3192845" mono/>
              <Field label="Website" defaultValue="vegamobilemech.com"/>
              <FieldFull label="Service address / dispatch base" defaultValue="2200 Empire Central, Dallas, TX 75235"/>
              <FieldFull label="Service area" defaultValue="Dallas / Plano / Richardson + 30 mi radius"/>
              <FieldFull label="Business hours" defaultValue="Mon–Fri 7:30am–6pm · Sat 8am–2pm · After-hours surcharge applies"/>
            </div>
          </Card>

          <Card title="Branding" sub="Logo + colors used on customer-facing documents">
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 18, alignItems: 'flex-start' }}>
              <div>
                <div className="label-up" style={{ marginBottom: 6 }}>Logo</div>
                <div style={{
                  height: 100, borderRadius: 10,
                  background: 'var(--bg-subtle)',
                  border: '1px dashed var(--border-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--fg-faint)', fontSize: 12, flexDirection: 'column', gap: 4,
                }}>
                  <Icons.Wrench size={22}/>
                  <span>Drop file or upload</span>
                </div>
                <button className="btn btn-sm" style={{ marginTop: 8, width: '100%' }}>Upload logo</button>
              </div>
              <div>
                <div className="label-up" style={{ marginBottom: 6 }}>Accent color</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['oklch(62% 0.16 50)', 'oklch(56% 0.16 245)', 'oklch(56% 0.14 150)', 'oklch(56% 0.16 290)', 'oklch(56% 0.18 25)'].map((c, i) => (
                    <div key={i} style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: c, cursor: 'pointer',
                      boxShadow: i === 0 ? '0 0 0 2px var(--bg-elev), 0 0 0 4px var(--accent)' : 'none',
                    }}/>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Used on document headers, the "approve" button on estimate links, and as the primary action color in the app.
                </div>
              </div>
            </div>
          </Card>

          <Card title="Labor rates" sub="Used by the job and estimate builders">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <Field label="Standard ($/hr)" defaultValue="75.00" mono/>
              <Field label="Diagnostic ($/hr)" defaultValue="99.00" mono/>
              <Field label="Fleet ($/hr)" defaultValue="65.00" mono/>
              <Field label="Emergency / after-hours ($/hr)" defaultValue="150.00" mono/>
              <Field label="Mobile / trip fee ($)" defaultValue="50.00" mono/>
              <Field label="Sales tax (%)" defaultValue="8.25" mono/>
            </div>
          </Card>

          <Card title="Invoicing & estimates">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <Field label="Default payment terms" defaultValue="Due on receipt" select options={['Due on receipt', 'Net 7', 'Net 15', 'Net 30']}/>
              <Field label="Default payment method" defaultValue="Card" select options={['Cash', 'Card', 'Venmo', 'CashApp', 'Check', 'Zelle']}/>
              <Field label="Estimate validity (days)" defaultValue="30" mono/>
              <Field label="Currency" defaultValue="$" mono/>
            </div>
            <FieldFull label="Invoice footer" defaultValue="Thank you for choosing Vega Mobile Mechanic. We come to you so you don't have to come to us."/>
            <FieldFull label="Warranty terms" defaultValue="12 months / 12,000 miles parts and labor. Voided by tampering or non-WMM repairs to the same component."/>
          </Card>

          <Card title="Vehicle defaults">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Oil-change warning threshold (mi)" defaultValue="1500" mono/>
              <Field label="Default oil interval (mi)" defaultValue="5000" mono/>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.55 }}>
              Vehicles within {1500} miles of their next scheduled oil change show an "Oil soon" badge throughout the app. Once they pass the threshold the badge turns to "Oil overdue".
            </div>
          </Card>

          <Card title="Backup">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13 }}>Last backup: <span className="mono">May 19, 2026 · 11:14 PM</span></div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>SQLite database backed up to <span className="mono">%APPDATA%\wrenchpro\backups\</span></div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm">Open backup folder</button>
                <button className="btn btn-sm btn-primary">Back up now</button>
              </div>
            </div>
          </Card>

          <div className="muted" style={{ fontSize: 11, padding: '8px 4px' }}>
            WrenchPro v1.0.13 · SQLite via better-sqlite3 · Electron 29 · Auto-update checks GitHub Releases on launch
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, defaultValue, mono, select, options }) {
  return (
    <div>
      <div className="label-up" style={{ marginBottom: 5 }}>{label}</div>
      {select ? (
        <select className="input" defaultValue={defaultValue}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input className="input" defaultValue={defaultValue} style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)' }}/>
      )}
    </div>
  );
}

function FieldFull({ label, defaultValue }) {
  return (
    <div style={{ gridColumn: '1 / -1', marginBottom: 8 }}>
      <div className="label-up" style={{ marginBottom: 5 }}>{label}</div>
      <input className="input" defaultValue={defaultValue}/>
    </div>
  );
}

window.Settings = Settings;
