'use strict';

const fs = require('fs');

const config                  = require('./src/config');
const { createApp }           = require('./src/app');
const { createAuditLog }      = require('./src/auditLog');
const { createReviewService } = require('./src/reviewService');

const documents = JSON.parse(fs.readFileSync(config.datasetPath, 'utf8'));
const service   = createReviewService({ documents, auditLog: createAuditLog(config.auditLogPath) });
const app       = createApp({ service, staticDir: config.staticDir });

const server = app.listen(config.port, () => {
  console.log(`PII triage API listening on http://localhost:${config.port}`);
  console.log(`Loaded ${documents.length} documents · audit log: ${config.auditLogPath}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
