'use strict';

/** Small hand-built dataset covering every tier and a shared entity. */
function makeDocuments() {
  const s = (docId, n, overrides = {}) => ({
    spanId: `${docId}_s${n}`, entityId: null, type: 'NAME', text: 'x', start: 0, end: 1,
    confidence: 0.9, source: 'detector', reviewStatus: 'pending', ...overrides,
  });
  return [
    {
      id: 'red1', title: 'Red', category: 'medical_report', text: 'x', tier: 'red', confidence: 0.4,
      tierReason: 'flagged: possible missed ssn',
      spans: [s('red1', 1, { entityId: 'ent_a' }), s('red1', 2, { source: 'recall', type: 'SSN', confidence: null })],
    },
    {
      id: 'yel1', title: 'Yellow', category: 'lease_agreement', text: 'x', tier: 'yellow', confidence: 0.6,
      tierReason: 'flagged: possible missed phone',
      spans: [s('yel1', 1, { entityId: 'ent_a' })],
    },
    {
      id: 'grn1', title: 'Green 1', category: 'financial_invoice', text: 'x', tier: 'green', confidence: 0.9,
      tierReason: 'clear: 1 high-confidence entity detected',
      spans: [s('grn1', 1, { entityId: 'ent_a' })],
    },
    {
      id: 'grn2', title: 'Green 2', category: 'financial_invoice', text: 'x', tier: 'green', confidence: 0.95,
      tierReason: 'clear: 1 high-confidence entity detected',
      spans: [s('grn2', 1)],
    },
  ];
}

const silentLogger = { info() {}, error() {}, warn() {}, log() {} };

module.exports = { makeDocuments, silentLogger };
