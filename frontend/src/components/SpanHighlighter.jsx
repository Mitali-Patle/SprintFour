import EntitySpan from './EntitySpan';

// Renders plain document text with every PII span highlighted in place.
export default function SpanHighlighter({ text, spans, activeSpanId, onSpanClick }) {
  if (!text) return null;

  const sorted   = [...spans].sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;

  for (const span of sorted) {
    if (span.start < cursor) continue; // overlapping spans are rejected upstream; be defensive
    if (span.start > cursor) segments.push({ key: `t${cursor}`, content: text.slice(cursor, span.start) });
    segments.push({ key: span.spanId, span, content: text.slice(span.start, span.end) });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ key: `t${cursor}`, content: text.slice(cursor) });

  return (
    <pre className="doc-text">
      {segments.map(seg => seg.span
        ? (
          <EntitySpan
            key={seg.key}
            span={seg.span}
            isActive={seg.span.spanId === activeSpanId}
            onClick={onSpanClick}
          >
            {seg.content}
          </EntitySpan>
        )
        : <span key={seg.key}>{seg.content}</span>
      )}
    </pre>
  );
}
