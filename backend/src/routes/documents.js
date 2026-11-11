'use strict';

const express = require('express');

/** @param {ReturnType<import('../reviewService').createReviewService>} service */
module.exports = function documentsRouter(service) {
  const router = express.Router();

  // Static paths are declared before /:id so they are never captured as ids.
  router.get('/', (_req, res) => {
    res.json(service.listDocuments());
  });

  router.get('/stats', (_req, res) => {
    res.json(service.stats());
  });

  router.post('/bulk-clear', (req, res) => {
    res.json({ ok: true, ...service.bulkClear(req.body?.ids) });
  });

  router.get('/:id', (req, res) => {
    res.json(service.getDocument(req.params.id));
  });

  router.get('/:id/next', (req, res) => {
    res.json({ id: service.nextDocument(req.params.id) });
  });

  router.patch('/:id/spans/:spanId', (req, res) => {
    res.json({ ok: true, ...service.reviewSpan(req.params.id, req.params.spanId, req.body?.action) });
  });

  router.get('/:id/propagate', (req, res) => {
    res.json(service.previewPropagation(req.params.id, req.query.entityId));
  });

  router.post('/:id/propagate', (req, res) => {
    const { entityId, action } = req.body ?? {};
    res.json({ ok: true, ...service.propagate(req.params.id, entityId, action) });
  });

  router.post('/:id/finalize', (req, res) => {
    res.json({ ok: true, ...service.finalize(req.params.id) });
  });

  return router;
};
