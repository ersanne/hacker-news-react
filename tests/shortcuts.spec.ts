import { test, expect, type Page } from '@playwright/test';
import { mockAPI, mockComments, mockReader, mockSearch } from './fixtures';

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
  await mockAPI(page);
  const threads = await mockComments(page);
  await page.goto('/?feed=top');
  const rows = page.locator('.feed-panel:not([hidden]) .story-row');
  await expect(rows.first()).toBeVisible();
  expect(threads).toHaveLength(0);

  await rows.first().hover();
  await expect.poll(() => threads).toEqual([1]);

  // A row is warmed once; crossing it again costs nothing.
  await rows.first().hover();
  await page.waitForTimeout(300);
  expect(threads).toEqual([1]);
});

test('j and k carry on from the open story, not from the top of the list', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A phone hides the list while a story is open');
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/?feed=top');
  const rows = page.locator('.feed-panel:not([hidden]) .story-row');
  await expect(rows.first()).toBeVisible();
  await rows.nth(4).locator('h2 a').click();
  await expect(page).toHaveURL('/item?id=5&feed=top');

  // Focus sits on the discussion heading, so the list has nothing focused of its own.
  await page.keyboard.press('j');
  await expect(rows.nth(5).locator('h2 a')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/item?id=6&feed=top');
  await page.keyboard.press('k');
  await expect(rows.nth(4).locator('h2 a')).toBeFocused();
});

// The collapse control names its own comment, so its label says which comment holds focus.
const focusedAuthor = (page: Page) => page.evaluate(() =>
  document.activeElement?.querySelector('.collapse-target')?.getAttribute('aria-label')?.replace(/^\w+ comment by /, '') ?? '');

test('n and p walk the comments while N and P skip whole threads', async ({ page }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=1');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(20);

  await page.keyboard.press('n');
  expect(await focusedAuthor(page)).toBe('simonw');
  await page.keyboard.press('n');
  expect(await focusedAuthor(page)).toBe('reader101');
  await page.keyboard.press('p');
  expect(await focusedAuthor(page)).toBe('simonw');

  await page.keyboard.press('Enter');
  await expect(page.getByText('A nested reply worth reading.')).toBeVisible();
  await page.keyboard.press('n');
  expect(await focusedAuthor(page)).toBe('ada');
  await page.keyboard.press('N');
  expect(await focusedAuthor(page)).toBe('reader101');
  await page.keyboard.press('P');
  expect(await focusedAuthor(page)).toBe('simonw');
});

test('x collapses the focused comment and n carries on past the first batch', async ({ page }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=1');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(20);

  await page.keyboard.press('n');
  await page.keyboard.press('x');
  await expect(discussion.locator('.collapsed-note')).toHaveText('Comment collapsed · 4 replies');
  await page.keyboard.press('x');
  await expect(discussion.locator('.collapsed-note')).toHaveCount(0);

  for (let i = 0; i < 19; i++) await page.keyboard.press('N');
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(20);
  await page.keyboard.press('n');
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(25);
  await expect.poll(() => focusedAuthor(page)).toBe('reader120');
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
