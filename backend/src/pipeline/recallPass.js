'use strict';

/**
 * Recall pass: an independent, deliberately broader scan of the raw text that
 * looks for PII the detector may have missed.
 *
 * It only ever sees the document text and the detector's output. It never reads
 * generator metadata about which errors were planted, so every miss it reports
 * is rediscovered from the text alone.
 */

const RECALL_PATTERNS = [
  // Phone numbers separated by dashes, dots or spaces (no parentheses).
  { type: 'PHONE', re: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g },
  // Bare 9-digit SSNs; the detector only knows the dashed form.
  { type: 'SSN',   re: /\b\d{9}\b/g },
  // Same email shape as the detector. Kept as a safety net in case the
  // detector's pattern drifts.
  { type: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
];

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/**
 * Returns recall hits that do not overlap anything the detector already flagged
 * (or an earlier recall hit), so the review UI never shows two competing
 * highlights over the same characters.
 *
 * @param {string} text
 * @param {Array}  detectorSpans  spans already produced by the detector
 * @param {string} docId
 * @param {number} startIdx       spanId counter offset
 * @returns {Array} recall spans sorted by start offset
 */
function recallPass(text, detectorSpans, docId, startIdx = 0) {
  const taken = [...detectorSpans];
  const hits  = [];

  for (const { type, re } of RECALL_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const candidate = { start: m.index, end: m.index + m[0].length };
      if (taken.some(s => overlaps(s, candidate))) continue;

      const span = {
        entityId:     null,
        type,
        text:         m[0],
        ...candidate,
        confidence:   null, // a regex sweep has no calibrated score
        source:       'recall',
        reviewStatus: 'pending',
      };
      taken.push(span);
      hits.push(span);
    }
  }

  hits.sort((a, b) => a.start - b.start);
  return hits.map((span, i) => ({ spanId: `${docId}_r${startIdx + i + 1}`, ...span }));
}

module.exports = { recallPass, RECALL_PATTERNS };
