# Project: Sprintfour Hackathon — Problem 2 (Maya, volume)

## Thesis
Maya's bottleneck isn't redacting, it's reviewing. Route her attention to
documents that actually need a human — including ones where the detector
may have MISSED real PII — and let her clear the rest without opening them.

## Stack
- Backend: Node/Express, in-memory JSON dataset (no DB)
- Frontend: React. Document view = plain text + highlighted spans, no
  rich-text editor framework. Suggestion list drives accept/reject/explain.
- Detection: mock provider only (Option B). No real LLM calls anywhere
  in this build.

## Data model
- Documents embed their own entities directly (no separate entities.json).
  Entities shared across documents carry a matching `entityId` so
  propagation can find all docs referencing the same entity.
- Tier engine and recall pass run ONCE at dataset-generation time, not
  per-request. Each document's JSON already contains its final `status`
  (green/yellow/red) and `confidence` — the dashboard reads these directly,
  it does not recompute them.
- recallPass.js (used during generation) reads ONLY raw document text.
  NEVER reads any planted-error/manifest field — it must rediscover
  misses independently.

## Architecture
- detection/ (mock spans), recall/ (independent regex miss-scan),
  triage/ (combines both into tier + reason) are SEPARATE modules.
  None depends on another's internals.
- audit/auditLog.js logs every accept/reject/propagate action as a side
  effect. Version History (if built) is a plain read of this log — not a
  feature with its own logic.

## Conventions
- Tier reason must be visible in UI, not just a color
  (e.g. "flagged: possible missed phone number")
- Keyboard shortcuts where feasible: a=accept, r=reject, n=next doc

## Don't
- Don't let recall pass or tier engine read planted-error/manifest data
- Don't make the AI panel a chatbot — suggestions list only,
  explanation shown before the action, not after
- Don't build real upload or a real DB — seed from dataset.json
- Don't build search/filters/heatmap/learning-mode unless dashboard,
  review panel, and propagation are all already done
- Don't build a three-panel layout — Preview and Review are one component
- Don't build a dedicated Version History screen unless Tier 1-3 are done;
  the audit log itself is the only Tier-1 commitment
