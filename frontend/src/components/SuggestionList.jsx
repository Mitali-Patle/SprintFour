import SuggestionItem from './SuggestionItem';
import { isPending, orderSuggestions } from '../lib/suggestions';
import { plural } from '../lib/meta';

export default function SuggestionList({ spans, activeSpanId, readOnly, busy, onActivate, onAction, onPropagate }) {
  const pending  = orderSuggestions(spans.filter(isPending));
  const reviewed = spans.filter(s => !isPending(s));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pending.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
          {readOnly ? 'This document has been cleared.' : 'All suggestions reviewed. Press f to finalize.'}
        </p>
      )}

      {pending.map(span => (
        <SuggestionItem
          key={span.spanId}
          span={span}
          isActive={span.spanId === activeSpanId}
          readOnly={readOnly}
          busy={busy}
          onActivate={onActivate}
          onAction={onAction}
          onPropagate={onPropagate}
        />
      ))}

      {reviewed.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
            {plural(reviewed.length, 'reviewed span')}
          </summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
            {reviewed.map(span => (
              <li key={span.spanId} style={{ fontSize: 13, padding: '3px 0', color: '#6b7280' }}>
                <span style={{ fontFamily: 'monospace' }}>{span.text}</span>
                {' '}({span.type}):{' '}
                <strong style={{ color: span.reviewStatus === 'accepted' ? '#15803d' : '#b91c1c' }}>
                  {span.reviewStatus}
                </strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
