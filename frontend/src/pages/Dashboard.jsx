import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DocCard   from '../components/DocCard';
import BulkClear from '../components/BulkClear';
import Toast     from '../components/Toast';
import { WORKFLOW_META, PALETTE, plural } from '../lib/meta';
import { bulkClear, fetchAudit, fetchDocuments } from '../services/api';

export default function Dashboard() {
  const location = useLocation();
  const [docs,  setDocs]  = useState(null);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(() =>
    location.state?.notice ? { msg: location.state.notice, tone: 'success', at: Date.now() } : null);

  const load = useCallback(() =>
    Promise.all([fetchDocuments(), fetchAudit()]).then(
      ([docData, auditData]) => { setDocs(docData); setAudit(auditData); setError(null); },
      e => setError(e.message),
    ), []);

  useEffect(() => { load(); }, [load]);

  async function handleBulkClear(ids) {
    try {
      const res = await bulkClear(ids);
      const skipped = res.skipped.length ? `, ${res.skipped.length} skipped` : '';
      setToast({ msg: `Cleared ${plural(res.cleared.length, 'document')}${skipped}.`, tone: 'success', at: Date.now() });
    } catch (e) {
      setToast({ msg: e.message, tone: 'danger', at: Date.now() });
    }
    await load();
  }

  if (error) {
    return (
      <main className="page">
        <p className="error-text" role="alert">Failed to load: {error}</p>
        <button type="button" className="btn" onClick={load}>Retry</button>
      </main>
    );
  }

  if (!docs) return <main className="page"><p className="muted">Loading…</p></main>;

  const active    = docs.filter(d => d.workflowStatus !== 'cleared');
  // Low-risk (green) documents nobody has touched can be cleared unopened.
  const greenSafe = docs.filter(d => d.tier === 'green' && d.workflowStatus === 'needs_review');
  const counts    = Object.fromEntries(Object.keys(WORKFLOW_META).map(k => [k, docs.filter(d => d.workflowStatus === k).length]));

  return (
    <main className="page">
      <header className="dash-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PII Triage</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {plural(active.length, 'document')} in the queue, riskiest first
          </p>
        </div>
        <dl className="stat-row">
          {Object.entries(WORKFLOW_META).map(([key, meta]) => (
            <div key={key} className="stat">
              <dt>{meta.label}</dt>
              <dd style={{ color: PALETTE[meta.color].dot }}>{counts[key]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <BulkClear greenDocs={greenSafe} onClear={handleBulkClear} />

      {active.length === 0
        ? <p className="muted">Nothing left to review. Every document is cleared.</p>
        : (
          <div className="doc-grid">
            {active.map(doc => <DocCard key={doc.id} doc={doc} />)}
          </div>
        )}

      {audit.length > 0 && <AuditLog entries={audit} />}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </main>
  );
}

function AuditLog({ entries }) {
  return (
    <details style={{ marginTop: 32 }}>
      <summary className="muted" style={{ fontSize: 13, cursor: 'pointer' }}>
        Audit log ({plural(entries.length, 'entry', 'entries')})
      </summary>
      <ol className="audit-log" reversed>
        {[...entries].reverse().map((e, i) => (
          <li key={`${e.ts}-${i}`}>
            <time dateTime={e.ts}>{new Date(e.ts).toLocaleString()}</time>{'  '}
            <strong>{e.action}</strong>{'  '}
            {e.scope === 'propagate'
              ? <>{e.entityId} → {plural(e.affected ?? 0, 'span')}</>
              : <>{e.docId}{e.spanId ? ` / ${e.spanId}` : ''}</>}
            {'  '}<span className="muted">[{e.scope}]</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
