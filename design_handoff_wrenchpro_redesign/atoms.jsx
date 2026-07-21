/* global React, Icons */

// ============================================================
// Shared atoms used across screens
// ============================================================

function Pill({ kind = 'gray', children, dot }) {
  const cls = {
    gray: '', green: 'pill-green', amber: 'pill-amber', red: 'pill-red',
    blue: 'pill-blue', accent: 'pill-accent',
  }[kind] || '';
  return (
    <span className={`pill ${cls}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

const JOB_STATUS = {
  'Pending':          { kind: 'gray',  dot: true },
  'Confirmed':        { kind: 'blue',  dot: true },
  'En Route':         { kind: 'amber', dot: true },
  'In Progress':      { kind: 'accent', dot: true },
  'Waiting on Parts': { kind: 'amber', dot: true },
  'Complete':         { kind: 'green', dot: true },
  'Canceled':         { kind: 'red',   dot: true },
};

function JobStatusPill({ status }) {
  const s = JOB_STATUS[status] || { kind: 'gray', dot: true };
  return <Pill kind={s.kind} dot>{status}</Pill>;
}

function InvoicePill({ status }) {
  const map = { 'Paid': 'green', 'Unpaid': 'amber', 'Partial': 'blue', 'Voided': 'gray' };
  return <Pill kind={map[status] || 'gray'}>{status}</Pill>;
}

function Avatar({ initials, color = 'amber', size = 'md' }) {
  const cls = { sm: 'avatar-sm', md: '', lg: 'avatar-lg' }[size] || '';
  return <span className={`avatar avatar-${color} ${cls}`}>{initials}</span>;
}

function StatCard({ label, value, sub, accent, delta, deltaDir }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: 'var(--accent)' } : null}>{value}</div>
      {(sub || delta) && (
        <div className="kpi-meta">
          {delta && <span className={`kpi-delta ${deltaDir === 'up' ? 'up' : deltaDir === 'down' ? 'down' : ''}`}>{delta}</span>}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

function Card({ title, sub, right, children, pad = true, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || right) && (
        <div className="card-head">
          <div>
            <div className="card-title">{title}</div>
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </div>
  );
}

// Tiny sparkline (last 14 points). Smooth area.
function Spark({ data, color, fill }) {
  const w = 100, h = 32, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(1, max - min);
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / (data.length - 1));
  const ys = data.map(v => h - pad - ((v - min) / span) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const area = `${d} L ${xs[xs.length - 1]} ${h} L ${xs[0]} ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill={fill || 'var(--accent-soft)'} opacity="0.7" />
      <path d={d} fill="none" stroke={color || 'var(--accent)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

window.Pill = Pill;
window.JobStatusPill = JobStatusPill;
window.InvoicePill = InvoicePill;
window.Avatar = Avatar;
window.StatCard = StatCard;
window.Card = Card;
window.Spark = Spark;
