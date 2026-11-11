'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');

const { detect }          = require('../src/pipeline/mockDetector');
const { recallPass }      = require('../src/pipeline/recallPass');
const { computeTier }     = require('../src/pipeline/tierEngine');
const { analyzeDocument } = require('../src/pipeline');

const span = (overrides) => ({
  source: 'detector', type: 'NAME', confidence: 0.9, start: 0, end: 1, reviewStatus: 'pending', ...overrides,
});

test('detector: finds labelled names without the label prefix', () => {
  const text  = 'Full Name: Jane Doe\nPhone: (555) 123-4567';
  const spans = detect(text, 'd1');
  const name  = spans.find(s => s.type === 'NAME');
  assert.equal(name.text, 'Jane Doe');
  assert.equal(text.slice(name.start, name.end), 'Jane Doe');
  assert.ok(spans.some(s => s.type === 'PHONE' && s.text === '(555) 123-4567'));
});

test('detector: offsets always match the source text', () => {
  const text = 'Dr. Ann Lee saw Mr. Bob Ray. SSN 123-45-6789, email bob@example.com, 12 Oak Street, Austin, TX 78701';
  for (const s of detect(text, 'd1')) {
    assert.equal(text.slice(s.start, s.end), s.text, `${s.type} span offsets`);
  }
});

test('detector: confidence is deterministic and within bounds', () => {
  const text = 'SSN 123-45-6789 and contact a@b.co';
  const a = detect(text, 'doc_x');
  const b = detect(text, 'doc_x');
  assert.deepEqual(a, b);
  for (const s of a) assert.ok(s.confidence >= 0.5 && s.confidence <= 0.99);
});

test('detector: span ids are unique and ordered by position', () => {
  const spans = detect('a@b.co 123-45-6789 (555) 123-4567', 'd');
  assert.deepEqual(spans.map(s => s.spanId), ['d_s1', 'd_s2', 'd_s3']);
  assert.deepEqual([...spans].sort((x, y) => x.start - y.start), spans);
});

test('recall: surfaces formats the detector misses', () => {
  const text = 'SSN 123456789, call 555-123-4567 or 555.987.6543';
  const hits = recallPass(text, detect(text, 'd'), 'd');
  assert.deepEqual(hits.map(h => [h.type, h.text]), [
    ['SSN', '123456789'],
    ['PHONE', '555-123-4567'],
    ['PHONE', '555.987.6543'],
  ]);
  for (const h of hits) {
    assert.equal(h.source, 'recall');
    assert.equal(h.confidence, null);
  }
});

test('recall: never overlaps a detector span, even partially', () => {
  const text = 'call 555-123-4567'; // recall phone hit covers [5, 17)
  assert.equal(recallPass(text, [], 'd').length, 1);
  assert.equal(recallPass(text, [span({ start: 10, end: 20 })], 'd').length, 0, 'partial overlap');
  assert.equal(recallPass(text, [span({ start: 0, end: 30 })], 'd').length, 0, 'full containment');
});

test('recall: does not duplicate what the detector already found', () => {
  const text = 'Email jane@example.com';
  assert.equal(recallPass(text, detect(text, 'd'), 'd').length, 0);
});

test('tier: missed SSN is red', () => {
  const r = computeTier([span({}), span({ source: 'recall', type: 'SSN', confidence: null })]);
  assert.equal(r.tier, 'red');
  assert.equal(r.tierReason, 'flagged: possible missed ssn');
});

test('tier: missed phone is yellow', () => {
  const r = computeTier([span({}), span({ source: 'recall', type: 'PHONE', confidence: null })]);
  assert.equal(r.tier, 'yellow');
  assert.equal(r.tierReason, 'flagged: possible missed phone');
});

test('tier: low average confidence escalates', () => {
  assert.equal(computeTier([span({ confidence: 0.55 })]).tier, 'red');
  assert.equal(computeTier([span({ confidence: 0.7 })]).tier, 'yellow');
});

test('tier: green reason is grammatical', () => {
  assert.equal(computeTier([span({})]).tierReason, 'clear: 1 high-confidence entity detected');
  assert.equal(computeTier([span({}), span({})]).tierReason, 'clear: 2 high-confidence entities detected');
  assert.equal(computeTier([]).tierReason, 'clear: no PII detected');
});

test('pipeline: analyzeDocument wires detect → recall → tier', () => {
  const r = analyzeDocument('d', 'Patient Name: Jane Doe\nSSN 123456789');
  assert.equal(r.tier, 'red');
  assert.ok(r.spans.some(s => s.source === 'recall' && s.type === 'SSN'));
  assert.ok(r.spans.some(s => s.source === 'detector' && s.type === 'NAME'));
});
