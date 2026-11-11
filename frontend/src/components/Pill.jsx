import { PALETTE } from '../lib/meta';

// Colored pill used by both the workflow and the tier badges.
export default function Pill({ color, children, title, size = 12 }) {
  const s = PALETTE[color] ?? PALETTE.yellow;
  return (
    <span
      title={title}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          5,
        padding:      '2px 8px',
        borderRadius: 9999,
        border:       `1px solid ${s.border}`,
        background:   s.bg,
        color:        s.text,
        fontSize:     size,
        fontWeight:   600,
        whiteSpace:   'nowrap',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {children}
    </span>
  );
}
