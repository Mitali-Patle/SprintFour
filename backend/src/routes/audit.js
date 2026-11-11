'use strict';

const express = require('express');

/** @param {ReturnType<import('../reviewService').createReviewService>} service */
module.exports = function auditRouter(service) {
  const router = express.Router();

  // GET /api/audit returns every audit entry, oldest first.
  router.get('/', (_req, res) => {
    res.json(service.auditTrail());
  });

  return router;
};
