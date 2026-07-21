/* global React, DATA, byId, fmt$, fmt$0, Card, Pill, JobStatusPill, InvoicePill, Avatar, StatCard, Spark, Icons */

function Dashboard({ onNav, onOpenJob }) {
  const today = DATA.jobs.filter(j => j.date === '2026-05-20');
  const active = DATA.jobs.filter(j => !['Complete', 'Canceled'].includes(j.status));

  // Synthesized weekly revenue (Mon–Sun)
  const week = [1240, 880, 1620, 2050, 1180, 1840, 720];
  const weekTotal = week.reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Good morning, Brandon</div>
          <div className="page-sub">Wednesday, May 20 · 4 jobs on the route today · 1 part on backorder</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Bolt size={14}/> Quick entry</button>
          <button className="btn"><Icons.Plus size={14}/> New customer</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> New job</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label"><span className="dot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} /> Active jobs</div>
          <div className="kpi-value">{active.length}</div>
          <div className="kpi-meta"><span className="kpi-delta up">+2</span><span>vs. yesterday</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Revenue this week</div>
          <div className="kpi-value">{fmt$0(weekTotal)}</div>
          <div style={{ marginTop: 4 }}>
            <Spark data={week} />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-value">{fmt$0(2840)}</div>
          <div className="kpi-meta"><span className="kpi-delta down">3 overdue</span><span>· 5 invoices</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net profit · May</div>
          <div className="kpi-value">{fmt$0(7420)}</div>
          <div className="kpi-meta"><span className="kpi-delta up">+18%</span><span>vs. April</span></div>
        </div>
      </div>

      {/* Main two-column */}
      <div className="grid-dash" style={{ marginBottom: 16 }}>
        {/* Today's route */}
        <Card
          title="Today's route"
          sub="Wednesday, May 20"
          right={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn-sm"><Icons.Pin size={12}/> Open in maps</button>
              <button className="btn btn-sm" onClick={() => onNav('schedule')}>View schedule <Icons.ChevRight size={12}/></button>
            </div>
          }
          pad={false}
        >
          <div style={{ padding: '0' }}>
            {today.map((j, i) => {
              const c = byId(DATA.customers, j.customerId);
              const v = byId(DATA.vehicles, j.vehicleId);
              return (
                <div
                  key={j.id}
                  className="route-row"
                  onClick={() => onOpenJob(j.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 130px 110px',
                    gap: 14,
                    alignItems: 'center',
                    padding: '14px 18px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'var(--bg-subtle)', color: 'var(--fg-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                    }}>{String(i + 1).padStart(2, '0')}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                      <span className="muted" style={{ fontSize: 12 }}>· {v.year} {v.make} {v.model}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                      <span className="muted" style={{ fontSize: 12 }}>{j.service}</span>
                      <span className="faint" style={{ fontSize: 11 }}>· <span className="mono">{j.no}</span></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, color: 'var(--fg-muted)', fontSize: 11 }}>
                      <Icons.Pin size={11}/> {j.addr}
                    </div>
                  </div>
                  <div>
                    <div className="label-up">ETA</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{j.eta}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{j.assignedTo}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <JobStatusPill status={j.status} />
                    <button className="btn btn-sm btn-icon" title="More"><Icons.More size={12}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Action needed */}
          <Card title="Action needed" sub="Pinned items" pad={false}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.Warn size={15}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>3 invoices overdue</div>
                  <div className="muted" style={{ fontSize: 12 }}>Brennan · Park · 2 others · {fmt$0(1480)} total</div>
                </div>
                <button className="btn btn-sm">Follow up</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--warning-soft)', color: 'var(--warning-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.Box size={15}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Low stock — Sprinter fuel filter</div>
                  <div className="muted" style={{ fontSize: 12 }}>2 on hand · reorder at 3 · needed today</div>
                </div>
                <button className="btn btn-sm" onClick={() => onNav('inventory')}>Reorder</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--info-soft)', color: 'var(--info-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.Estimate size={15}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>3 estimates awaiting approval</div>
                  <div className="muted" style={{ fontSize: 12 }}>Sent 2–4 days ago · {fmt$0(3640)} pipeline</div>
                </div>
                <button className="btn btn-sm" onClick={() => onNav('estimates')}>Review</button>
              </div>
            </div>
          </Card>

          {/* Pipeline snapshot */}
          <Card title="Pipeline snapshot" sub="Last 30 days">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'New leads',    n: 12, bar: 70, color: 'var(--info)' },
                { label: 'Contacted',    n: 9,  bar: 55, color: 'var(--info)' },
                { label: 'Quoted',       n: 6,  bar: 38, color: 'var(--warning)' },
                { label: 'Scheduled',    n: 4,  bar: 26, color: 'var(--accent)' },
                { label: 'Won',          n: 8,  bar: 50, color: 'var(--success)' },
              ].map(r => (
                <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 30px', alignItems: 'center', gap: 10 }}>
                  <span className="muted" style={{ fontSize: 12 }}>{r.label}</span>
                  <div style={{ background: 'var(--bg-subtle)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: r.bar + '%', height: '100%', background: r.color, borderRadius: 4 }} />
                  </div>
                  <span className="mono num" style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{r.n}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom row: Activity + Recent payments */}
      <div className="grid-2">
        <Card title="Recent activity" sub="Last 24 hours" pad={false}>
          <div>
            {DATA.activity.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '11px 18px',
                borderBottom: i === DATA.activity.length - 1 ? 'none' : '1px solid var(--border)',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: a.kind === 'alert' ? 'var(--danger)' : a.kind === 'pmt' ? 'var(--success)' : 'var(--accent)',
                  marginTop: 7, flexShrink: 0,
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}><strong style={{ fontWeight: 600 }}>{a.who}</strong> <span className="muted">{a.what}</span></div>
                  <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{a.t}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent payments" sub="Last 7 days" right={<span className="card-link" onClick={() => onNav('finance')}>View all</span>} pad={false}>
          <div>
            {[
              { c: 'Reina Delgado',     initials: 'RD', color: 'rose',   amt: 620.00, method: 'Zelle',  when: 'Today, 9:14 AM', desc: 'WO-2041 — front brakes' },
              { c: 'Bayside Plumbing',  initials: 'BP', color: 'blue',   amt: 178.45, method: 'Check',  when: 'Yesterday',      desc: 'WO-2037 — coolant flush' },
              { c: 'Devon Park',        initials: 'DP', color: 'green',  amt: 198.50, method: 'Card',   when: '2 days ago',     desc: 'WO-2036 — diagnostic + EGR' },
              { c: 'Helen Okafor',      initials: 'HO', color: 'rose',   amt: 203.40, method: 'Venmo',  when: '3 days ago',     desc: 'WO-2035 — AC service' },
              { c: 'Tyler Brennan',     initials: 'TB', color: 'violet', amt: 150.00, method: 'Cash',   when: '3 days ago',     desc: 'WO-2034 — partial' },
            ].map((p, i, arr) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '11px 18px',
                borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
              }}>
                <Avatar initials={p.initials} color={p.color} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.c}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{p.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono num" style={{ fontSize: 13, fontWeight: 600 }}>{fmt$(p.amt)}</div>
                  <div className="faint" style={{ fontSize: 11, marginTop: 1 }}>{p.method} · {p.when}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

window.Dashboard = Dashboard;
