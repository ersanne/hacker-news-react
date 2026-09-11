import { test, expect } from '@playwright/test';
import { mockAPI, mockReader, mockSite } from './fixtures';

const story = 'https://maggieappleton.com/story/1';

test('the article pane renders extracted text and switches to an embed', async ({ page }) => {
  await mockAPI(page);
  await mockSite(page);
  const readerUrls = await mockReader(page);
  await page.goto('/item?id=1&feed=top');
  const pane = page.getByRole('region', { name: 'Article', exact: true });
  await expect(pane).toBeHidden();

  await page.keyboard.press('r');
  await expect(page).toHaveURL('/item?id=1&feed=top&article=1');
  await expect(pane.getByRole('heading', { level: 2 })).toContainText('quiet craft');
  await expect(pane.getByText('Extracted body for')).toBeVisible();
  await expect(pane.getByText('min read')).toBeVisible();
  expect(readerUrls).toEqual([story]);

  await pane.getByRole('button', { name: 'Embed' }).click();
  const frame = pane.locator('iframe');
  await expect(frame).toHaveAttribute('src', story);
  await expect(frame).toHaveAttribute('sandbox', /allow-scripts/);
  expect(await frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
  await expect(pane.getByText('Many sites refuse to be embedded')).toBeVisible();

  // The chosen view is a reading preference, so it outlives the page.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Article', exact: true }).locator('iframe')).toBeVisible();
});

test('article links point at the original and at its archive snapshot', async ({ page }) => {
  await mockAPI(page);
  await mockReader(page);
  await page.goto('/item?id=1&feed=top&article=1');
  const pane = page.getByRole('region', { name: 'Article', exact: true });
  await expect(pane.getByRole('link', { name: /Open original/ })).toHaveAttribute('href', story);
  await expect(pane.getByRole('link', { name: /archive\.is/ })).toHaveAttribute('href', `https://archive.is/newest/${story}`);

  await page.goto('/item?id=1&feed=top');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  await expect(discussion.getByRole('link', { name: /archive\.is/ })).toHaveAttribute('href', `https://archive.is/newest/${story}`);
});

test('a failed extraction can be retried, and text-only stories say so', async ({ page }) => {
  await mockAPI(page);
  await mockReader(page, { fail: true });
  await page.goto('/item?id=1&feed=top&article=1');
  const pane = page.getByRole('region', { name: 'Article', exact: true });
  await expect(pane.getByRole('alert')).toBeVisible();
  await mockReader(page);
  await pane.getByRole('button', { name: 'Try again' }).click();
  await expect(pane.getByText('Extracted body for')).toBeVisible();

  await page.goto('/item?id=7&feed=ask&article=1');
  await expect(pane.getByText('no link of its own')).toBeVisible();
  await expect(pane.locator('.mode-switch')).toBeHidden();
});
