/* global React, DATA, DATA2, byId, fmt$, fmt$0, Card, Pill, Avatar, Icons */

function Payments() {
  const payments = DATA2.payments;
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const byMethod = {};
  payments.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Payments</div>
          <div className="page-sub">{payments.length} entries · {fmt$0(total)} collected · {fmt$0(2840)} outstanding</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export ledger</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> Record payment</button>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Collected</div><div className="kpi-value" style={{ color: 'var(--success-fg)' }}>{fmt$0(total)}</div><div className="kpi-meta">last 7 days</div></div>
        <div className="kpi"><div className="kpi-label">Outstanding</div><div className="kpi-value" style={{ color: 'var(--danger-fg)' }}>{fmt$0(2840)}</div><div className="kpi-meta">5 invoices</div></div>
        <div className="kpi"><div className="kpi-label">Avg ticket</div><div className="kpi-value">{fmt$0(total / payments.length)}</div><div className="kpi-meta">across {payments.length} pmts</div></div>
        <div className="kpi"><div className="kpi-label">Active plans</div><div className="kpi-value">{DATA2.plans.filter(p => !p.done).length}</div><div className="kpi-meta">{DATA2.plans.filter(p => p.overdue).length} overdue</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <Card title="Payment ledger" pad={false}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Customer</th><th>Description</th><th>Method</th><th className="col-num">Amount</th></tr></thead>
            <tbody>
              {payments.map(p => {
                const c = byId(DATA.customers, p.customerId);
                return (
                  <tr key={p.id}>
                    <td className="muted">{p.date}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar initials={c.initials} color={c.avatar} size="sm"/>
                        <span className="strong">{c.name}</span>
                      </div>
                    </td>
                    <td>{p.desc}</td>
                    <td><Pill kind={({Cash:'green',Card:'blue',Zelle:'accent',Venmo:'blue',CashApp:'green',Check:'gray'})[p.method] || 'gray'}>{p.method}</Pill></td>
                    <td className="col-num mono strong" style={{ color: 'var(--success-fg)' }}>+{fmt$(p.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Collected by method" sub="Last 7 days">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([m, amt]) => {
              const pct = (amt / total) * 100;
              return (
                <div key={m} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 80px', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12 }}>{m}</span>
                  <div style={{ background: 'var(--bg-subtle)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 4 }}/>
                  </div>
                  <span className="mono num" style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{fmt$0(amt)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--fg-muted)' }}>
            Outstanding invoices total <strong style={{ color: 'var(--danger-fg)' }}>{fmt$0(2840)}</strong> across 5 customers. Three are overdue more than 14 days.
          </div>
        </Card>
      </div>
    </>
  );
}

function PaymentPlans() {
  const plans = DATA2.plans;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Payment Plans</div>
          <div className="page-sub">{plans.filter(p => !p.done).length} active · {plans.filter(p => p.overdue).length} overdue · {plans.filter(p => p.done).length} completed</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary"><Icons.Plus size={14}/> New plan</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {plans.map(p => {
          const c = byId(DATA.customers, p.customerId);
          const pct = (p.paid / p.total) * 100;
          return (
            <div key={p.id} className="card" style={{
              padding: 18,
              borderLeft: p.overdue ? '3px solid var(--danger)' : p.done ? '3px solid var(--success)' : '3px solid var(--accent)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar initials={c.initials} color={c.avatar} size="sm"/>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{p.desc}</div>
                </div>
                {p.done ? <Pill kind="green" dot>Paid in full</Pill>
                  : p.overdue ? <Pill kind="red" dot>Overdue</Pill>
                  : <Pill kind="accent" dot>Active</Pill>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, marginBottom: 4 }}>
                <span className="mono num" style={{ fontSize: 18, fontWeight: 700 }}>{fmt$(p.paid)}</span>
                <span className="muted mono" style={{ fontSize: 12 }}>of {fmt$(p.total)}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-subtle)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{
                  width: pct + '%', height: '100%',
                  background: p.done ? 'var(--success)' : p.overdue ? 'var(--danger)' : 'var(--accent)',
                  borderRadius: 999,
                }}/>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <PlanStat label="Installments" value={`${p.paidCount}/${p.installments}`}/>
                <PlanStat label="Frequency" value={p.freq}/>
                <PlanStat label="Next due" value={p.nextDue} danger={p.overdue}/>
              </div>

              {!p.done && (
                <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                  <button className="btn btn-sm btn-primary" style={{ flex: 1 }}><Icons.Dollar size={12}/> Record payment</button>
                  <button className="btn btn-sm"><Icons.Send size={12}/></button>
                  <button className="btn btn-sm"><Icons.More size={12}/></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PlanStat({ label, value, danger }) {
  return (
    <div>
      <div className="label-up" style={{ marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: danger ? 'var(--danger-fg)' : 'var(--fg)' }}>{value}</div>
    </div>
  );
}

function Expenses() {
  const expenses = DATA2.expenses;
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = {};
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Expenses</div>
          <div className="page-sub">{expenses.length} entries · {fmt$0(total)} this month · top: {topCat[0]}</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Export</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> Add expense</button>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Total expenses</div><div className="kpi-value">{fmt$0(total)}</div><div className="kpi-meta">May 2026</div></div>
        <div className="kpi"><div className="kpi-label">Parts & supplies</div><div className="kpi-value">{fmt$0(byCat['Parts & supplies'] || 0)}</div><div className="kpi-meta">{Math.round(((byCat['Parts & supplies'] || 0) / total) * 100)}% of total</div></div>
        <div className="kpi"><div className="kpi-label">Fuel</div><div className="kpi-value">{fmt$0(byCat['Fuel'] || 0)}</div><div className="kpi-meta">across 2 fill-ups</div></div>
        <div className="kpi"><div className="kpi-label">Tools & equipment</div><div className="kpi-value">{fmt$0(byCat['Tools & equipment'] || 0)}</div><div className="kpi-meta">1 capital purchase</div></div>
      </div>

      <Card pad={false}>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icons.Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-faint)' }} />
            <input className="input" placeholder="Search expenses, vendors…" style={{ paddingLeft: 30 }}/>
          </div>
          <select className="input" style={{ width: 180 }}>
            <option>All categories</option>
            {Object.keys(byCat).map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input" style={{ width: 140 }}><option>This month</option><option>Last month</option><option>YTD</option></select>
        </div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Vendor</th><th className="col-num">Amount</th></tr></thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id}>
                <td className="muted">{e.date}</td>
                <td className="strong">{e.desc}</td>
                <td><Pill kind={({'Parts & supplies':'accent','Fuel':'amber','Tools & equipment':'blue','Insurance':'red','Marketing':'green','Other':'gray'})[e.category] || 'gray'}>{e.category}</Pill></td>
                <td className="muted">{e.vendor}</td>
                <td className="col-num mono strong" style={{ color: 'var(--danger-fg)' }}>−{fmt$(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

window.Payments = Payments;
window.PaymentPlans = PaymentPlans;
window.Expenses = Expenses;
