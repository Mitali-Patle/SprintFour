import { useState } from 'react';

export default function BulkClear({ greenDocs, onClear }) {
  const [selected, setSelected]   = useState(new Set());
  const [loading,  setLoading]    = useState(false);

  const uncleared = greenDocs.filter(d => !d.cleared);
  if (uncleared.length === 0) return null;

  function toggleAll() {
    if (selected.size === uncleared.length) setSelected(new Set());
    else setSelected(new Set(uncleared.map(d => d.id)));
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleClear() {
    if (selected.size === 0) return;
    setLoading(true);
    await onClear([...selected]);
    setSelected(new Set());
    setLoading(false);
  }

  return (
    <div style={{
      border:       '1px solid #86efac',
      borderRadius: 10,
      background:   '#f0fdf4',
      padding:      16,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <strong style={{ fontSize: 14, color: '#14532d' }}>
          {uncleared.length} green document{uncleared.length > 1 ? 's' : ''} — safe to clear
        </strong>
        <button
          onClick={toggleAll}
          style={{ fontSize: 13, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {selected.size === uncleared.length ? 'Deselect all' : 'Select all'}
        </button>
        {selected.size > 0 && (
          <button
            onClick={handleClear}
            disabled={loading}
            style={{
              marginLeft:   'auto',
              padding:      '5px 16px',
              borderRadius: 6,
              border:       '1px solid #16a34a',
              background:   '#16a34a',
              color:        '#fff',
              fontSize:     13,
              fontWeight:   600,
              cursor:       loading ? 'not-allowed' : 'pointer',
              opacity:      loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Clearing…' : `Clear ${selected.size} doc${selected.size > 1 ? 's' : ''}`}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {uncleared.map(doc => (
          <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selected.has(doc.id)}
              onChange={() => toggle(doc.id)}
            />
            {doc.title}
          </label>
        ))}
      </div>
    </div>
  );
}
