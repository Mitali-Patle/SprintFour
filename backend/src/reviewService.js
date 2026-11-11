'use strict';

const { badRequest, notFound, conflict } = require('./httpError');

/**
 * Review service: owns the in-memory document set and every rule about how a
 * human review can change it.
 *
 * Event-sourced. Each mutating command is validated, applied, then appended to
 * the audit log. On startup the log is replayed through the same apply
 * functions, so review progress survives restarts and the audit log is the
 * single source of truth for "who decided what".
 *
 * Two independent axes per document:
 *   tier            detection risk, precomputed at ingestion  (red | yellow | green)
 *   workflowStatus  human progress, derived from review state (needs_review | in_progress | cleared)
 */

const ACTIONS     = new Set(['accept', 'reject']);
const TIER_ORDER  = { red: 0, yellow: 1, green: 2 };
const FLOW_ORDER  = { needs_review: 0, in_progress: 1, cleared: 2 };
const MAX_BULK    = 1000;

const statusFor = action => (action === 'accept' ? 'accepted' : 'rejected');
const isPending = span => span.reviewStatus === 'pending';

function assertAction(action) {
  if (!action) throw badRequest('action is required');
  if (!ACTIONS.has(action)) throw badRequest('action must be "accept" or "reject"');
}

/**
 * @param {{ documents: object[], auditLog: ReturnType<import('./auditLog').createAuditLog>, logger?: Console }} deps
 */
function createReviewService({ documents, auditLog, logger = console }) {
  // Deep copy: the seed dataset must never be mutated, so tests and restarts
  // always begin from the same baseline.
  const docs = structuredClone(documents).map(d => ({ ...d, cleared: Boolean(d.cleared) }));
  const byId = new Map(docs.map(d => [d.id, d]));

  // ── Queries ────────────────────────────────────────────────────────────

  function workflowStatus(doc) {
    if (doc.cleared) return 'cleared';
    if (doc.spans.some(s => !isPending(s))) return 'in_progress';
    return 'needs_review';
  }

  function getDoc(id) {
    const doc = byId.get(id);
    if (!doc) throw notFound('Document not found');
    return doc;
  }

  function summary(doc) {
    return {
      id:             doc.id,
      title:          doc.title,
      category:       doc.category,
      tier:           doc.tier,
      workflowStatus: workflowStatus(doc),
      confidence:     doc.confidence,
      tierReason:     doc.tierReason,
      spanCount:      doc.spans.length,
      pendingCount:   doc.spans.filter(isPending).length,
      recallCount:    doc.spans.filter(s => s.source === 'recall').length,
    };
  }

  /** Triage queue: lifecycle first (fresh work on top), then risk, then least-confident. */
  function listDocuments() {
    return docs.map(summary).sort((a, b) =>
      (FLOW_ORDER[a.workflowStatus] - FLOW_ORDER[b.workflowStatus]) ||
      (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) ||
      (a.confidence - b.confidence) ||
      a.id.localeCompare(b.id)
    );
  }

  function getDocument(id) {
    const doc = getDoc(id);
    return { ...structuredClone(doc), workflowStatus: workflowStatus(doc) };
  }

  /** The most urgent document still awaiting review, other than `currentId`. */
  function nextDocument(currentId) {
    const next = listDocuments().find(d => d.workflowStatus !== 'cleared' && d.id !== currentId);
    return next ? next.id : null;
  }

  function stats() {
    const counts = { total: docs.length, needs_review: 0, in_progress: 0, cleared: 0 };
    for (const d of docs) counts[workflowStatus(d)]++;
    return counts;
  }

  /** Which pending spans an entity-wide action would touch. Cleared documents are locked. */
  function propagationTargets(entityId) {
    const targets = [];
    let totalDocs = 0;
    let lockedDocs = 0;
    for (const doc of docs) {
      const matches = doc.spans.filter(s => s.entityId === entityId);
      if (matches.length === 0) continue;
      totalDocs++;
      if (doc.cleared) { lockedDocs++; continue; }
      for (const span of matches) if (isPending(span)) targets.push({ doc, span });
    }
    return { targets, totalDocs, lockedDocs };
  }

  function previewPropagation(docId, entityId) {
    getDoc(docId);
    if (!entityId) throw badRequest('entityId is required');
    const { targets, totalDocs, lockedDocs } = propagationTargets(entityId);
    if (totalDocs === 0) throw notFound('Entity not found');
    const docIds = [...new Set(targets.map(t => t.doc.id))];
    return {
      entityId,
      docCount:       docIds.length, // documents that would actually change
      docIds,
      spanPending:    targets.length,
      totalDocCount:  totalDocs,     // every document that mentions the entity
      clearedDocCount: lockedDocs,
    };
  }

  // ── Apply (shared by live commands and replay; assumes valid input) ────

  const apply = {
    single({ docId, spanId, action }) {
      const doc = getDoc(docId);
      if (doc.cleared) throw conflict('Document is already cleared');
      const span = doc.spans.find(s => s.spanId === spanId);
      if (!span) throw notFound('Span not found');
      span.reviewStatus = statusFor(action);
      return { doc, span };
    },

    propagate({ entityId, action }) {
      const { targets } = propagationTargets(entityId);
      for (const { span } of targets) span.reviewStatus = statusFor(action);
      return targets.map(({ doc, span }) => ({ docId: doc.id, spanId: span.spanId }));
    },

    finalize({ docId }) {
      const doc = getDoc(docId);
      if (doc.cleared) throw conflict('Document is already cleared');
      const pending = doc.spans.filter(isPending).length;
      if (pending > 0) {
        throw conflict(
          `Cannot finalize: ${pending} pending suggestion${pending === 1 ? '' : 's'} remain`,
          { pending }
        );
      }
      doc.cleared = true;
      return doc;
    },

    bulkClear({ docId }) {
      const doc = getDoc(docId);
      if (doc.tier !== 'green') throw conflict('Only low-risk (green) documents can be bulk-cleared');
      if (doc.cleared) throw conflict('Document is already cleared');
      doc.cleared = true;
      return doc;
    },
  };

  // ── Commands ───────────────────────────────────────────────────────────

  function reviewSpan(docId, spanId, action) {
    assertAction(action);
    const { doc, span } = apply.single({ docId, spanId, action });
    auditLog.append({ action, scope: 'single', docId: doc.id, spanId: span.spanId, entityId: span.entityId });
    return { span: structuredClone(span), workflowStatus: workflowStatus(doc) };
  }

  function propagate(docId, entityId, action) {
    assertAction(action);
    previewPropagation(docId, entityId); // validates doc + entity
    const affected = apply.propagate({ entityId, action });
    auditLog.append({
      action,
      scope:    'propagate',
      docId,    // the document the reviewer acted from
      spanId:   null,
      entityId,
      affected: affected.length,
      affectedDocIds: [...new Set(affected.map(a => a.docId))],
    });
    return { affected };
  }

  function finalize(docId) {
    const doc = apply.finalize({ docId });
    auditLog.append({ action: 'finalize', scope: 'document', docId: doc.id, spanId: null, entityId: null });
    return { workflowStatus: 'cleared' };
  }

  function bulkClear(ids) {
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) {
      throw badRequest('ids must be an array of document ids');
    }
    if (ids.length > MAX_BULK) throw badRequest(`At most ${MAX_BULK} ids per request`);

    const cleared = [];
    const skipped = [];
    for (const docId of new Set(ids)) {
      try {
        apply.bulkClear({ docId });
        auditLog.append({ action: 'bulk-clear', scope: 'bulk', docId, spanId: null, entityId: null });
        cleared.push(docId);
      } catch (err) {
        if (!err.status) throw err;
        skipped.push({ id: docId, reason: err.message });
      }
    }
    return { cleared, skipped };
  }

  function auditTrail() {
    return auditLog.read();
  }

  // ── Replay ─────────────────────────────────────────────────────────────

  function replay() {
    const { entries, skipped: malformed } = auditLog.readWithStats();
    let applied = 0;
    let ignored = 0;
    for (const e of entries) {
      try {
        if ((e.action === 'accept' || e.action === 'reject') && e.scope === 'single') apply.single(e);
        else if ((e.action === 'accept' || e.action === 'reject') && e.scope === 'propagate') apply.propagate(e);
        else if (e.action === 'finalize') apply.finalize(e);
        else if (e.action === 'bulk-clear') apply.bulkClear(e);
        else { ignored++; continue; }
        applied++;
      } catch {
        // An entry that no longer applies (e.g. the dataset was regenerated)
        // is skipped rather than aborting startup.
        ignored++;
      }
    }
    if (entries.length || malformed) {
      logger.info?.(`Audit replay: ${applied} applied, ${ignored} ignored, ${malformed} malformed`);
    }
    return { applied, ignored, malformed };
  }

  const replayStats = replay();

  return {
    listDocuments,
    getDocument,
    nextDocument,
    stats,
    previewPropagation,
    reviewSpan,
    propagate,
    finalize,
    bulkClear,
    auditTrail,
    replayStats,
  };
}

module.exports = { createReviewService };
