import SuggestionItem from './SuggestionItem';

// Recall (possible miss) first; within each source, lower confidence first.
function sortPending(spans) {
  return [...spans].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'recall' ? -1 : 1;
    const ca = a.confidence ?? -1;
    const cb = b.confidence ?? -1;
    return ca - cb;
  });
}

export default function SuggestionList({
  spans,
  activeSpanId,
  onActivate,
  onAction,
  onPropagate,
}) {
  const pending  = sortPending(spans.filter(s => s.reviewStatus === 'pending'));
  const reviewed = spans.filter(s => s.reviewStatus !== 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pending.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: 14 }}>All spans reviewed.</p>
      )}

      {pending.map(span => (
        <SuggestionItem
          key={span.spanId}
          span={span}
          isActive={span.spanId === activeSpanId}
          onActivate={onActivate}
          onAction={onAction}
          onPropagate={onPropagate}
        />
      ))}

      {reviewed.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
            {reviewed.length} reviewed span{reviewed.length > 1 ? 's' : ''}
          </summary>
          {reviewed.map(span => (
            <div key={span.spanId} style={{ fontSize: 13, padding: '4px 0', color: '#6b7280' }}>
              <span style={{ textDecoration: 'line-through' }}>{span.text}</span>
              {' '}— {span.reviewStatus}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
