# SprintFour — PII Triage Tool

A reviewer-first PII redaction triage tool. The bottleneck for a human reviewer
(Maya) isn't redacting — it's **reviewing**. This tool routes her attention to the
documents that actually need a human (including ones where the detector may have
**missed** real PII) and lets her clear the rest without opening them.

## How it works

Every document is scanned by two independent passes at dataset-generation time:

- a **mock detector** that finds PII it recognizes (with confidence scores), and
- a **recall pass** that re-scans the raw text with broader patterns to surface
  PII the detector likely **missed** (e.g. a 9-digit SSN with no dashes, a phone
  number in an unusual format).

A **tier engine** combines both into a detection tier — `red` / `yellow` / `green` —
plus a human-readable reason (e.g. *"flagged: possible missed ssn"*). The dashboard
reads these precomputed values directly; nothing is recomputed per request.

On top of detection, each document has a **workflow status** that tracks the human
review lifecycle (see below).

## Stack

- **Backend:** Node / Express, in-memory dataset loaded from `data/dataset.json` (no DB).
- **Frontend:** React + Vite + React Router. Document view is plain text with
  highlighted spans (no rich-text editor); a suggestion list drives accept / reject / explain.
- **Detection:** mock provider only — no real LLM calls anywhere in this build.

## Project layout

```
backend/
  server.js              Express app (port 4000)
  store.js               in-memory document store + workflow/finalize logic
  routes/                documents.js, audit.js
  detection/             mockDetector.js   (confidence-scored spans)
  recall/                recallPass.js     (independent miss-scan; reads raw text only)
  triage/                tierEngine.js     (combines both into tier + reason)
  audit/                 auditLog.js + audit.log (append-only action log)
data/
  dataset.json           generated dataset (155 documents)
  hero-docs.json         5 hand-crafted hero documents (one per scenario)
  seed/generateDataset.js  regenerates both files
frontend/
  src/pages/             Dashboard.jsx, ReviewPanel.jsx
  src/components/        DocCard, SpanHighlighter, SuggestionList, StatusBadge, ...
  src/services/api.js    API client
```

The `detection`, `recall`, and `triage` modules are deliberately independent — none
reads another's internals, and the recall pass never sees any planted-error/manifest
data (it must rediscover misses from raw text alone).

## Running it

Requires Node 18+ (the backend uses `node --watch` in dev).

**1. Backend** (port `4000`):

```bash
cd backend
npm install
npm start        # or: npm run dev   (auto-restart on change)
```

**2. Frontend** (Vite dev server; proxies `/api` → `localhost:4000`):

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

**Regenerate the dataset** (re-runs detection + recall + tiering and rewrites
`data/dataset.json` and `data/hero-docs.json`):

```bash
cd backend
npm run generate
```

## Document workflow

Each document moves through a lifecycle that is **separate** from its detection tier:

| Status        | Meaning                                                        |
|---------------|---------------------------------------------------------------|
| Needs Review  | Fresh — nothing reviewed yet (pending suggestions / recall hits) |
| In Progress   | At least one suggestion accepted/rejected, but not finalized  |
| Cleared       | Explicitly finalized (or bulk-cleared)                         |

Reviewing every suggestion does **not** auto-clear a document — the reviewer must
explicitly **Finalize Review** (which is refused while any suggestion is still
pending). Low-risk (detection-green) documents can be **bulk-cleared** from the
dashboard without opening them.

## Key features

- **Dashboard triage** — documents sorted by lifecycle, then detection urgency
  (lowest-confidence / likely-miss first). Live counts of Needs Review / In Progress / Cleared.
- **Review panel** — text with highlighted spans alongside an AI suggestion list.
  Each suggestion shows its explanation *before* the accept/reject action.
- **Propagation** — an entity shared across documents (matching `entityId`) can be
  accepted/rejected everywhere at once; the confirm dialog shows the affected scope
  (docs + pending spans) before you commit.
- **Finalize Review** — marks a document Cleared once no suggestions are pending.
- **Audit log** — every accept / reject / propagate / finalize / bulk-clear action is
  appended to `backend/audit/audit.log` and surfaced on the dashboard.

### Keyboard shortcuts (review panel)

`a` accept · `r` reject · `n` next doc (back to dashboard) · `f` finalize

## API

| Method | Path                                          | Purpose                                   |
|--------|-----------------------------------------------|-------------------------------------------|
| GET    | `/api/health`                                 | Health check + document count             |
| GET    | `/api/documents`                              | Dashboard list (status, tier, counts)     |
| GET    | `/api/documents/:id`                           | Full document with all spans              |
| PATCH  | `/api/documents/:id/spans/:spanId`             | Accept or reject one span                 |
| GET    | `/api/documents/:id/propagate?entityId=…`      | Preview propagation scope                  |
| POST   | `/api/documents/:id/propagate`                 | Apply accept/reject across an entity       |
| POST   | `/api/documents/:id/finalize`                  | Finalize review → Cleared (409 if pending) |
| POST   | `/api/documents/bulk-clear`                    | Bulk-clear low-risk documents              |
| GET    | `/api/audit`                                   | Read the audit log                         |

> Data is held in memory and resets to the on-disk `dataset.json` on each backend
> restart — there is no database, real upload, or persistence of review actions
> beyond the append-only audit log.
