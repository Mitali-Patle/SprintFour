'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');

const { createApp }           = require('../src/app');
const { createAuditLog }      = require('../src/auditLog');
const { createReviewService } = require('../src/reviewService');
const { makeDocuments, silentLogger } = require('./fixtures');

let server;
let base;

test.beforeEach(async () => {
  const service = createReviewService({
    documents: makeDocuments(), auditLog: createAuditLog(null), logger: silentLogger,
  });
  server = createApp({ service, logger: silentLogger }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.afterEach(() => new Promise(resolve => server.close(resolve)));

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body:    body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('GET /health', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, docCount: 4 });
});

test('GET /documents is a summary list without full text', async () => {
  const r = await call('GET', '/documents');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 4);
  assert.equal(r.body[0].text, undefined);
  assert.deepEqual(Object.keys(r.body[0]).sort(), [
    'category', 'confidence', 'id', 'pendingCount', 'recallCount', 'spanCount',
    'tier', 'tierReason', 'title', 'workflowStatus',
  ]);
});

test('GET /documents/:id returns 404 for unknown ids', async () => {
  const r = await call('GET', '/documents/nope');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'Document not found');
});

test('full review flow over HTTP', async () => {
  assert.equal((await call('PATCH', '/documents/red1/spans/red1_s2', { action: 'reject' })).status, 200);

  const early = await call('POST', '/documents/red1/finalize');
  assert.equal(early.status, 409);
  assert.equal(early.body.pending, 1);

  const preview = await call('GET', '/documents/red1/propagate?entityId=ent_a');
  assert.equal(preview.body.spanPending, 3);

  const prop = await call('POST', '/documents/red1/propagate', { entityId: 'ent_a', action: 'accept' });
  assert.equal(prop.body.affected.length, 3);

  assert.equal((await call('POST', '/documents/red1/finalize')).status, 200);
  assert.equal((await call('GET', '/documents/red1')).body.workflowStatus, 'cleared');

  const stats = await call('GET', '/documents/stats');
  assert.deepEqual(stats.body, { total: 4, needs_review: 1, in_progress: 2, cleared: 1 });

  const audit = await call('GET', '/audit');
  assert.equal(audit.body.length, 3);
});

test('POST /documents/bulk-clear validates input', async () => {
  assert.equal((await call('POST', '/documents/bulk-clear', { ids: 'grn1' })).status, 400);
  const r = await call('POST', '/documents/bulk-clear', { ids: ['grn1', 'red1'] });
  assert.deepEqual(r.body.cleared, ['grn1']);
  assert.equal(r.body.skipped[0].id, 'red1');
});

test('GET /documents/:id/next', async () => {
  assert.deepEqual((await call('GET', '/documents/red1/next')).body, { id: 'yel1' });
});

test('bad input returns 400 JSON, not a stack trace', async () => {
  const bad = await call('PATCH', '/documents/red1/spans/red1_s1', '{oops');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'Malformed JSON body');

  const missing = await call('PATCH', '/documents/red1/spans/red1_s1', {});
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, 'action is required');
});

test('unknown API routes are JSON 404s', async () => {
  const r = await call('GET', '/nope');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'Not found');
});
