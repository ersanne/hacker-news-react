import { test, expect, type Page } from '@playwright/test';
import { mockAPI, mockComments, mockSearch } from './fixtures';

const canonical = (page: Page) => page.locator('link[rel="canonical"]');
const robots = (page: Page) => page.locator('meta[name="robots"]');

test('every view describes itself to a crawler', async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The head is the same at every viewport.');
  await mockAPI(page);
  await mockComments(page);
  await mockSearch(page);

  await page.goto('/');
  await expect(page).toHaveTitle('HN Reader — A little less noise.');
  await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/`);
  await expect(robots(page)).toHaveCount(0);

  await page.getByRole('link', { name: 'New', exact: true }).click();
  await expect(page).toHaveTitle('Fresh off the keyboard — HN Reader');
  await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/?feed=new`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'The latest submissions, as they arrive.');

  await page.goto('/?q=quiet');
  await expect(page).toHaveTitle('quiet — HN Reader');
  await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/?q=quiet`);
  await expect(robots(page)).toHaveAttribute('content', 'noindex, follow');

  // The pane layout in the URL is a reading arrangement, so it stays out of the
  // canonical the story is indexed under.
  await page.goto('/item?id=1&article=1&panes=nofeed');
  await expect(page).toHaveTitle('The quiet craft of building software that lasts — HN Reader');
  await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/item?id=1`);
  await expect(robots(page)).toHaveAttribute('content', 'noindex, follow');

  await page.goto('/nowhere');
  await expect(page).toHaveTitle('Nothing to read here — HN Reader');
  await expect(canonical(page)).toHaveCount(0);
  await expect(robots(page)).toHaveAttribute('content', 'noindex, follow');
});
