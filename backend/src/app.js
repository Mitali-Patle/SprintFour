'use strict';

const fs      = require('fs');
const path    = require('path');
const express = require('express');

const documentsRouter = require('./routes/documents');
const auditRouter     = require('./routes/audit');

/**
 * Builds the Express app around an already-constructed review service.
 * Kept separate from `server.js` so tests can exercise the HTTP layer without
 * binding a fixed port or touching real files.
 *
 * @param {{ service: object, staticDir?: string|null, logger?: Console }} deps
 */
function createApp({ service, staticDir = null, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, docCount: service.stats().total });
  });
  app.use('/api/documents', documentsRouter(service));
  app.use('/api/audit',     auditRouter(service));

  // Unknown API routes get a JSON 404, never the SPA's index.html.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    // Client-side routes (e.g. /review/:id) fall back to the SPA shell.
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  // Central error handler. Express 5 forwards both thrown errors and rejected promises here.
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }
    const status = err.status && err.status < 500 ? err.status : 500;
    if (status === 500) logger.error(err);
    res.status(status).json({
      error: status === 500 ? 'Internal server error' : err.message,
      ...(status < 500 && err.details),
    });
  });

  return app;
}

module.exports = { createApp };
