import { test } from '@playwright/test';

// Regenerates the README screenshots in docs/. Skipped in normal runs:
//   npm run screenshots
test.skip(!process.env.UPDATE_SCREENSHOTS, 'set UPDATE_SCREENSHOTS=1 to regenerate');

const OUT = '../docs/screenshots';

test('dashboard', async ({ page }) => {
  await page.goto('/');
  await page.locator('.doc-card').first().waitFor();
  await page.screenshot({ path: `${OUT}/dashboard.png` });
});

test('review panel', async ({ page }) => {
  await page.goto('/review/doc_H01');
  await page.locator('.suggestion').first().waitFor();
  await page.keyboard.press('a'); // show a mix of reviewed and pending suggestions
  await page.locator('.toast').waitFor({ state: 'detached' });
  await page.screenshot({ path: `${OUT}/review.png` });
});

test('propagation preview', async ({ page }) => {
  await page.goto('/');
  await page.locator('.doc-card', { hasText: 'John Smith' }).first().click();
  await page.locator('.suggestion', { hasText: 'John Smith' }).first().getByRole('button', { name: 'Propagate…' }).click();
  await page.locator('.scope-box strong').first().waitFor();
  await page.screenshot({ path: `${OUT}/propagate.png` });
});
