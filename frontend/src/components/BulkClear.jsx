import { useState } from 'react';
import { plural } from '../lib/meta';

// Clear low-risk (green) documents in one action, without opening each one.
export default function BulkClear({ greenDocs, onClear }) {
  const [selected, setSelected] = useState(() => new Set());
  const [busy,     setBusy]     = useState(false);

  // Drop selections for documents that are no longer offered (e.g. cleared elsewhere).
  const offered = new Set(greenDocs.map(d => d.id));
  const chosen  = [...selected].filter(id => offered.has(id));

  if (greenDocs.length === 0) return null;

  const allSelected = chosen.length === greenDocs.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(greenDocs.map(d => d.id)));
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleClear() {
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      await onClear(chosen);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bulk-clear" aria-label="Bulk clear low-risk documents">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14, color: '#14532d' }}>
          {plural(greenDocs.length, 'low-risk document')}, safe to clear without opening
        </strong>
        <button type="button" className="link-button" onClick={toggleAll}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        {chosen.length > 0 && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={handleClear}
            disabled={busy}
          >
            {busy ? 'Clearing…' : `Clear ${plural(chosen.length, 'doc')}`}
          </button>
        )}
      </div>
      <div className="bulk-clear-list">
        {greenDocs.map(doc => (
          <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggle(doc.id)} />
            {doc.title}
          </label>
        ))}
      </div>
    </section>
  );
}
