import { WORKFLOW_META } from './StatusBadge';

const STYLES = {
  red:    { bg: '#fee2e2', border: '#f87171', text: '#991b1b', dot: '#ef4444' },
  yellow: { bg: '#fef9c3', border: '#fbbf24', text: '#78350f', dot: '#f59e0b' },
  green:  { bg: '#dcfce7', border: '#86efac', text: '#14532d', dot: '#22c55e' },
};

export default function TierBadge({ status, reason }) {
  const meta = WORKFLOW_META[status] || WORKFLOW_META.needs_review;
  const s    = STYLES[meta.key];
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          6,
      padding:      '3px 10px',
      borderRadius: 9999,
      border:       `1px solid ${s.border}`,
      background:   s.bg,
      color:        s.text,
      fontSize:     13,
      fontWeight:   500,
      whiteSpace:   'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {meta.label}
      {reason && <span style={{ fontWeight: 400, opacity: 0.85 }}>&nbsp;— {reason}</span>}
    </span>
  );
}
