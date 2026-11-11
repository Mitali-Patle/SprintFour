export const isPending = span => span.reviewStatus === 'pending';

// Review order: likely misses (recall) first, then the least-confident detections.
export function orderSuggestions(spans) {
  return [...spans].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'recall' ? -1 : 1;
    return (a.confidence ?? -1) - (b.confidence ?? -1) || a.start - b.start;
  });
}

const RECALL_NOTE = 'found by the recall scan; the detector missed it';

const EXPLANATIONS = {
  NAME:    s => `Person's name ${s.source === 'recall' ? RECALL_NOTE : 'identified by the detector from a label or honorific'}.`,
  EMAIL:   s => `Email address ${s.source === 'recall' ? RECALL_NOTE : 'flagged by the detector'}.`,
  PHONE:   s => s.source === 'recall'
    ? 'Phone number in a format the detector does not recognise (no parentheses), found by the recall scan.'
    : 'Phone number flagged by the detector.',
  SSN:     s => s.source === 'recall'
    ? 'Bare 9-digit number that may be an undashed Social Security Number. Could also be an account or routing number, so check the context.'
    : 'Social Security Number, a high-sensitivity identifier.',
  ADDRESS: () => 'Street address (number, street, city, state, ZIP) flagged by the detector.',
  DOB:     () => 'Date of birth flagged by the detector.',
};

export function explain(span) {
  const fn = EXPLANATIONS[span.type];
  return fn ? fn(span) : `${span.type} flagged by the ${span.source}.`;
}
