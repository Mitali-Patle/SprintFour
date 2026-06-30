import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SpanHighlighter from '../components/SpanHighlighter';
import SuggestionList  from '../components/SuggestionList';
import TierBadge       from '../components/TierBadge';
import KeyboardHint    from '../components/KeyboardHint';
import { fetchDocument, patchSpan, propagate, propagatePreview, finalizeDocument } from '../services/api';

export default function ReviewPanel() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [doc,          setDoc]          = useState(null);
  const [activeSpanId, setActiveSpanId] = useState(null);
  const [propagateFor, setPropagateFor] = useState(null); // span awaiting propagation confirm
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const data = await fetchDocument(id);
    setDoc(data);
    const firstPending = data.spans.find(s => s.reviewStatus === 'pending');
    setActiveSpanId(firstPending?.spanId ?? null);
    setLoading(false);
  }

  function showToast(msg, color = '#16a34a') {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleAction(span, action) {
    await patchSpan(doc.id, span.spanId, action);
    setDoc(prev => ({
      ...prev,
      spans: prev.spans.map(s =>
        s.spanId === span.spanId ? { ...s, reviewStatus: action === 'accept' ? 'accepted' : 'rejected' } : s
      ),
    }));
    showToast(`${action === 'accept' ? 'Accepted' : 'Rejected'}: "${span.text}"`, action === 'accept' ? '#16a34a' : '#dc2626');
    // Auto-advance to next pending span
    const remaining = doc.spans.filter(s => s.reviewStatus === 'pending' && s.spanId !== span.spanId);
    setActiveSpanId(remaining[0]?.spanId ?? null);
  }

  async function handlePropagate(span) {
    setPropagateFor(span);
  }

  async function confirmPropagate(span, action) {
    const result = await propagate(doc.id, span.entityId, action);
    setPropagateFor(null);
    showToast(`Applied "${action}" to ${result.affected.length} span(s) across all documents.`);
    load(); // reload to reflect propagated changes
  }

  async function handleFinalize() {
    const pending = doc.spans.filter(s => s.reviewStatus === 'pending').length;
    if (pending > 0) {
      showToast(`Review all ${pending} suggestion${pending > 1 ? 's' : ''} before finalizing.`, '#d97706');
      return;
    }
    try {
      await finalizeDocument(doc.id);
      navigate('/'); // back to dashboard; stats reflect the new Cleared status
    } catch (e) {
      showToast(e.message, '#dc2626');
    }
  }

  // Keyboard shortcuts: a=accept, r=reject, n=next doc
  const handleKey = useCallback((e) => {
    if (propagateFor || !doc) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;

    const activeSpan = doc.spans.find(s => s.spanId === activeSpanId);

    if (e.key === 'a' && activeSpan) { e.preventDefault(); handleAction(activeSpan, 'accept'); }
    if (e.key === 'r' && activeSpan) { e.preventDefault(); handleAction(activeSpan, 'reject'); }
    if (e.key === 'n')               { e.preventDefault(); navigate('/'); }
    if (e.key === 'f')               { e.preventDefault(); handleFinalize(); }
  }, [doc, activeSpanId, propagateFor]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;
  if (!doc)    return <Layout><p style={{ color: '#dc2626' }}>Document not found.</p></Layout>;

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/')}
          style={{ fontSize: 13, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', color: '#374151' }}
        >
          ← Dashboard
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.title}
          </h1>
        </div>
        <TierBadge status={doc.workflowStatus} reason={doc.tierReason} />
        <FinalizeButton
          pending={doc.spans.filter(s => s.reviewStatus === 'pending').length}
          cleared={doc.workflowStatus === 'cleared'}
          onFinalize={handleFinalize}
        />
      </div>

      <KeyboardHint />

      {/* Two-panel layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        {/* Left: document text with highlights */}
        <div style={{
          border:     '1px solid #e5e7eb',
          borderRadius: 8,
          padding:    20,
          background: '#fafafa',
          overflowY:  'auto',
          maxHeight:  'calc(100vh - 180px)',
        }}>
          <SpanHighlighter
            text={doc.text}
            spans={doc.spans}
            activeSpanId={activeSpanId}
            onSpanClick={span => setActiveSpanId(span.spanId)}
          />
        </div>

        {/* Right: suggestion list */}
        <div style={{
          border:     '1px solid #e5e7eb',
          borderRadius: 8,
          padding:    16,
          background: '#fff',
          overflowY:  'auto',
          maxHeight:  'calc(100vh - 180px)',
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
            AI Suggestions
            <span style={{ fontWeight: 400, fontSize: 13, color: '#6b7280', marginLeft: 8 }}>
              {doc.spans.filter(s => s.reviewStatus === 'pending').length} pending
            </span>
          </h2>
          <SuggestionList
            spans={doc.spans}
            activeSpanId={activeSpanId}
            onActivate={setActiveSpanId}
            onAction={handleAction}
            onPropagate={handlePropagate}
          />
        </div>
      </div>

      {/* Propagation confirmation modal */}
      {propagateFor && (
        <PropagateModal
          docId={doc.id}
          span={propagateFor}
          onConfirm={confirmPropagate}
          onCancel={() => setPropagateFor(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position:  'fixed', bottom: 24, right: 24,
          background: toast.color, color: '#fff',
          padding: '10px 20px', borderRadius: 8,
          fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 999,
        }}>
          {toast.msg}
        </div>
      )}
    </Layout>
  );
}

function FinalizeButton({ pending, cleared, onFinalize }) {
  if (cleared) {
    return (
      <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>
        ✓ Finalized
      </span>
    );
  }
  const blocked = pending > 0;
  return (
    <button
      onClick={onFinalize}
      disabled={blocked}
      title={blocked ? `Review all ${pending} suggestion${pending > 1 ? 's' : ''} to finalize` : 'Finalize review (f)'}
      style={{
        padding:      '6px 14px',
        borderRadius: 7,
        border:       `1px solid ${blocked ? '#d1d5db' : '#16a34a'}`,
        background:   blocked ? '#f3f4f6' : '#16a34a',
        color:        blocked ? '#9ca3af' : '#fff',
        fontSize:     13,
        fontWeight:   600,
        cursor:       blocked ? 'not-allowed' : 'pointer',
        whiteSpace:   'nowrap',
      }}
    >
      Finalize Review {!blocked && '(f)'}
    </button>
  );
}

function PropagateModal({ docId, span, onConfirm, onCancel }) {
  const [scope,  setScope]  = useState(null); // { docCount, spanTotal, spanPending }
  const [error,  setError]  = useState(null);

  useEffect(() => {
    let live = true;
    propagatePreview(docId, span.entityId)
      .then(s => { if (live) setScope(s); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [docId, span.entityId]);

  // Nothing left to change — every matching span has already been reviewed.
  const noop = scope && scope.spanPending === 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, maxWidth: 440, width: '90%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Apply to all documents with this entity?</h3>

        <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 14px' }}>
          The entity <strong>&ldquo;{span.text}&rdquo;</strong> ({span.type}) is shared across
          your documents. The action you choose is applied to every document where it appears.
        </p>

        {/* Scope — shown BEFORE the action so the blast radius is explicit. */}
        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '10px 14px', margin: '0 0 20px', fontSize: 13, color: '#374151',
        }}>
          {error && <span style={{ color: '#dc2626' }}>Couldn’t load scope: {error}</span>}
          {!error && !scope && <span style={{ color: '#6b7280' }}>Calculating scope…</span>}
          {!error && scope && (
            noop ? (
              <span>
                Appears in <strong>{scope.docCount}</strong> document{scope.docCount === 1 ? '' : 's'},
                but all matching spans have already been reviewed — nothing left to change.
              </span>
            ) : (
              <span>
                Will update <strong>{scope.spanPending}</strong> pending
                span{scope.spanPending === 1 ? '' : 's'} across{' '}
                <strong>{scope.docCount}</strong> document{scope.docCount === 1 ? '' : 's'}.
              </span>
            )
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            disabled={!scope || noop}
            onClick={() => onConfirm(span, 'accept')}
            style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #16a34a', background: '#dcfce7', color: '#16a34a', fontWeight: 600, cursor: (!scope || noop) ? 'not-allowed' : 'pointer', opacity: (!scope || noop) ? 0.5 : 1, fontSize: 14 }}
          >
            Accept all
          </button>
          <button
            disabled={!scope || noop}
            onClick={() => onConfirm(span, 'reject')}
            style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #dc2626', background: '#fee2e2', color: '#dc2626', fontWeight: 600, cursor: (!scope || noop) ? 'not-allowed' : 'pointer', opacity: (!scope || noop) ? 0.5 : 1, fontSize: 14 }}
          >
            Reject all
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontSize: 14 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Layout({ children }) {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </div>
  );
}
