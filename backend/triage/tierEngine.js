'use strict';

// Tier engine: combines detector spans and recall hits into a final document status + reason.
// Runs ONCE at generation time. Never called at request time.

// SSN missed by detector = red; missed PHONE/EMAIL = yellow (needs review but lower urgency)
const HARD_RED_RECALL_TYPES = new Set(['SSN']);

/**
 * @param {Array} spans - merged detector + recall spans
 * @returns {{ status: 'green'|'yellow'|'red', confidence: number, tierReason: string }}
 */
function computeTier(spans) {
  const detectorSpans = spans.filter(s => s.source === 'detector');
  const recallSpans   = spans.filter(s => s.source === 'recall');

  // No spans at all → green
  if (spans.length === 0) {
    return { status: 'green', confidence: 1.0, tierReason: 'clear: no PII detected' };
  }

  // Average confidence of detector spans
  const avgConf = detectorSpans.length > 0
    ? detectorSpans.reduce((sum, s) => sum + s.confidence, 0) / detectorSpans.length
    : 1.0;

  const hardRedHits   = recallSpans.filter(s => HARD_RED_RECALL_TYPES.has(s.type));
  const softRecallHits = recallSpans.filter(s => !HARD_RED_RECALL_TYPES.has(s.type));
  const anyRecallHit  = recallSpans.length > 0;

  // Red conditions
  if (hardRedHits.length > 0) {
    const types = [...new Set(hardRedHits.map(s => s.type.toLowerCase()))];
    const label = types.length === 1
      ? `possible missed ${types[0]}`
      : `possible missed ${types.join(' and ')}`;
    return {
      status:     'red',
      confidence: parseFloat((avgConf * 0.5).toFixed(3)),
      tierReason: `flagged: ${label}`,
    };
  }

  if (avgConf < 0.6 && detectorSpans.length > 0) {
    return {
      status:     'red',
      confidence: parseFloat(avgConf.toFixed(3)),
      tierReason: `flagged: ${detectorSpans.length} low-confidence detection${detectorSpans.length > 1 ? 's' : ''}`,
    };
  }

  // Yellow conditions
  if (softRecallHits.length > 0) {
    const types = [...new Set(softRecallHits.map(s => s.type.toLowerCase()))];
    const label = types.length === 1
      ? `possible missed ${types[0]}`
      : `possible missed ${types.join(' and ')}`;
    return {
      status:     'yellow',
      confidence: parseFloat((avgConf * 0.7).toFixed(3)),
      tierReason: `flagged: ${label}`,
    };
  }

  if (avgConf < 0.75 && detectorSpans.length > 0) {
    return {
      status:     'yellow',
      confidence: parseFloat(avgConf.toFixed(3)),
      tierReason: `review: mixed confidence detections`,
    };
  }

  // Green
  const pendingCount = detectorSpans.length;
  return {
    status:     'green',
    confidence: parseFloat(avgConf.toFixed(3)),
    tierReason: pendingCount === 0
      ? 'clear: no PII detected'
      : `clear: ${pendingCount} high-confidence entity${pendingCount > 1 ? 'ies' : 'y'} detected`,
  };
}

module.exports = { computeTier };
