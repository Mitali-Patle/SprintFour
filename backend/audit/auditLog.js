'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'audit.log');

/**
 * Append one JSON line to the audit log.
 * @param {{ docId, spanId, entityId, action, scope }} entry
 */
function logAction({ docId, spanId = null, entityId = null, action, scope }) {
  const line = JSON.stringify({
    ts:       new Date().toISOString(),
    docId,
    spanId,
    entityId,
    action,
    scope,
  });
  fs.appendFileSync(LOG_PATH, line + '\n');
}

/**
 * Read and return all audit log entries.
 * @returns {Array}
 */
function readLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs
    .readFileSync(LOG_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

module.exports = { logAction, readLog };
