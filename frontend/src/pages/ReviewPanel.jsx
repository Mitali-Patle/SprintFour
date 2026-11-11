import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SpanHighlighter from '../components/SpanHighlighter';
import SuggestionList  from '../components/SuggestionList';
import StatusBadge     from '../components/StatusBadge';
import TierBadge       from '../components/TierBadge';
import KeyboardHint    from '../components/KeyboardHint';
import PropagateModal  from '../components/PropagateModal';
import Toast           from '../components/Toast';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { isPending, orderSuggestions } from '../lib/suggestions';
import { plural } from '../lib/meta';
import {
  fetchDocument, fetchNextDocId, finalizeDocument, propagate, reviewSpan,
} from '../services/api';

const firstPendingId = spans => orderSuggestions(spans.filter(isPending))[0]?.spanId ?? null;

export default function ReviewPanel() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [doc,          setDoc]          = useState(null);
  const [loadError,    setLoadError]    = useState(null);
  const [activeSpanId, setActiveSpanId] = useState(null);
  const [propagateFor, setPropagateFor] = useState(null);
  const [busy,         setBusy]         = useState(false);
  const [toast,        setToast]        = useState(null);

  const notify = useCallback((msg, tone = 'success') => setToast({ msg, tone, at: Date.now() }), []);

  // The route keys this component by document id, so all state starts fresh per document.
  const load = useCallback(() =>
    fetchDocument(id).then(
      data => {
        setDoc(data);
        setLoadError(null);
        setActiveSpanId(current =>
          data.spans.some(s => s.spanId === current && isPending(s)) ? current : firstPendingId(data.spans));
      },
      e => setLoadError(e),
    ), [id]);

  useEffect(() => { load(); }, [load]);

  const readOnly = doc?.workflowStatus === 'cleared';
  const pending  = doc ? orderSuggestions(doc.spans.filter(isPending)) : [];

  async function handleAction(span, action) {
    if (busy || readOnly) return;
    setBusy(true);
    try {
      const res = await reviewSpan(doc.id, span.spanId, action);
      const spans = doc.spans.map(s => (s.spanId === span.spanId ? res.span : s));
      setDoc({ ...doc, spans, workflowStatus: res.workflowStatus });
      setActiveSpanId(firstPendingId(spans));
      notify(`${action === 'accept' ? 'Accepted' : 'Rejected'}: “${span.text}”`, action === 'accept' ? 'success' : 'danger');
    } catch (e) {
      notify(e.message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function confirmPropagate(span, action) {
    setBusy(true);
    try {
      const result = await propagate(doc.id, span.entityId, action);
      setPropagateFor(null);
      notify(`Applied “${action}” to ${plural(result.affected.length, 'span')} across documents.`);
      await load();
    } catch (e) {
      notify(e.message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function goToNextDocument() {
    try {
      const nextId = await fetchNextDocId(doc.id);
      if (nextId) navigate(`/review/${nextId}`);
      else navigate('/', { state: { notice: 'Queue empty. Every document has been cleared.' } });
    } catch (e) {
      notify(e.message, 'danger');
    }
  }

  async function handleFinalize() {
    if (busy || readOnly) return;
    if (pending.length > 0) {
      notify(`Review all ${plural(pending.length, 'suggestion')} before finalizing.`, 'warning');
      return;
    }
    setBusy(true);
    try {
      await finalizeDocument(doc.id);
      notify('Document cleared.');
      await goToNextDocument();
    } catch (e) {
      notify(e.message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  function moveActive(step) {
    if (pending.length === 0) return;
    const i = pending.findIndex(s => s.spanId === activeSpanId);
    const next = (i + step + pending.length) % pending.length;
    setActiveSpanId(pending[next].spanId);
  }

  const activeSpan = pending.find(s => s.spanId === activeSpanId);

  useKeyboardShortcuts({
    a:      () => activeSpan && handleAction(activeSpan, 'accept'),
    r:      () => activeSpan && handleAction(activeSpan, 'reject'),
    j:      () => moveActive(1),
    k:      () => moveActive(-1),
    f:      () => handleFinalize(),
    n:      () => goToNextDocument(),
    escape: () => navigate('/'),
  }, Boolean(doc) && !propagateFor);

  if (loadError) {
    return (
      <main className="page">
        <BackLink />
        <p className="error-text" role="alert">
          {loadError.status === 404 ? 'Document not found.' : `Couldn’t load document: ${loadError.message}`}
        </p>
        {loadError.status !== 404 && <button type="button" className="btn" onClick={load}>Retry</button>}
      </main>
    );
  }

  if (!doc) return <main className="page"><p className="muted">Loading…</p></main>;

  return (
    <main className="page page-wide">
      <header className="review-header">
        <BackLink />
        <h1 className="review-title" title={doc.title}>{doc.title}</h1>
        <StatusBadge status={doc.workflowStatus} />
        <FinalizeButton pending={pending.length} cleared={readOnly} busy={busy} onFinalize={handleFinalize} />
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 12px' }}>
        <TierBadge tier={doc.tier} reason={doc.tierReason} />
      </div>

      <KeyboardHint />

      <div className="review-grid">
        <section className="panel panel-doc" aria-label="Document text">
          <SpanHighlighter
            text={doc.text}
            spans={doc.spans}
            activeSpanId={activeSpanId}
            onSpanClick={span => setActiveSpanId(span.spanId)}
          />
        </section>

        <section className="panel" aria-label="Suggestions">
          <h2 className="panel-title">
            AI Suggestions <span className="muted" style={{ fontWeight: 400 }}>{pending.length} pending</span>
          </h2>
          <SuggestionList
            spans={doc.spans}
            activeSpanId={activeSpanId}
            readOnly={readOnly}
            busy={busy}
            onActivate={setActiveSpanId}
            onAction={handleAction}
            onPropagate={setPropagateFor}
          />
        </section>
      </div>

      {propagateFor && (
        <PropagateModal
          docId={doc.id}
          span={propagateFor}
          busy={busy}
          onConfirm={confirmPropagate}
          onCancel={() => setPropagateFor(null)}
        />
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </main>
  );
}

function BackLink() {
  return <Link to="/" className="btn btn-ghost">← Dashboard</Link>;
}

function FinalizeButton({ pending, cleared, busy, onFinalize }) {
  if (cleared) return <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Finalized</span>;
  const blocked = pending > 0;
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={onFinalize}
      disabled={blocked || busy}
      title={blocked ? `Review all ${plural(pending, 'suggestion')} to finalize` : 'Finalize review (f)'}
    >
      Finalize Review {!blocked && <kbd>f</kbd>}
    </button>
  );
}
