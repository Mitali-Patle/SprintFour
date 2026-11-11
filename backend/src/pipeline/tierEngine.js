'use strict';

/**
 * Tier engine: turns a document's detector + recall spans into a risk tier
 * (red / yellow / green), a document-level confidence and a human-readable
 * reason. It runs once, at dataset-generation time, never per request.
 *
 *   red    a likely missed SSN, or the detector itself is unsure (avg < 0.60)
 *   yellow a likely missed phone/email, or mixed confidence (avg < 0.75)
 *   green  everything found by the detector, with high confidence
 */

// A missed SSN is the worst case; other recall misses are lower urgency.
const HARD_RED_RECALL_TYPES = new Set(['SSN']);

const RED_CONFIDENCE    = 0.6;
const YELLOW_CONFIDENCE = 0.75;

const round = n => Number(n.toFixed(3));
const plural = (n, one, many) => (n === 1 ? one : many);

function missedLabel(spans) {
  const types = [...new Set(spans.map(s => s.type.toLowerCase()))];
  return `possible missed ${types.join(' and ')}`;
}

/**
 * @param {Array} spans merged detector + recall spans
 * @returns {{ tier: 'green'|'yellow'|'red', confidence: number, tierReason: string }}
 */
function computeTier(spans) {
  const detectorSpans = spans.filter(s => s.source === 'detector');
  const recallSpans   = spans.filter(s => s.source === 'recall');

  if (spans.length === 0) {
    return { tier: 'green', confidence: 1, tierReason: 'clear: no PII detected' };
  }

  const avgConf = detectorSpans.length > 0
    ? detectorSpans.reduce((sum, s) => sum + s.confidence, 0) / detectorSpans.length
    : 1;

  const hardMisses = recallSpans.filter(s => HARD_RED_RECALL_TYPES.has(s.type));
  const softMisses = recallSpans.filter(s => !HARD_RED_RECALL_TYPES.has(s.type));

  if (hardMisses.length > 0) {
    return { tier: 'red', confidence: round(avgConf * 0.5), tierReason: `flagged: ${missedLabel(hardMisses)}` };
  }

  if (detectorSpans.length > 0 && avgConf < RED_CONFIDENCE) {
    const n = detectorSpans.length;
    return {
      tier:       'red',
      confidence: round(avgConf),
      tierReason: `flagged: ${n} low-confidence ${plural(n, 'detection', 'detections')}`,
    };
  }

  if (softMisses.length > 0) {
    return { tier: 'yellow', confidence: round(avgConf * 0.7), tierReason: `flagged: ${missedLabel(softMisses)}` };
  }

  if (detectorSpans.length > 0 && avgConf < YELLOW_CONFIDENCE) {
    return { tier: 'yellow', confidence: round(avgConf), tierReason: 'review: mixed-confidence detections' };
  }

  const n = detectorSpans.length;
  return {
    tier:       'green',
    confidence: round(avgConf),
    tierReason: `clear: ${n} high-confidence ${plural(n, 'entity', 'entities')} detected`,
  };
}

module.exports = { computeTier, RED_CONFIDENCE, YELLOW_CONFIDENCE };
