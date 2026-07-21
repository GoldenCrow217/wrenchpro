/* global React, DATA, Card, Pill, Avatar, Icons, byId */

// Pretend photo galleries — assigned by item key, just a count of fake thumbs
const INSP_PHOTOS = {
  '0-7': 2, // air filter - fail
  '1-1': 1, // rear brake pads - advisory
  '4-2': 1, // turn signal - fail
  '0-4': 1, // belts
};

function Inspection() {
  // Editable status map for each item
  const [statuses, setStatuses] = React.useState(() => {
    const map = {};
    DATA.inspectionCategories.forEach((c, ci) => {
      c.items.forEach((it, ii) => {
        map[`${ci}-${ii}`] = it.status;
      });
    });
    return map;
  });

  // Tally
  const totals = { pass: 0, advisory: 0, fail: 0, na: 0 };
  Object.values(statuses).forEach(s => totals[s]++);
  const total = totals.pass + totals.advisory + totals.fail + totals.na;
  const score = Math.round(((totals.pass + totals.advisory * 0.5) / (total - totals.na || 1)) * 100);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Pre-trip multi-point inspection</div>
          <div className="page-sub" style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4 }}>
            <span>Wed, May 20 · 10:14 AM</span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Avatar initials="DR" color="amber" size="sm"/> Diego R.
            </span>
            <span>·</span>
            <span className="mono">INSP-0094</span>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icons.Print size={14}/> Print</button>
          <button className="btn"><Icons.Send size={14}/> Send to customer</button>
          <button className="btn btn-primary">Mark complete</button>
        </div>
      </div>

      {/* Top: vehicle + summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div className="label-up" style={{ marginBottom: 8 }}>Vehicle inspected</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 64, height: 48, borderRadius: 8, background: 'var(--bg-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fg-muted)', flexShrink: 0,
            }}>
              <Icons.Car size={24} stroke={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>2021 Toyota Highlander XLE AWD</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>3.5L V6 · Gasoline · Blueprint</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span className="tag mono">TLR-0834 · TX</span>
                <span className="tag mono">VIN 5TDGZRBH7MS123456</span>
                <span className="tag mono">48,700 mi</span>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 14, minWidth: 160 }}>
              <div className="label-up" style={{ marginBottom: 4 }}>Customer</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Avatar initials="RD" color="rose" size="sm"/>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Reina Delgado</div>
                  <div className="muted mono" style={{ fontSize: 11 }}>(972) 555-0118</div>
                </div>
              </div>
              <div className="muted" style={{ fontSize: 11 }}>Linked to <span className="mono" style={{ color: 'var(--fg)' }}>WO-2041</span></div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="label-up" style={{ marginBottom: 8 }}>Inspection summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            <SummaryBox color="var(--success-fg)" bg="var(--success-soft)" label="Pass" n={totals.pass}/>
            <SummaryBox color="var(--warning-fg)" bg="var(--warning-soft)" label="Advisory" n={totals.advisory}/>
            <SummaryBox color="var(--danger-fg)"  bg="var(--danger-soft)"  label="Fail" n={totals.fail}/>
            <SummaryBox color="var(--neutral-fg)" bg="var(--neutral-soft)" label="N/A"  n={totals.na}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span className="label-up">Vehicle score</span>
            <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{score}<span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>/100</span></span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-subtle)', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
            <div style={{ flex: totals.pass,     background: 'var(--success)' }}/>
            <div style={{ flex: totals.advisory, background: 'var(--warning)' }}/>
            <div style={{ flex: totals.fail,     background: 'var(--danger)' }}/>
            <div style={{ flex: totals.na || 0.1, background: 'var(--border-strong)' }}/>
          </div>
        </Card>
      </div>

      {/* Categories */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {DATA.inspectionCategories.map((cat, ci) => (
          <Card key={ci} title={cat.name} sub={`${cat.items.length} checks`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {cat.items.map((it, ii) => {
                const key = `${ci}-${ii}`;
                const current = statuses[key];
                return (
                  <div key={ii} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: ii === cat.items.length - 1 ? 'none' : '1px solid var(--border)',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{it.name}</div>
                      {it.note && current === it.status && (
                        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icons.Note size={10}/> {it.note}
                        </div>
                      )}
                      {(current === 'advisory' || current === 'fail') && (
                        <InspectionPhotos
                          itemKey={key}
                          count={INSP_PHOTOS[key] || 0}
                          tone={current}
                        />
                      )}
                    </div>
                    <StatusToggle value={current} onChange={(v) => setStatuses(s => ({ ...s, [key]: v }))} />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function SummaryBox({ color, bg, label, n }) {
  return (
    <div style={{
      background: bg, color: color, padding: 10, borderRadius: 8,
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, opacity: 0.85 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>{n}</div>
    </div>
  );
}

window.Inspection = Inspection;

function StatusToggle({ value, onChange }) {
  const opts = [
    { v: 'pass',     label: 'P', title: 'Pass',     fg: 'var(--success-fg)', bg: 'var(--success-soft)' },
    { v: 'advisory', label: 'A', title: 'Advisory', fg: 'var(--warning-fg)', bg: 'var(--warning-soft)' },
    { v: 'fail',     label: 'F', title: 'Fail',     fg: 'var(--danger-fg)',  bg: 'var(--danger-soft)' },
    { v: 'na',       label: '—', title: 'N/A',      fg: 'var(--neutral-fg)', bg: 'var(--neutral-soft)' },
  ];
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      {opts.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            title={o.title}
            onClick={() => onChange(o.v)}
            style={{
              width: 26, height: 24,
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
              background: active ? o.bg : 'var(--bg-elev)',
              color: active ? o.fg : 'var(--fg-faint)',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.1s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Per-item photo strip with drop-zone. Photos are placeholder swatches.
function InspectionPhotos({ itemKey, count, tone }) {
  const accent = tone === 'fail' ? 'var(--danger)' : 'var(--warning)';
  const accentSoft = tone === 'fail' ? 'var(--danger-soft)' : 'var(--warning-soft)';
  const swatches = [
    'linear-gradient(135deg, oklch(45% 0.03 60) 0%, oklch(25% 0.02 50) 100%)',
    'linear-gradient(135deg, oklch(55% 0.04 50) 0%, oklch(30% 0.02 40) 100%)',
    'linear-gradient(135deg, oklch(60% 0.05 65) 0%, oklch(35% 0.03 55) 100%)',
  ];

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          title={`photo-${itemKey}-${i + 1}.jpg`}
          style={{
            width: 48, height: 36,
            borderRadius: 6,
            background: swatches[i % swatches.length],
            position: 'relative',
            border: `1px solid ${accent}`,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 30% 30%, oklch(70% 0.04 60 / 0.3), transparent 60%)',
          }}/>
          <div style={{
            position: 'absolute', bottom: 2, right: 3,
            fontSize: 8, fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.75)', fontWeight: 600,
          }}>{`P${i+1}`}</div>
        </div>
      ))}
      <button
        title="Add photo"
        style={{
          width: 48, height: 36,
          borderRadius: 6,
          border: `1px dashed ${accent}`,
          background: accentSoft,
          color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <Icons.Plus size={11}/>
      </button>
      {count > 0 && (
        <span className="faint" style={{ fontSize: 10.5 }}>
          {count} photo{count > 1 ? 's' : ''} attached
        </span>
      )}
    </div>
  );
}
