/* global React, DATA2, fmt$, fmt$0, Card, Pill, Icons */

function Report() {
  const expenses = DATA2.expenses;
  const payments = DATA2.payments;
  const income = payments.reduce((s, p) => s + p.amount, 0);
  const expense = expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - expense;

  // Synthesized monthly bars (Jan–May)
  const months = [
    { m: 'Jan', i: 8420, e: 3120 },
    { m: 'Feb', i: 7180, e: 2640 },
    { m: 'Mar', i: 9620, e: 4220 },
    { m: 'Apr', i: 8740, e: 3520 },
    { m: 'May', i: 10420, e: 3000 },
  ];
  const max = Math.max(...months.flatMap(m => [m.i, m.e]));

  // Top categories
  const byCat = {};
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">P&L Report</div>
          <div className="page-sub">Period: May 1 – 20, 2026 · YTD net profit {fmt$0(net + 18420)}</div>
        </div>
        <div className="page-actions">
          <select className="input" style={{ width: 160 }}>
            <option>This month</option><option>Last month</option><option>YTD</option><option>Last 12 months</option>
          </select>
          <button className="btn"><Icons.Print size={14}/> Export for accountant</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Income</div><div className="kpi-value" style={{ color: 'var(--success-fg)' }}>{fmt$0(income)}</div><div className="kpi-meta"><span className="kpi-delta up">+18%</span><span>vs. last month</span></div></div>
        <div className="kpi"><div className="kpi-label">Expenses</div><div className="kpi-value" style={{ color: 'var(--danger-fg)' }}>−{fmt$0(expense)}</div><div className="kpi-meta"><span className="kpi-delta down">+8%</span><span>vs. last month</span></div></div>
        <div className="kpi"><div className="kpi-label">Net profit</div><div className="kpi-value">{fmt$0(net)}</div><div className="kpi-meta"><span className="kpi-delta up">+22%</span><span>{Math.round((net / income) * 100)}% margin</span></div></div>
        <div className="kpi"><div className="kpi-label">YTD net</div><div className="kpi-value">{fmt$0(net + 18420)}</div><div className="kpi-meta">2026 to date</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title="Income vs. expenses" sub="Last 5 months">
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 18, padding: '20px 4px 4px', height: 200 }}>
            {months.map(m => (
              <div key={m.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'flex-end', width: '100%', justifyContent: 'center', minHeight: 0 }}>
                  <div style={{
                    width: 18,
                    height: `${(m.i / max) * 100}%`,
                    background: 'var(--success)',
                    borderRadius: '3px 3px 0 0',
                  }} title={`Income: ${fmt$0(m.i)}`}/>
                  <div style={{
                    width: 18,
                    height: `${(m.e / max) * 100}%`,
                    background: 'var(--danger)',
                    opacity: 0.85,
                    borderRadius: '3px 3px 0 0',
                  }} title={`Expenses: ${fmt$0(m.e)}`}/>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)' }}>{m.m}</div>
                <div className="mono num" style={{ fontSize: 11, color: 'var(--success-fg)', fontWeight: 600 }}>{fmt$0(m.i - m.e)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--fg-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--success)', borderRadius: 2 }}/>Income</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--danger)', opacity: 0.85, borderRadius: 2 }}/>Expenses</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>Net per month displayed below</span>
          </div>
        </Card>

        <Card title="Expense breakdown" sub="By category, this month">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byCat).sort((a,b) => b[1] - a[1]).map(([cat, amt]) => {
              const pct = (amt / expense) * 100;
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{cat}</span>
                    <span className="mono num" style={{ fontWeight: 600 }}>{fmt$0(amt)} <span className="faint" style={{ fontSize: 10 }}>· {pct.toFixed(0)}%</span></span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 4 }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="P&L statement" sub="May 1 – 20, 2026" pad>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div className="label-up" style={{ marginBottom: 8 }}>Income</div>
            <ReportRow label="Labor revenue" value={fmt$(income * 0.55)}/>
            <ReportRow label="Parts revenue (margin)" value={fmt$(income * 0.30)}/>
            <ReportRow label="Trip / mobile fees" value={fmt$(income * 0.10)}/>
            <ReportRow label="Tips" value={fmt$(income * 0.05)}/>
            <ReportRow label="Total income" value={fmt$(income)} strong/>
          </div>
          <div>
            <div className="label-up" style={{ marginBottom: 8 }}>Expenses</div>
            {Object.entries(byCat).sort((a,b) => b[1] - a[1]).map(([cat, amt]) => (
              <ReportRow key={cat} label={cat} value={`−${fmt$(amt)}`} negative/>
            ))}
            <ReportRow label="Total expenses" value={`−${fmt$(expense)}`} strong negative/>
          </div>
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '2px solid var(--fg)' }}>
          <ReportRow label="Net profit" value={fmt$(net)} strong big/>
        </div>
      </Card>
    </>
  );
}

function ReportRow({ label, value, strong, negative, big }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '7px 0',
      fontSize: big ? 16 : 13,
      fontWeight: strong ? 600 : 400,
      borderBottom: strong ? 'none' : '1px solid var(--border)',
      color: negative && !strong ? 'var(--fg-muted)' : 'var(--fg)',
    }}>
      <span>{label}</span>
      <span className="mono num" style={{ color: negative && strong ? 'var(--danger-fg)' : strong && big ? 'var(--success-fg)' : undefined }}>{value}</span>
    </div>
  );
}

window.Report = Report;
