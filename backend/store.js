'use strict';

const fs   = require('fs');
const path = require('path');

let _docs = [];

function load() {
  _docs = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/dataset.json'), 'utf8')
  );
  return _docs.length;
}

function all() {
  return _docs;
}

function byId(id) {
  return _docs.find(d => d.id === id) || null;
}

function setSpanStatus(docId, spanId, newStatus) {
  const doc = byId(docId);
  if (!doc) return null;
  const span = doc.spans.find(s => s.spanId === spanId);
  if (!span) return null;
  span.reviewStatus = newStatus;
  return { doc, span };
}

function propagate(entityId, newStatus) {
  const affected = [];
  for (const doc of _docs) {
    for (const span of doc.spans) {
      if (span.entityId === entityId && span.reviewStatus === 'pending') {
        span.reviewStatus = newStatus;
        affected.push({ docId: doc.id, spanId: span.spanId });
      }
    }
  }
  return affected;
}

function entityExists(entityId) {
  return _docs.some(d => d.spans.some(s => s.entityId === entityId));
}

// Scope preview for propagation: which docs reference this entity, and how
// many of those spans are still pending (i.e. would actually change).
function entityRefs(entityId) {
  const docIds = [];
  let spanTotal = 0;
  let spanPending = 0;
  for (const doc of _docs) {
    let hit = false;
    for (const span of doc.spans) {
      if (span.entityId === entityId) {
        hit = true;
        spanTotal++;
        if (span.reviewStatus === 'pending') spanPending++;
      }
    }
    if (hit) docIds.push(doc.id);
  }
  return { docCount: docIds.length, docIds, spanTotal, spanPending };
}

function bulkClear(ids) {
  const cleared = [];
  for (const id of ids) {
    const doc = byId(id);
    if (doc && doc.status === 'green') {
      doc.cleared = true;
      cleared.push(id);
    }
  }
  return cleared;
}

// Workflow lifecycle status, derived from review progress + the finalized flag.
// Detection tier (doc.status) is separate metadata; this is the user-facing state.
//   cleared      → document was explicitly finalized (or bulk-cleared)
//   in_progress  → review under way (≥1 span accepted/rejected) but not finalized
//   needs_review → nothing reviewed yet (fresh: pending suggestions / recall hits)
function workflowStatus(doc) {
  if (doc.cleared) return 'cleared';
  if (doc.spans.some(s => s.reviewStatus !== 'pending')) return 'in_progress';
  return 'needs_review';
}

// Finalize a document → mark it Cleared. Refuses while any suggestion is pending.
function finalizeDoc(id) {
  const doc = byId(id);
  if (!doc) return { ok: false, reason: 'not_found' };
  const pending = doc.spans.filter(s => s.reviewStatus === 'pending').length;
  if (pending > 0) return { ok: false, reason: 'pending', pending };
  doc.cleared = true;
  return { ok: true, doc };
}

module.exports = {
  load, all, byId, setSpanStatus, propagate, entityExists, entityRefs,
  bulkClear, workflowStatus, finalizeDoc,
};
