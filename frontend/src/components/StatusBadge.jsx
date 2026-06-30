const STYLES = {
  red:    { bg: '#fee2e2', border: '#f87171', text: '#991b1b', dot: '#ef4444' },
  yellow: { bg: '#fef9c3', border: '#fbbf24', text: '#78350f', dot: '#f59e0b' },
  green:  { bg: '#dcfce7', border: '#86efac', text: '#14532d', dot: '#22c55e' },
};

// Workflow lifecycle status → label + color tier.
export const WORKFLOW_META = {
  needs_review: { label: 'Needs Review', key: 'red' },
  in_progress:  { label: 'In Progress',  key: 'yellow' },
  cleared:      { label: 'Cleared',      key: 'green' },
};

export default function StatusBadge({ status }) {
  const meta = WORKFLOW_META[status] || WORKFLOW_META.needs_review;
  const s    = STYLES[meta.key];
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           5,
      padding:       '2px 8px',
      borderRadius:  9999,
      border:        `1px solid ${s.border}`,
      background:    s.bg,
      color:         s.text,
      fontSize:      12,
      fontWeight:    700,
      letterSpacing: '0.04em',
      whiteSpace:    'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}
