'use strict';

/**
 * Mock PII detector.
 *
 * Stands in for a real model: scans text with fixed patterns and returns
 * confidence-scored spans. No network or LLM calls. Some formats are
 * deliberately left uncovered (bare SSNs, dash/dot phones) so the independent
 * recall pass has real misses to find.
 */

const PATTERNS = [
  { type: 'SSN',   re: /\b\d{3}-\d{2}-\d{4}\b/g,                              baseConf: 0.92 },
  { type: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, baseConf: 0.89 },
  // Narrower than the recall pass on purpose: parenthesised area code only.
  { type: 'PHONE', re: /\(\d{3}\)\s*\d{3}-\d{4}/g,                            baseConf: 0.85 },
  // A name introduced by an identifying label. Group 1 is the name itself, so
  // the span covers "John Smith" and not the "Full Name:" prefix.
  {
    type: 'NAME',
    re: /(?:Full Legal Name|Full Name|Patient Name|Tenant|BILLED TO)\s*:\s*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+)/gd,
    baseConf: 0.80,
    capture: 1,
  },
  // Names with an honorific (physicians, parties, ...).
  { type: 'NAME',  re: /\b(?:Dr\.|Mr\.|Ms\.|Mrs\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, baseConf: 0.78 },
  { type: 'DOB',   re: /\b(?:born|DOB|date of birth)[:\s]+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi, baseConf: 0.83 },
  // Street number + street, city, STATE ZIP.
  {
    type: 'ADDRESS',
    re: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Za-z.]+){1,3},\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s+[A-Z]{2}\s+\d{5}\b/g,
    baseConf: 0.76,
  },
];

const JITTER = 0.05;

/**
 * Deterministic pseudo-random value in [0, 1) derived from a string (FNV-1a).
 * Gives each hit a stable, slightly different confidence, so regenerating the
 * dataset produces the same scores every time.
 */
function stableUnit(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

function scoreFor(baseConf, key) {
  const jitter = (stableUnit(key) * 2 - 1) * JITTER;
  const conf = Math.min(0.99, Math.max(0.5, baseConf + jitter));
  return Number(conf.toFixed(3));
}

/**
 * @param {string} text
 * @param {string} docId
 * @returns {Array<object>} spans sorted by start offset
 */
function detect(text, docId) {
  const hits = [];

  for (const { type, re, baseConf, capture } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const matchText = capture != null ? m[capture] : m[0];
      const start     = capture != null ? m.indices[capture][0] : m.index;
      hits.push({
        entityId:     null, // linked to a cross-document entity by the generator
        type,
        text:         matchText,
        start,
        end:          start + matchText.length,
        confidence:   scoreFor(baseConf, `${docId}:${type}:${start}`),
        source:       'detector',
        reviewStatus: 'pending',
      });
    }
  }

  hits.sort((a, b) => a.start - b.start);
  return hits.map((span, i) => ({ spanId: `${docId}_s${i + 1}`, ...span }));
}

module.exports = { detect, PATTERNS };
