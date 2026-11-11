import { test, expect } from '@playwright/test';

// End-to-end tests against the production build and the real API.
// Tests run in order against one server, so each one uses its own documents:
//   doc_H01  review flow + finalize     doc_H02  keyboard edge cases
//   doc_H05  error handling             John Smith docs  propagation
//   green docs  bulk clear (runs last)

const suggestions = page => page.locator('.suggestion');

async function openDoc(page, id) {
  await page.goto(`/review/${id}`);
  await expect(page.locator('.review-title')).toBeVisible();
}

test('dashboard lists the queue riskiest first and shows both axes', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.doc-card');
  await expect(cards).toHaveCount(155);

  const first = cards.first();
  await expect(first).toContainText('High risk');
  await expect(first).toContainText('Needs Review');
  await expect(first).toContainText('possible missed');

  await expect(page.locator('.stat-row')).toContainText('Needs Review');
  await expect(page.locator('.bulk-clear')).toContainText('106 low-risk documents');
});

test('review a document with the keyboard, then finalize', async ({ page }) => {
  await openDoc(page, 'doc_H01');
  await expect(page.getByText('High risk')).toBeVisible();
  await expect(page.locator('.review-header')).toContainText('Needs Review');

  // A recall hit ("MISS?") is ordered first and is active on load.
  const active = page.locator('.suggestion.is-active');
  await expect(active).toContainText('MISS?');

  const total = await suggestions(page).count();
  const finalize = page.getByRole('button', { name: /Finalize Review/ });
  await expect(finalize).toBeDisabled();

  await page.keyboard.press('a');
  await expect(suggestions(page)).toHaveCount(total - 1);
  await expect(page.locator('.review-header')).toContainText('In Progress');

  // j / k move the selection without acting.
  const before = await active.textContent();
  await page.keyboard.press('j');
  await expect(active).not.toHaveText(before);
  await page.keyboard.press('k');
  await expect(active).toHaveText(before);

  // Shortcuts keep working after a mouse click leaves focus on a button.
  await active.getByRole('button', { name: /Reject/ }).click();
  await expect(suggestions(page)).toHaveCount(total - 2);
  await page.keyboard.press('r');
  await expect(suggestions(page)).toHaveCount(total - 3);

  for (let left = total - 3; left > 0; left--) {
    await page.keyboard.press('a');
    await expect(suggestions(page)).toHaveCount(left - 1);
  }

  await expect(finalize).toBeEnabled();
  await page.keyboard.press('f');
  await expect(page).not.toHaveURL(/doc_H01$/); // moved on to the next document

  // The finalized document is now cleared and read-only.
  await openDoc(page, 'doc_H01');
  await expect(page.locator('.review-header')).toContainText('Cleared');
  await expect(page.getByText('✓ Finalized')).toBeVisible();
  await expect(page.getByRole('button', { name: /Accept/ })).toHaveCount(0);
});

test('modified keys do not trigger review shortcuts', async ({ page }) => {
  await openDoc(page, 'doc_H02');
  const total = await suggestions(page).count();

  await page.keyboard.press('Control+a');
  await page.keyboard.press('Alt+r');
  await page.reload();
  await expect(suggestions(page)).toHaveCount(total);
  await expect(page.locator('.review-header')).toContainText('Needs Review');
});

test('n opens the next document and Escape returns to the dashboard', async ({ page }) => {
  await openDoc(page, 'doc_H02');
  await page.keyboard.press('n');
  await expect(page).not.toHaveURL(/doc_H02$/);
  await expect(page).toHaveURL(/\/review\//);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
});

test('unknown documents show a not-found message instead of hanging', async ({ page }) => {
  await page.goto('/review/does_not_exist');
  await expect(page.getByRole('alert')).toHaveText('Document not found.');
});

test('a failed action surfaces an error instead of failing silently', async ({ page }) => {
  await openDoc(page, 'doc_H05');
  await page.route('**/api/documents/*/spans/*', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal server error"}' }));

  const total = await suggestions(page).count();
  await page.keyboard.press('a');
  await expect(page.getByRole('status')).toHaveText('Internal server error');
  await expect(suggestions(page)).toHaveCount(total);
});

test('propagation previews its scope, then applies across documents', async ({ page, request }) => {
  const docs = await (await request.get('/api/documents')).json();
  const smithDocs = docs.filter(d => /John Smith/.test(d.title) && d.workflowStatus === 'needs_review');
  expect(smithDocs.length).toBeGreaterThan(1);

  await openDoc(page, smithDocs[0].id);
  const item = suggestions(page).filter({ hasText: 'John Smith' }).first();
  await item.getByRole('button', { name: 'Propagate…' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.scope-box')).toContainText(/Will update \d+ pending spans? across \d+ documents?/);

  // Escape cancels without changing anything.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await item.getByRole('button', { name: 'Propagate…' }).click();
  const scope = await dialog.locator('.scope-box strong').allTextContents();
  const docCount = Number(scope[1].match(/\d+/)[0]);
  expect(docCount).toBeGreaterThan(1);

  await dialog.getByRole('button', { name: 'Accept all' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('across documents');

  // Another John Smith document was updated without being opened.
  const other = await (await request.get(`/api/documents/${smithDocs[1].id}`)).json();
  expect(other.workflowStatus).toBe('in_progress');
});

test('bulk clear removes low-risk documents from the queue', async ({ page }) => {
  await page.goto('/');
  const bulk = page.locator('.bulk-clear');
  await bulk.getByRole('button', { name: 'Select all' }).click();
  await bulk.getByRole('button', { name: /^Clear \d+ docs$/ }).click();

  await expect(page.getByRole('status')).toContainText(/Cleared \d+ documents/);
  await expect(page.locator('.bulk-clear')).toHaveCount(0);
  // Untouched low-risk documents are gone; ones already in progress stay for review.
  await expect(page.locator('.doc-card').filter({ hasText: 'Low risk' }).filter({ hasText: 'Needs Review' })).toHaveCount(0);
});

test('state survives a page reload (persisted server-side)', async ({ page }) => {
  await page.goto('/');
  const cleared = page.locator('.stat').filter({ hasText: 'Cleared' }).locator('dd');
  const value = await cleared.textContent();
  expect(Number(value)).toBeGreaterThan(50);
  await page.reload();
  await expect(cleared).toHaveText(value);
});
