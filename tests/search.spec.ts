import { test, expect } from '@playwright/test';
import { mockAPI, mockSearch } from './fixtures';

test('search paginates, opens a result, and returns to the results', async ({ page }) => {
  await mockAPI(page);
  const queries = await mockSearch(page);
  await page.goto('/');
  await page.getByLabel('Search Hacker News stories').fill('quiet craft');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'quiet craft', exact: true })).toBeVisible();
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(7);
  expect(queries).toEqual([{ query: 'quiet craft', page: 0 }]);

  await page.getByLabel('Search Hacker News stories').fill('the');
  await page.keyboard.press('Enter');
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(30);
  await page.getByRole('button', { name: 'Load more results' }).click();
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(32);
  expect(queries.at(-1)).toEqual({ query: 'the', page: 1 });

  const result = page.locator('.feed-panel:not([hidden]) .story-row h2 a').first();
  const title = await result.innerText();
  await result.click();
  await expect(page.getByRole('region', { name: 'Discussion', exact: true }).getByRole('heading', { name: title })).toBeVisible();
  await expect(page).toHaveURL(/\/item\?id=\d+&q=the$/);
  await page.getByRole('link', { name: 'Back to stories' }).click();
  await expect(page).toHaveURL('/?q=the');
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(32);

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByRole('heading', { name: 'The front page' })).toBeVisible();
});

test('a direct search link works and an empty result stays understandable', async ({ page }) => {
  await mockAPI(page);
  await mockSearch(page);
  await page.goto('/?q=nothing%20matches%20this');
  await expect(page.getByText('Nothing matched “nothing matches this”. Try a different wording.')).toBeVisible();
  await expect(page.getByLabel('Search Hacker News stories')).toHaveValue('nothing matches this');
});

test('a failed search recovers on retry', async ({ page }) => {
  await mockAPI(page);
  await mockSearch(page, { fail: true });
  await page.goto('/?q=sqlite');
  const failure = page.getByRole('alert');
  await expect(failure).toContainText('Couldn’t run that search');
  await page.unrouteAll();
  await mockAPI(page);
  await mockSearch(page);
  await failure.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(7);
});

test('shortcuts move through stories, open discussions, and focus search', async ({ page }) => {
  await mockAPI(page);
  await mockSearch(page);
  await page.goto('/');
  const rows = page.locator('.feed-panel:not([hidden]) .story-row h2 a');
  await expect(rows.first()).toBeVisible();
  await page.keyboard.press('j');
  await expect(rows.nth(0)).toBeFocused();
  await page.keyboard.press('j');
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press('k');
  await expect(rows.nth(0)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Discussion', exact: true }).getByRole('heading').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/?feed=top');
  await expect(rows.nth(0)).toBeFocused();

  const [article] = await Promise.all([page.context().waitForEvent('page'), page.keyboard.press('o')]);
  await expect(rows.nth(0)).toBeFocused();
  expect(article.url()).toBe('https://maggieappleton.com/story/1');
  await article.close();

  await page.keyboard.press('/');
  const input = page.getByLabel('Search Hacker News stories');
  await expect(input).toBeFocused();
  await input.fill('unix philosophy');
  // A search input clears itself on Escape; the shortcut only returns focus to the page.
  await page.keyboard.press('Escape');
  await expect(input).not.toBeFocused();
  await expect(input).toHaveValue('');
});
