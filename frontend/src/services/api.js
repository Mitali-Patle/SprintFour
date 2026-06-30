const BASE = '/api';

async function req(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const body = await r.json(); msg = body.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}

export const fetchDocuments = ()          => req(`${BASE}/documents`);
export const fetchDocument  = id          => req(`${BASE}/documents/${id}`);
export const fetchAudit     = ()          => req(`${BASE}/audit`);

export const patchSpan = (docId, spanId, action) =>
  req(`${BASE}/documents/${docId}/spans/${spanId}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action }),
  });

export const propagatePreview = (docId, entityId) =>
  req(`${BASE}/documents/${docId}/propagate?entityId=${encodeURIComponent(entityId)}`);

export const propagate = (docId, entityId, action) =>
  req(`${BASE}/documents/${docId}/propagate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ entityId, action }),
  });

export const finalizeDocument = id =>
  req(`${BASE}/documents/${id}/finalize`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
  });

export const bulkClear = ids =>
  req(`${BASE}/documents/bulk-clear`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ids }),
  });
