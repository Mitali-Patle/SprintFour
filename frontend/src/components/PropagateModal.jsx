import { useEffect, useRef, useState } from 'react';
import { propagatePreview } from '../services/api';
import { plural } from '../lib/meta';

// Confirms an entity-wide decision. The blast radius is loaded and shown
// before either action is enabled.
export default function PropagateModal({ docId, span, busy, onConfirm, onCancel }) {
  const [scope, setScope] = useState(null);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    let live = true;
    propagatePreview(docId, span.entityId)
      .then(s => { if (live) setScope(s); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [docId, span.entityId]);

  const cancel = useRef(onCancel);
  useEffect(() => { cancel.current = onCancel; });

  // Focus the dialog once on open; Escape closes it.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = e => { if (e.key === 'Escape') cancel.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const noop     = scope && scope.spanPending === 0;
  const disabled = !scope || noop || busy;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="propagate-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <h3 id="propagate-title" style={{ margin: '0 0 12px', fontSize: 16 }}>
          Apply to every document with this entity?
        </h3>

        <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 14px' }}>
          <strong>&ldquo;{span.text}&rdquo;</strong> ({span.type}) is a recurring entity. Your decision is
          applied to its pending spans in every open document.
        </p>

        <div className="scope-box" aria-live="polite">
          {error && <span className="error-text">Couldn’t load scope: {error}</span>}
          {!error && !scope && <span className="muted">Calculating scope…</span>}
          {!error && scope && (noop ? (
            <span>
              Mentioned in {plural(scope.totalDocCount, 'document')}, but nothing is left to change:
              every open mention has already been reviewed.
            </span>
          ) : (
            <span>
              Will update <strong>{plural(scope.spanPending, 'pending span')}</strong> across{' '}
              <strong>{plural(scope.docCount, 'document')}</strong>.
              {scope.clearedDocCount > 0 && (
                <> {plural(scope.clearedDocCount, 'cleared document')} will not be touched.</>
              )}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-accept" style={{ flex: 1 }} disabled={disabled} onClick={() => onConfirm(span, 'accept')}>
            Accept all
          </button>
          <button type="button" className="btn btn-reject" style={{ flex: 1 }} disabled={disabled} onClick={() => onConfirm(span, 'reject')}>
            Reject all
          </button>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
