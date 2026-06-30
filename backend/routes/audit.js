'use strict';

const express       = require('express');
const router        = express.Router();
const { readLog }   = require('../audit/auditLog');

// GET /api/audit — return all audit log entries
router.get('/', (req, res) => {
  res.json(readLog());
});

module.exports = router;
