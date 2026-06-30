'use strict';

// Recall pass: independent regex scan of raw document text.
// Intentionally broader patterns than the mock detector to surface missed PII.
// NEVER reads planted-error/manifest fields — only sees raw text.

const RECALL_PATTERNS = [
  // Broader phone: catches dashes, dots, spaces, no-parens formats the detector misses
  { type: 'PHONE', re: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g },
  // Plain SSN without dashes (detector requires dashes)
  { type: 'SSN',   re: /\b\d{9}\b/g },
  // Email (same pattern — recall may still find ones in unusual positions)
  { type: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
];

/**
 * Returns spans found by recall that are NOT already covered by a detector span.
 * @param {string} text
 * @param {Array}  detectorSpans  - already-found spans (to de-duplicate)
 * @param {string} docId
 * @param {number} startIdx       - spanId counter offset
 * @returns {Array} recallSpans
 */
function recallPass(text, detectorSpans, docId, startIdx = 0) {
  const recallSpans = [];
  let spanIdx = startIdx;

  for (const { type, re } of RECALL_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end   = m.index + m[0].length;

      // Skip if a detector span already covers this range (overlap check)
      const alreadyCovered = detectorSpans.some(
        s => s.start <= start && s.end >= end
      );
      if (alreadyCovered) continue;

      recallSpans.push({
        spanId:       `${docId}_r${++spanIdx}`,
        entityId:     null,
        type,
        text:         m[0],
        start,
        end,
        confidence:   null,    // recall regex has no confidence score
        source:       'recall',
        reviewStatus: 'pending',
      });
    }
  }

  recallSpans.sort((a, b) => a.start - b.start);
  return recallSpans;
}

module.exports = { recallPass };
