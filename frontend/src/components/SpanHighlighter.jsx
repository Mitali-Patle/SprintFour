import EntitySpan from './EntitySpan';

export default function SpanHighlighter({ text, spans, activeSpanId, onSpanClick }) {
  if (!text) return null;

  const sorted = [...spans].sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;

  for (const span of sorted) {
    if (span.start < cursor) continue;
    if (span.start > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, span.start) });
    }
    segments.push({ type: 'span', span, content: text.slice(span.start, span.end) });
    cursor = span.end;
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', content: text.slice(cursor) });
  }

  return (
    <pre style={{
      fontFamily: 'inherit',
      fontSize:   14,
      lineHeight: 1.7,
      whiteSpace: 'pre-wrap',
      wordBreak:  'break-word',
      margin:     0,
    }}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return seg.content;
        const { span, content } = seg;
        return (
          <EntitySpan
            key={span.spanId}
            span={span}
            isActive={span.spanId === activeSpanId}
            onClick={onSpanClick}
          >
            {content}
          </EntitySpan>
        );
      })}
    </pre>
  );
}
