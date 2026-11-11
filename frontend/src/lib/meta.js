// Shared display metadata: one palette, used by every badge and highlight.

export const PALETTE = {
  red:    { bg: '#fee2e2', border: '#f87171', text: '#991b1b', dot: '#ef4444' },
  yellow: { bg: '#fef9c3', border: '#fbbf24', text: '#78350f', dot: '#f59e0b' },
  green:  { bg: '#dcfce7', border: '#86efac', text: '#14532d', dot: '#22c55e' },
};

// Detection risk tier, precomputed at ingestion.
export const TIER_META = {
  red:    { label: 'High risk',   color: 'red' },
  yellow: { label: 'Medium risk', color: 'yellow' },
  green:  { label: 'Low risk',    color: 'green' },
};

// Human review lifecycle, independent of the tier.
export const WORKFLOW_META = {
  needs_review: { label: 'Needs Review', color: 'red' },
  in_progress:  { label: 'In Progress',  color: 'yellow' },
  cleared:      { label: 'Cleared',      color: 'green' },
};

export const CATEGORY_LABELS = {
  employment_contract: 'Employment Contract',
  medical_report:      'Medical Report',
  court_affidavit:     'Court Affidavit',
  lease_agreement:     'Lease Agreement',
  financial_invoice:   'Financial Invoice',
};

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
