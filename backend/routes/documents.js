'use strict';

const express       = require('express');
const router        = express.Router();
const store         = require('../store');
const { logAction } = require('../audit/auditLog');

const TIER_ORDER = { red: 0, yellow: 1, green: 2 };
const WF_ORDER   = { needs_review: 0, in_progress: 1, cleared: 2 };

// GET /api/documents — list view (no full text, no full spans)
router.get('/', (_req, res) => {
  const list = store.all().map(d => ({
    id:             d.id,
    title:          d.title,
    category:       d.category,
    status:         d.status,                 // detection tier (red/yellow/green)
    workflowStatus: store.workflowStatus(d),  // lifecycle (needs_review/in_progress/cleared)
    confidence:     d.confidence,
    tierReason:     d.tierReason,
    spanCount:      d.spans.length,
    pendingCount:   d.spans.filter(s => s.reviewStatus === 'pending').length,
    cleared:        d.cleared || false,
  }));

  // Order by lifecycle (needs_review first), then by detection urgency within.
  list.sort((a, b) => {
    const wfDiff = WF_ORDER[a.workflowStatus] - WF_ORDER[b.workflowStatus];
    if (wfDiff !== 0) return wfDiff;
    const tierDiff = TIER_ORDER[a.status] - TIER_ORDER[b.status];
    return tierDiff !== 0 ? tierDiff : a.confidence - b.confidence;
  });

  res.json(list);
});

// POST /api/documents/bulk-clear — MUST be before /:id routes to avoid shadowing
router.post('/bulk-clear', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }

  const cleared = store.bulkClear(ids);
  for (const id of cleared) {
    logAction({ docId: id, spanId: null, entityId: null, action: 'bulk-clear', scope: 'bulk' });
  }

  res.json({ ok: true, cleared });
});

// GET /api/documents/:id — full document with all spans
router.get('/:id', (req, res) => {
  const doc = store.byId(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({ ...doc, workflowStatus: store.workflowStatus(doc) });
});

// POST /api/documents/:id/finalize — finalize review → mark Cleared
router.post('/:id/finalize', (req, res) => {
  const result = store.finalizeDoc(req.params.id);
  if (!result.ok) {
    if (result.reason === 'not_found') {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (result.reason === 'pending') {
      return res.status(409).json({
        error: `Cannot finalize: ${result.pending} pending suggestion${result.pending > 1 ? 's' : ''} remain`,
      });
    }
    return res.status(400).json({ error: 'Cannot finalize document' });
  }

  logAction({ docId: result.doc.id, spanId: null, entityId: null, action: 'finalize', scope: 'document' });

  res.json({ ok: true, workflowStatus: 'cleared' });
});

// PATCH /api/documents/:id/spans/:spanId — accept or reject one span
router.patch('/:id/spans/:spanId', (req, res) => {
  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }
  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be accept or reject' });
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';
  const result    = store.setSpanStatus(req.params.id, req.params.spanId, newStatus);

  if (!result) {
    const doc = store.byId(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.status(404).json({ error: 'Span not found' });
  }

  logAction({
    docId:    result.doc.id,
    spanId:   result.span.spanId,
    entityId: result.span.entityId,
    action,
    scope:    'single',
  });

  res.json({ ok: true, span: result.span });
});

// GET /api/documents/:id/propagate?entityId=… — preview propagation scope
// (how many documents/spans would be affected) BEFORE committing an action.
router.get('/:id/propagate', (req, res) => {
  const { entityId } = req.query;
  if (!entityId) {
    return res.status(400).json({ error: 'entityId query param is required' });
  }
  if (!store.byId(req.params.id)) {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (!store.entityExists(entityId)) {
    return res.status(404).json({ error: 'entityId not found' });
  }
  res.json(store.entityRefs(entityId));
});

// POST /api/documents/:id/propagate — apply action to all spans sharing an entityId
router.post('/:id/propagate', (req, res) => {
  const { entityId, action } = req.body;
  if (!entityId || !action) {
    return res.status(400).json({ error: 'entityId and action are required' });
  }
  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be accept or reject' });
  }

  if (!store.byId(req.params.id)) {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (!store.entityExists(entityId)) {
    return res.status(404).json({ error: 'entityId not found' });
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';
  const affected  = store.propagate(entityId, newStatus);

  logAction({ docId: '*', spanId: null, entityId, action, scope: 'propagate' });

  res.json({ ok: true, affected });
});

module.exports = router;
