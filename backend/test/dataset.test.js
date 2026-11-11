'use strict';

// Invariants of the committed dataset. If the generator or the pipeline
// changes, regenerate with `npm run generate` and these must still hold.

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');

const { analyzeDocument } = require('../src/pipeline');

const DATA    = path.resolve(__dirname, '../../data');
const dataset = JSON.parse(fs.readFileSync(path.join(DATA, 'dataset.json'), 'utf8'));
const heroes  = JSON.parse(fs.readFileSync(path.join(DATA, 'hero-docs.json'), 'utf8'));

test('document and span ids are unique', () => {
  assert.equal(new Set(dataset.map(d => d.id)).size, dataset.length);
  const spanIds = dataset.flatMap(d => d.spans.map(s => s.spanId));
  assert.equal(new Set(spanIds).size, spanIds.length);
});

test('every span offset matches the document text', () => {
  for (const doc of dataset) {
    for (const s of doc.spans) {
      assert.equal(doc.text.slice(s.start, s.end), s.text, `${doc.id}/${s.spanId}`);
    }
  }
});

test('spans never overlap within a document', () => {
  for (const doc of dataset) {
    const spans = [...doc.spans].sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) {
      assert.ok(spans[i].start >= spans[i - 1].end, `${doc.id}: ${spans[i - 1].spanId} overlaps ${spans[i].spanId}`);
    }
  }
});

test('stored tiers match the current pipeline (dataset is not stale)', () => {
  for (const doc of dataset) {
    const fresh = analyzeDocument(doc.id, doc.text);
    assert.equal(fresh.tier, doc.tier, doc.id);
    assert.equal(fresh.tierReason, doc.tierReason, doc.id);
    assert.equal(fresh.spans.length, doc.spans.length, doc.id);
  }
});

test('tier mix supports triage (most documents are safely bulk-clearable)', () => {
  const counts = { red: 0, yellow: 0, green: 0 };
  for (const d of dataset) counts[d.tier]++;
  assert.ok(counts.red > 0 && counts.yellow > 0);
  assert.ok(counts.green / dataset.length > 0.6);
});

test('hero documents are the first entries of the dataset', () => {
  assert.deepEqual(dataset.slice(0, heroes.length), heroes);
});

test('recurring entities appear in several documents (propagation has something to do)', () => {
  const docsPerEntity = new Map();
  for (const doc of dataset) {
    for (const id of new Set(doc.spans.map(s => s.entityId).filter(Boolean))) {
      docsPerEntity.set(id, (docsPerEntity.get(id) || 0) + 1);
    }
  }
  assert.ok([...docsPerEntity.values()].some(n => n >= 5));
});
