// A single highlighted entity in the document text view.
// children = the raw text slice (from start..end offsets).

const SOURCE_COLORS = {
  detector: { bg: '#fef3c7', border: '#f59e0b' },
  recall:   { bg: '#fee2e2', border: '#f87171' },
};

const STATUS_OPACITY = { pending: 1, accepted: 0.4, rejected: 0.25 };

export default function EntitySpan({ span, isActive, onClick, children }) {
  const colors  = SOURCE_COLORS[span.source] || SOURCE_COLORS.detector;
  const opacity = STATUS_OPACITY[span.reviewStatus] ?? 1;
  const confStr = span.confidence != null ? ` · conf ${(span.confidence * 100).toFixed(0)}%` : ' · recall scan';

  return (
    <mark
      title={`${span.type} · ${span.source}${confStr}`}
      onClick={() => onClick?.(span)}
      style={{
        background:    colors.bg,
        border:        `1px solid ${isActive ? '#1d4ed8' : colors.border}`,
        borderRadius:  3,
        padding:       '1px 3px',
        cursor:        'pointer',
        opacity,
        outline:       isActive ? '2px solid #1d4ed8' : 'none',
        outlineOffset: 1,
        transition:    'outline 0.1s',
      }}
    >
      {children}
    </mark>
  );
}
