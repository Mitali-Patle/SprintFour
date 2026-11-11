'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Append-only audit log stored as JSON Lines.
 *
 * The log is the system of record for review decisions: the review service
 * replays it on startup to rebuild state. Pass `filePath: null` for an
 * in-memory log (used by tests).
 *
 * @param {string|null} filePath
 */
function createAuditLog(filePath) {
  const memory = [];

  function append(event) {
    const entry = { ts: new Date().toISOString(), ...event };
    if (filePath == null) {
      memory.push(entry);
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
    }
    return entry;
  }

  /** @returns {{ entries: object[], skipped: number }} */
  function readWithStats() {
    if (filePath == null) return { entries: [...memory], skipped: 0 };
    if (!fs.existsSync(filePath)) return { entries: [], skipped: 0 };

    const entries = [];
    let skipped = 0;
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        skipped++; // a torn or hand-edited line must not take the server down
      }
    }
    return { entries, skipped };
  }

  return {
    append,
    read: () => readWithStats().entries,
    readWithStats,
    path: filePath,
  };
}

module.exports = { createAuditLog };
