const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body:    body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) throw new ApiError(res.status, data?.error || `${res.status} ${res.statusText}`);
  return data;
}

const enc = encodeURIComponent;

export const fetchDocuments   = ()        => request('/documents');
export const fetchDocument    = id        => request(`/documents/${enc(id)}`);
export const fetchNextDocId   = id        => request(`/documents/${enc(id)}/next`).then(r => r.id);
export const fetchAudit       = ()        => request('/audit');

export const reviewSpan       = (docId, spanId, action) =>
  request(`/documents/${enc(docId)}/spans/${enc(spanId)}`, { method: 'PATCH', body: { action } });

export const propagatePreview = (docId, entityId) =>
  request(`/documents/${enc(docId)}/propagate?entityId=${enc(entityId)}`);

export const propagate        = (docId, entityId, action) =>
  request(`/documents/${enc(docId)}/propagate`, { method: 'POST', body: { entityId, action } });

export const finalizeDocument = id  => request(`/documents/${enc(id)}/finalize`, { method: 'POST' });

export const bulkClear        = ids => request('/documents/bulk-clear', { method: 'POST', body: { ids } });
