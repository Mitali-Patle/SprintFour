// One suggestion card. Explanation is shown BEFORE action buttons (never after).

const TYPE_EXPLANATIONS = {
  NAME:    s => `Detected as a person's name via ${s.source === 'recall' ? 'recall scan' : 'PII detector'}.`,
  EMAIL:   s => `Email address${s.source === 'recall' ? ' found by recall scan (detector missed it)' : ' flagged by detector'}.`,
  PHONE:   s => `Phone number${s.source === 'recall' ? ' found by recall scan (detector used narrower pattern)' : ' flagged by detector'}.`,
  SSN:     s => `Social Security Number${s.source === 'recall' ? ' — recall scan matched a 9-digit sequence (may be a routing number)' : ' — high-sensitivity field'}.`,
  ADDRESS: s => `Street address detected by ${s.source}.`,
  DOB:     s => `Date of birth flagged by ${s.source}.`,
  ORG:     s => `Organization name detected by ${s.source}.`,
};

function explanation(span) {
  const fn = TYPE_EXPLANATIONS[span.type];
  return fn ? fn(span) : `${span.type} flagged by ${span.source}.`;
}

export default function SuggestionItem({ span, isActive, onActivate, onAction, onPropagate }) {
  return (
    <div
      onClick={() => onActivate(span.spanId)}
      style={{
        border:       `1px solid ${isActive ? '#1d4ed8' : '#e5e7eb'}`,
        borderRadius: 8,
        padding:      12,
        background:   isActive ? '#eff6ff' : '#fff',
        cursor:       'pointer',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <SourceBadge source={span.source} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{span.type}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#374151' }}>
          &ldquo;{span.text}&rdquo;
        </span>
        {span.confidence != null && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
            conf {(span.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Explanation shown before actions */}
      <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 10px', lineHeight: 1.5 }}>
        {explanation(span)}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionBtn
          label="Accept (a)"
          color="#16a34a"
          bg="#dcfce7"
          onClick={e => { e.stopPropagation(); onAction(span, 'accept'); }}
        />
        <ActionBtn
          label="Reject (r)"
          color="#dc2626"
          bg="#fee2e2"
          onClick={e => { e.stopPropagation(); onAction(span, 'reject'); }}
        />
        {span.entityId && (
          <ActionBtn
            label="Propagate…"
            color="#1d4ed8"
            bg="#eff6ff"
            onClick={e => { e.stopPropagation(); onPropagate(span); }}
          />
        )}
      </div>
    </div>
  );
}

function SourceBadge({ source }) {
  const isRecall = source === 'recall';
  return (
    <span style={{
      fontSize:     11,
      fontWeight:   700,
      padding:      '1px 6px',
      borderRadius: 4,
      background:   isRecall ? '#fee2e2' : '#fef9c3',
      color:        isRecall ? '#991b1b' : '#78350f',
      letterSpacing: '0.02em',
    }}>
      {isRecall ? 'MISS?' : 'DETECT'}
    </span>
  );
}

function ActionBtn({ label, color, bg, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:      '4px 12px',
        borderRadius: 6,
        border:       `1px solid ${color}`,
        background:   bg,
        color,
        fontSize:     13,
        fontWeight:   500,
        cursor:       'pointer',
      }}
    >
      {label}
    </button>
  );
}
