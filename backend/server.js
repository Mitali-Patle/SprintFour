'use strict';

const express = require('express');
const cors    = require('cors');
const store   = require('./store');

const docsRouter  = require('./routes/documents');
const auditRouter = require('./routes/audit');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const count = store.load();

app.use('/api/documents', docsRouter);
app.use('/api/audit',     auditRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, docCount: count }));

app.listen(PORT, () => {
  console.log(`PII triage backend running on http://localhost:${PORT}`);
  console.log(`Loaded ${count} documents from dataset.json`);
});
