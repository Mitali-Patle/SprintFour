'use strict';

const { detect }      = require('./mockDetector');
const { recallPass }  = require('./recallPass');
const { computeTier } = require('./tierEngine');

/**
 * Full ingestion pipeline for one document: detect → recall → tier.
 *
 * The three stages are independent modules; this is the only place that wires
 * them together.
 *
 * @param {string} docId
 * @param {string} text
 * @returns {{ tier: string, confidence: number, tierReason: string, spans: Array }}
 */
function analyzeDocument(docId, text) {
  const detectorSpans = detect(text, docId);
  const recallSpans   = recallPass(text, detectorSpans, docId, detectorSpans.length);
  const spans         = [...detectorSpans, ...recallSpans].sort((a, b) => a.start - b.start);
  return { ...computeTier(spans), spans };
}

module.exports = { analyzeDocument };
