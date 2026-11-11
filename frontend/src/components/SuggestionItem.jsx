import { useEffect, useRef } from 'react';
import { explain } from '../lib/suggestions';

// One suggestion. The explanation is always shown before the actions.
export default function SuggestionItem({ span, isActive, readOnly, busy, onActivate, onAction, onPropagate }) {
  const ref = useRef(null);

  // Keep the active suggestion visible while moving through the list with the keyboard.
  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [isActive]);

  const stop = fn => e => { e.stopPropagation(); fn(); };

  return (
    <div
      ref={ref}
      className={`suggestion${isActive ? ' is-active' : ''}`}
      onClick={() => onActivate(span.spanId)}
      aria-current={isActive || undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <SourceBadge source={span.source} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{span.type}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#374151', wordBreak: 'break-all' }}>
          &ldquo;{span.text}&rdquo;
        </span>
        {span.confidence != null && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
            conf {(span.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 10px', lineHeight: 1.5 }}>
        {explain(span)}
      </p>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-accept" disabled={busy} onClick={stop(() => onAction(span, 'accept'))}>
            Accept <kbd>a</kbd>
          </button>
          <button type="button" className="btn btn-reject" disabled={busy} onClick={stop(() => onAction(span, 'reject'))}>
            Reject <kbd>r</kbd>
          </button>
          {span.entityId && (
            <button type="button" className="btn btn-info" disabled={busy} onClick={stop(() => onPropagate(span))}>
              Propagate…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }) {
  const isRecall = source === 'recall';
  return (
    <span
      title={isRecall ? 'Found by the recall scan: the detector may have missed this' : 'Found by the detector'}
      style={{
        fontSize:      11,
        fontWeight:    700,
        padding:       '1px 6px',
        borderRadius:  4,
        background:    isRecall ? '#fee2e2' : '#fef9c3',
        color:         isRecall ? '#991b1b' : '#78350f',
        letterSpacing: '0.02em',
      }}
    >
      {isRecall ? 'MISS?' : 'DETECT'}
    </span>
  );
}
