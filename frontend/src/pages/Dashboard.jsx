import { useEffect, useState } from 'react';
import DocCard   from '../components/DocCard';
import BulkClear from '../components/BulkClear';
import { fetchDocuments, fetchAudit, bulkClear } from '../services/api';

export default function Dashboard() {
  const [docs,    setDocs]    = useState([]);
  const [audit,   setAudit]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [docData, auditData] = await Promise.all([fetchDocuments(), fetchAudit()]);
      setDocs(docData);
      setAudit(auditData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkClear(ids) {
    await bulkClear(ids);
    load();
  }

  const active    = docs.filter(d => d.workflowStatus !== 'cleared');
  // Low-risk (detection-green) docs not yet cleared — safe to bulk-clear unopened.
  const greenSafe = docs.filter(d => d.status === 'green' && d.workflowStatus !== 'cleared');
  const counts = {
    needs_review: docs.filter(d => d.workflowStatus === 'needs_review').length,
    in_progress:  docs.filter(d => d.workflowStatus === 'in_progress').length,
    cleared:      docs.filter(d => d.workflowStatus === 'cleared').length,
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;

  if (error) {
    return (
      <Layout>
        <p style={{ color: '#ef4444' }}>Failed to load: {error}</p>
        <button
          onClick={load}
          style={{ marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' }}
        >
          Retry
        </button>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PII Triage Dashboard</h1>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{active.length} active</span>
        <span style={{ fontSize: 13, color: '#ef4444', marginLeft: 'auto' }}>
          {counts.needs_review} Needs Review
        </span>
        <span style={{ fontSize: 13, color: '#f59e0b' }}>
          {counts.in_progress} In Progress
        </span>
        <span style={{ fontSize: 13, color: '#16a34a' }}>
          {counts.cleared} Cleared
        </span>
      </div>

      <BulkClear greenDocs={greenSafe} onClear={handleBulkClear} />

      <div style={{
        display:               'grid',
        gridTemplateColumns:   'repeat(auto-fill, minmax(300px, 1fr))',
        gap:                   12,
      }}>
        {active.map(doc => (
          <DocCard key={doc.id} doc={doc} />
        ))}
      </div>

      {audit.length > 0 && (
        <details style={{ marginTop: 32 }}>
          <summary style={{ fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
            Audit log ({audit.length} entries)
          </summary>
          <div style={{
            fontFamily: 'monospace',
            fontSize:   12,
            marginTop:  8,
            background: '#f9fafb',
            padding:    12,
            borderRadius: 6,
            maxHeight:  200,
            overflowY:  'auto',
          }}>
            {[...audit].reverse().map((entry, i) => (
              <div key={i} style={{ color: '#374151', paddingBottom: 2 }}>
                {entry.ts.slice(0, 19).replace('T', ' ')}&nbsp;&nbsp;
                <strong>{entry.action}</strong>&nbsp;&nbsp;
                {entry.docId}{entry.spanId ? ` / ${entry.spanId}` : ''}&nbsp;&nbsp;
                [{entry.scope}]
              </div>
            ))}
          </div>
        </details>
      )}
    </Layout>
  );
}

function Layout({ children }) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </div>
  );
}
