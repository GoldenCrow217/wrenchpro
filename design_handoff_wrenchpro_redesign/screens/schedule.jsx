/* global React, DATA, Card, Icons */

function Schedule() {
  const [weekOffset, setWeekOffset] = React.useState(0);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Pretend week of May 17–23, 2026
  const dates = [17, 18, 19, 20, 21, 22, 23];
  const todayIdx = 3; // Wed

  // Hours: 7am–7pm
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  const hourLabel = h => {
    const am = h < 12;
    const h12 = h % 12 || 12;
    return `${h12} ${am ? 'AM' : 'PM'}`;
  };

  const colorMap = {
    amber:  { bg: 'var(--accent-soft)', fg: 'var(--accent-fg)', bar: 'var(--accent)' },
    blue:   { bg: 'var(--info-soft)',   fg: 'var(--info-fg)',   bar: 'var(--info)' },
    green:  { bg: 'var(--success-soft)', fg: 'var(--success-fg)', bar: 'var(--success)' },
    violet: { bg: 'oklch(94% 0.04 290)', fg: 'oklch(38% 0.13 290)', bar: 'oklch(56% 0.16 290)' },
    rose:   { bg: 'oklch(94% 0.04 15)', fg: 'oklch(38% 0.13 15)',   bar: 'oklch(56% 0.16 15)' },
  };

  const ROW_H = 44;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Schedule</div>
          <div className="page-sub">Week of May 17–23, 2026 · 12 appointments · 4 today</div>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button className="btn btn-sm" style={{ border: 'none', borderRight: '1px solid var(--border)', borderRadius: 0 }}>Day</button>
            <button className="btn btn-sm btn-primary" style={{ border: 'none', borderRadius: 0 }}>Week</button>
            <button className="btn btn-sm" style={{ border: 'none', borderLeft: '1px solid var(--border)', borderRadius: 0 }}>Month</button>
          </div>
          <button className="btn"><Icons.Truck size={14}/> Route view</button>
          <button className="btn btn-primary"><Icons.Plus size={14}/> New appointment</button>
        </div>
      </div>

      <Card pad={false}>
        {/* Controls */}
        <div style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <button className="icon-btn" onClick={() => setWeekOffset(w => w - 1)}><Icons.ChevLeft size={16}/></button>
          <div style={{ fontSize: 13, fontWeight: 600 }}>May 17 – 23, 2026</div>
          <button className="icon-btn" onClick={() => setWeekOffset(w => w + 1)}><Icons.ChevRight size={16}/></button>
          <button className="btn btn-sm" style={{ marginLeft: 8 }}>Today</button>
          <div className="spacer"/>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-muted)' }}>
            <Legend color="var(--accent)" label="Personal"/>
            <Legend color="var(--info)" label="Fleet"/>
            <Legend color="var(--success)" label="Commercial"/>
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '54px repeat(7, 1fr)', position: 'relative' }}>
          {/* Header row */}
          <div style={{ borderBottom: '1px solid var(--border)' }} />
          {days.map((d, i) => (
            <div key={i} style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              borderLeft: '1px solid var(--border)',
              background: i === todayIdx ? 'var(--bg-subtle)' : 'transparent',
            }}>
              <div className="label-up" style={{ marginBottom: 2 }}>{d}</div>
              <div style={{
                fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
                color: i === todayIdx ? 'var(--accent)' : 'var(--fg)',
              }}>{dates[i]}</div>
            </div>
          ))}

          {/* Hour rows */}
          {hours.map((h, hi) => (
            <React.Fragment key={h}>
              <div style={{
                height: ROW_H,
                padding: '4px 8px',
                fontSize: 10,
                color: 'var(--fg-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                borderBottom: hi === hours.length - 1 ? 'none' : '1px solid var(--border)',
              }}>{hourLabel(h)}</div>
              {days.map((_, di) => (
                <div key={di} style={{
                  height: ROW_H,
                  borderLeft: '1px solid var(--border)',
                  borderBottom: hi === hours.length - 1 ? 'none' : '1px solid var(--border)',
                  background: di === todayIdx ? 'oklch(98% 0.005 80 / 0.4)' : 'transparent',
                  position: 'relative',
                }}/>
              ))}
            </React.Fragment>
          ))}

          {/* Appointments overlay */}
          <div style={{
            position: 'absolute',
            top: 56, // header height
            left: 54,
            right: 0,
            bottom: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            pointerEvents: 'none',
          }}>
            {DATA.appointments.map((a, i) => {
              const cm = colorMap[a.color] || colorMap.amber;
              const top = (a.h - 7) * ROW_H + 2;
              const height = a.len * ROW_H - 4;
              return (
                <div key={i} style={{
                  gridColumn: `${a.day + 1} / span 1`,
                  gridRow: 1,
                  position: 'relative',
                  pointerEvents: 'auto',
                }}>
                  <div style={{
                    position: 'absolute',
                    left: 4, right: 4,
                    top, height,
                    background: cm.bg,
                    color: cm.fg,
                    borderLeft: `3px solid ${cm.bar}`,
                    borderRadius: 6,
                    padding: '5px 8px',
                    fontSize: 11.5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateX(1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                  >
                    <div style={{ fontWeight: 600, lineHeight: 1.2, marginBottom: 2 }}>{a.title}</div>
                    {height > 30 && <div style={{ opacity: 0.8, fontSize: 10.5 }}>{a.vehicle}</div>}
                    {height > 50 && <div style={{ opacity: 0.65, fontSize: 10, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icons.Pin size={9}/> {a.addr}
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }}/>
      {label}
    </span>
  );
}

window.Schedule = Schedule;
