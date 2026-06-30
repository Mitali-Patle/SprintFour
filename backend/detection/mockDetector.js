'use strict';

// Mock PII detector: scans text and returns spans with type, offsets, confidence.
// Does NOT call any real LLM. Intentionally misses some patterns (recall pass catches them).

const PATTERNS = [
  { type: 'SSN',     re: /\b\d{3}-\d{2}-\d{4}\b/g,                            baseConf: 0.92 },
  { type: 'EMAIL',   re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, baseConf: 0.89 },
  // Detector intentionally uses a narrower phone pattern so recall can find misses
  { type: 'PHONE',   re: /\(\d{3}\)\s*\d{3}-\d{4}/g,                          baseConf: 0.85 },
  // Subject name introduced by an identifying label — captures just the name
  // (group 1) so the span covers "John Smith", not the "Full Name:" prefix.
  { type: 'NAME',    re: /(?:Full Legal Name|Full Name|Patient Name|Tenant|BILLED TO)\s*:\s*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+)/gd, baseConf: 0.80, capture: 1 },
  // Honorific-titled names (physicians, etc.)
  { type: 'NAME',    re: /\b(Dr\.|Mr\.|Ms\.|Mrs\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, baseConf: 0.78 },
  { type: 'DOB',     re: /\b(?:born|DOB|date of birth)[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi, baseConf: 0.83 },
  // street number + street, city (one+ words), STATE ZIP
  { type: 'ADDRESS', re: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Za-z.]+){1,3},\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s+[A-Z]{2}\s+\d{5}\b/g, baseConf: 0.76 },
];

/**
 * @param {string} text
 * @param {string} docId
 * @returns {Array} spans
 */
function detect(text, docId) {
  const spans = [];
  let spanIdx = 0;

  for (const { type, re, baseConf, capture } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      // When a pattern captures a sub-group (e.g. the name after a label), the
      // span should cover just that group, not the whole match.
      const matchText = capture != null ? m[capture] : m[0];
      const start     = capture != null ? m.indices[capture][0] : m.index;
      // Add slight random jitter to confidence so not all hits look identical
      const jitter = (Math.random() * 0.1) - 0.05;
      const confidence = Math.min(0.99, Math.max(0.50, baseConf + jitter));
      spans.push({
        spanId:       `${docId}_s${++spanIdx}`,
        entityId:     null,   // filled in by generateDataset for named entities
        type,
        text:         matchText,
        start,
        end:          start + matchText.length,
        confidence:   parseFloat(confidence.toFixed(3)),
        source:       'detector',
        reviewStatus: 'pending',
      });
    }
  }

  // Sort by start offset
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

module.exports = { detect };
