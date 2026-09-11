import { test, expect } from '@playwright/test';
import { mockAPI, mockReader, mockSearch } from './fixtures';

test('the shortcut overlay opens on ? and closes without leaving the story', async ({ page }) => {
  await mockAPI(page);
  await mockReader(page);
  await page.goto('/item?id=1&feed=top');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeHidden();
  await page.keyboard.press('?');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Open the article on archive.is')).toBeVisible();
  // Escape belongs to the dialog here, not to the back-to-the-list shortcut.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL('/item?id=1&feed=top');
});

test('stories can be saved from the list and survive a reload', async ({ page }) => {
  await mockAPI(page);
  await page.goto('/?feed=top');
  const rows = page.locator('.feed-panel:not([hidden]) .story-row h2 a');
  await expect(rows.first()).toBeVisible();
  await page.keyboard.press('j');
  await page.keyboard.press('s');

  await page.getByRole('link', { name: 'Saved' }).click();
  const savedPanel = page.getByRole('region', { name: 'Saved stories' });
  await expect(savedPanel.locator('.story-row')).toHaveCount(1);
  await page.reload();
  await expect(savedPanel.locator('.story-row h2')).toContainText('quiet craft');

  await savedPanel.getByRole('button', { name: /^Remove/ }).click();
  await expect(savedPanel.getByText('Nothing saved yet')).toBeVisible();
});

test('hiding read stories filters the list without breaking pagination', async ({ page }) => {
  await mockAPI(page);
  await page.goto('/?feed=top');
  const rows = page.locator('.feed-panel:not([hidden]) .story-row');
  await expect(rows).toHaveCount(30);
  await rows.first().locator('h2 a').click();
  await page.getByRole('link', { name: 'Back to stories' }).click();

  await page.locator('.feed-panel:not([hidden])').getByLabel('Hide read').check();
  await expect(rows).toHaveCount(29);
  await page.getByRole('button', { name: 'Load more stories' }).click();
  await expect(rows).toHaveCount(59);
  await expect(page.getByText('30 of 65 stories')).toBeHidden();
  await expect(page.getByText('60 of 65 stories')).toBeVisible();
});

test('a opens the archive snapshot of the focused story in a new tab', async ({ page }) => {
  await mockAPI(page);
  await page.goto('/?feed=top');
  await expect(page.locator('.feed-panel:not([hidden]) .story-row h2 a').first()).toBeVisible();
  await page.keyboard.press('j');
  const [archive] = await Promise.all([page.context().waitForEvent('page'), page.keyboard.press('a')]);
  expect(archive.url()).toContain('archive.is/newest/https://maggieappleton.com/story/1');
  await archive.close();
});

test('pointing at a story warms its comments before it is opened', async ({ page }) => {
  const requests = await mockAPI(page);
  await page.goto('/?feed=top');
  const rows = page.locator('.feed-panel:not([hidden]) .story-row');
  await expect(rows.first()).toBeVisible();
  expect(requests).not.toContain(100);

  await rows.first().hover();
  // The discussion opens with twenty comments, so that is what a warm row holds.
  await expect.poll(() => requests.filter(id => id >= 100 && id < 120)).toHaveLength(20);

  // A row is warmed once; crossing it again costs nothing.
  const settled = requests.length;
  await rows.first().hover();
  await page.waitForTimeout(300);
  expect(requests).toHaveLength(settled);
});

test('focusing a search result fetches the story the results never carried', async ({ page }) => {
  const requests = await mockAPI(page);
  await mockSearch(page);
  await page.goto('/?q=quiet%20craft');
  await expect(page.locator('.feed-panel:not([hidden]) .story-row h2 a').first()).toBeVisible();
  // Algolia supplies every field a row shows, so nothing has reached the item API yet.
  expect(requests).toHaveLength(0);

  await page.keyboard.press('j');
  await expect.poll(() => requests).toContain(1);
});
