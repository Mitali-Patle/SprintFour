'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/** Runtime configuration. Every value can be overridden with an environment variable. */
module.exports = {
  port:         Number(process.env.PORT) || 4000,
  datasetPath:  process.env.DATASET_PATH   || path.join(ROOT, 'data/dataset.json'),
  auditLogPath: process.env.AUDIT_LOG_PATH || path.join(ROOT, 'backend/var/audit.log'),
  // Built frontend, served by the backend when present (production / `npm start` at the root).
  staticDir:    process.env.STATIC_DIR     || path.join(ROOT, 'frontend/dist'),
};
