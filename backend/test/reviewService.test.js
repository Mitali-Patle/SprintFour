'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { createReviewService } = require('../src/reviewService');
const { createAuditLog }      = require('../src/auditLog');
const { makeDocuments, silentLogger } = require('./fixtures');

const make = (auditLog = createAuditLog(null), documents = makeDocuments()) =>
  createReviewService({ documents, auditLog, logger: silentLogger });

const status = (svc, id) => svc.listDocuments().find(d => d.id === id).workflowStatus;

test('queue: fresh work first, then by risk tier, then by confidence', () => {
  const svc = make();
  assert.deepEqual(svc.listDocuments().map(d => d.id), ['red1', 'yel1', 'grn1', 'grn2']);

  svc.reviewSpan('red1', 'red1_s1', 'accept'); // red1 → in_progress, drops below fresh work
  assert.deepEqual(svc.listDocuments().map(d => d.id), ['yel1', 'grn1', 'grn2', 'red1']);
});

test('workflow: needs_review → in_progress → cleared', () => {
  const svc = make();
  assert.equal(status(svc, 'red1'), 'needs_review');
  svc.reviewSpan('red1', 'red1_s1', 'accept');
  assert.equal(status(svc, 'red1'), 'in_progress');
  svc.reviewSpan('red1', 'red1_s2', 'reject');
  assert.equal(status(svc, 'red1'), 'in_progress', 'reviewing everything never auto-clears');
  svc.finalize('red1');
  assert.equal(status(svc, 'red1'), 'cleared');
});

test('finalize is refused while suggestions are pending', () => {
  const svc = make();
  assert.throws(() => svc.finalize('red1'), { status: 409, message: /2 pending suggestions/ });
});

test('cleared documents are locked', () => {
  const svc = make();
  svc.bulkClear(['grn2']);
  assert.throws(() => svc.reviewSpan('grn2', 'grn2_s1', 'accept'), { status: 409 });
  assert.throws(() => svc.finalize('grn2'), { status: 409 });
});

test('bulk clear only clears green documents and reports the rest', () => {
  const svc = make();
  const r = svc.bulkClear(['grn1', 'red1', 'missing', 'grn1']);
  assert.deepEqual(r.cleared, ['grn1']);
  assert.deepEqual(r.skipped.map(s => s.id), ['red1', 'missing']);
  assert.throws(() => svc.bulkClear('grn1'), { status: 400 });
});

test('propagation preview matches what propagation then changes', () => {
  const svc = make();
  svc.bulkClear(['grn1']); // grn1 mentions ent_a but is now locked

  const preview = svc.previewPropagation('red1', 'ent_a');
  assert.equal(preview.totalDocCount, 3);
  assert.equal(preview.clearedDocCount, 1);
  assert.equal(preview.docCount, 2);
  assert.equal(preview.spanPending, 2);

  const { affected } = svc.propagate('red1', 'ent_a', 'accept');
  assert.equal(affected.length, preview.spanPending);
  assert.equal(svc.getDocument('grn1').spans[0].reviewStatus, 'pending', 'locked doc untouched');
  assert.equal(svc.previewPropagation('red1', 'ent_a').spanPending, 0);
});

test('validation errors carry HTTP statuses', () => {
  const svc = make();
  assert.throws(() => svc.reviewSpan('red1', 'red1_s1', 'maybe'), { status: 400 });
  assert.throws(() => svc.reviewSpan('nope', 'x', 'accept'), { status: 404 });
  assert.throws(() => svc.reviewSpan('red1', 'nope', 'accept'), { status: 404 });
  assert.throws(() => svc.previewPropagation('red1', 'ent_missing'), { status: 404 });
});

test('getDocument returns a copy, never live state', () => {
  const svc = make();
  svc.getDocument('red1').spans[0].reviewStatus = 'accepted';
  assert.equal(svc.getDocument('red1').spans[0].reviewStatus, 'pending');
});

test('seed documents are never mutated', () => {
  const documents = makeDocuments();
  const svc = make(createAuditLog(null), documents);
  svc.reviewSpan('red1', 'red1_s1', 'accept');
  assert.equal(documents[0].spans[0].reviewStatus, 'pending');
});

test('nextDocument returns the most urgent other open document', () => {
  const svc = make();
  assert.equal(svc.nextDocument('red1'), 'yel1');
  svc.bulkClear(['grn1', 'grn2']);
  svc.reviewSpan('yel1', 'yel1_s1', 'accept');
  svc.finalize('yel1');
  assert.equal(svc.nextDocument('red1'), null);
});

test('every command is written to the audit log', () => {
  const log = createAuditLog(null);
  const svc = make(log);
  svc.reviewSpan('red1', 'red1_s2', 'reject');
  svc.propagate('red1', 'ent_a', 'accept');
  svc.finalize('red1');
  svc.bulkClear(['grn2']);
  assert.deepEqual(log.read().map(e => `${e.action}/${e.scope}`), [
    'reject/single', 'accept/propagate', 'finalize/document', 'bulk-clear/bulk',
  ]);
  assert.equal(log.read()[1].affected, 3);
});

test('state survives a restart by replaying the audit log', () => {
  const dir  = fs.mkdtempSync(path.join(os.tmpdir(), 'sprintfour-'));
  const file = path.join(dir, 'audit.log');

  const first = make(createAuditLog(file));
  first.reviewSpan('red1', 'red1_s2', 'reject');
  first.propagate('red1', 'ent_a', 'accept');
  first.finalize('red1');
  first.bulkClear(['grn2']);
  const before = first.listDocuments();

  fs.appendFileSync(file, '{not json\n'); // a torn write must not break startup
  const second = make(createAuditLog(file));
  assert.deepEqual(second.listDocuments(), before);
  assert.deepEqual(second.replayStats, { applied: 4, ignored: 0, malformed: 1 });

  fs.rmSync(dir, { recursive: true, force: true });
});

test('replay skips entries that no longer apply', () => {
  const log = createAuditLog(null);
  log.append({ action: 'accept', scope: 'single', docId: 'gone', spanId: 'x' });
  log.append({ action: 'something-new', scope: 'single', docId: 'red1' });
  const svc = make(log);
  assert.deepEqual(svc.replayStats, { applied: 0, ignored: 2, malformed: 0 });
});
