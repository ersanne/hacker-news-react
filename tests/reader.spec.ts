import { test, expect } from '@playwright/test';
import { mockAPI } from './fixtures';

const firstTitle = 'The quiet craft of building software that lasts';

test('feed navigation, pagination, original links, and explicit refresh', async ({ page }) => {
  const requests = await mockAPI(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The front page' })).toBeVisible();
  await expect(page.locator('.story-row')).toHaveCount(30);
  await expect(page.locator('.story-domain a').first()).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: 'Load more stories' }).click();
  await expect(page.locator('.story-row')).toHaveCount(60);
  await page.getByRole('link', { name: 'New', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fresh off the keyboard' })).toBeVisible();
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(3);
  await page.getByRole('link', { name: /Top/, exact: true }).click();
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(60);
  const before = requests.filter(id => id === 1).length;
  await page.getByRole('button', { name: 'Refresh stories' }).click();
  await expect(page.locator('.feed-panel:not([hidden]) .story-row')).toHaveCount(30);
  expect(requests.filter(id => id === 1).length).toBeGreaterThan(before);
});

test('discussion, progressive replies, collapse retention, and history', async ({ page }, testInfo) => {
  const requests = await mockAPI(page);
  await page.goto('/');
  await page.getByRole('link', { name: firstTitle, exact: true }).click();
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  await expect(discussion.getByRole('heading', { name: firstTitle })).toBeVisible();
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(20);
  expect(requests).not.toContain(1000);
  await discussion.getByRole('button', { name: 'Show 1 reply', exact: true }).click();
  await expect(page.getByText('A nested reply worth reading.')).toBeVisible();
  await discussion.getByRole('button', { name: 'Hide replies', exact: true }).click();
  await expect(page.getByText('A nested reply worth reading.')).toBeHidden();
  await discussion.getByRole('button', { name: 'Show 1 reply', exact: true }).first().click();
  await expect(page.getByText('A nested reply worth reading.')).toBeVisible();
  expect(requests.filter(id => id === 1000)).toHaveLength(1);
  await discussion.getByRole('button', { name: 'Collapse comment by simonw', exact: true }).click();
  await expect(page.getByText('A nested reply worth reading.')).toBeHidden();
  await discussion.getByRole('button', { name: 'Expand comment by simonw', exact: true }).click();
  await expect(page.getByText('A nested reply worth reading.')).toBeVisible();
  await discussion.getByRole('button', { name: 'Load more comments' }).click();
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(25);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'The front page' })).toBeVisible();
  await expect(page.locator('.story-row').first()).toHaveClass(/is-read/);
  await page.goForward();
  await expect(discussion.getByRole('heading', { name: firstTitle })).toBeAttached();
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(25);
  await page.screenshot({ path: testInfo.outputPath('discussion.png'), fullPage: true });
});

test('feed scroll is restored after returning from a story', async ({ page }) => {
  await mockAPI(page);
  await page.goto('/');
  await expect(page.locator('.story-row')).toHaveCount(30);
  const scroll = page.locator('.feed-panel:not([hidden]) .feed-scroll');
  await scroll.evaluate(element => { element.scrollTop = 600; });
  const before = await scroll.evaluate(element => element.scrollTop);
  const visible = await scroll.evaluate(element => {
    const middle = element.getBoundingClientRect().top + element.clientHeight / 2;
    return [...element.querySelectorAll('.story-row')].findIndex(row => row.getBoundingClientRect().top >= middle);
  });
  // A row already in view, so clicking it never scrolls the feed itself.
  await page.locator('.story-row').nth(visible).locator('h2 a').click();
  await page.getByRole('link', { name: 'Back to stories' }).click();
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(400);
  expect(Math.abs(await scroll.evaluate(element => element.scrollTop) - before)).toBeLessThan(180);
});

test('direct links, theme persistence, empty discussion, and invalid items', async ({ page }, testInfo) => {
  await mockAPI(page);
  await page.goto('/item?id=7&feed=ask');
  await expect(page.getByText('Tell us about something you’re making, big or small.')).toBeVisible();
  await expect(page.getByText('A little quiet here, for now.')).toBeVisible();
  await page.getByLabel('Color theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Tell us about something you’re making, big or small.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dark.png'), fullPage: true });
  await page.goto('/item?id=999');
  await expect(page.getByRole('heading', { name: 'Story unavailable' })).toBeVisible();
  await page.goto('/item?id=oops');
  await expect(page.getByRole('heading', { name: 'Nothing to read here.' })).toBeVisible();
});

test('failed items and comments can retry without losing the screen', async ({ page }) => {
  const failures = new Set([2, 100]);
  await mockAPI(page, { failItems: failures });
  await page.goto('/');
  await expect(page.getByText('This story couldn’t load.')).toBeVisible();
  failures.delete(2);
  await page.locator('.story-failure').getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.story-row')).toHaveCount(30);
  await page.getByRole('link', { name: firstTitle, exact: true }).click();
  await expect(page.getByText('This comment couldn’t load.')).toBeVisible();
  failures.delete(100);
  await page.getByRole('region', { name: 'Discussion', exact: true }).getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('The best tools are the ones', { exact: false })).toBeVisible();
});

test('deep threads preserve deleted parents and do not overflow', async ({ page }) => {
  await mockAPI(page);
  await page.goto('/item?id=1');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Show 1 reply', exact: true }).click();
  await expect(page.getByText('A surviving reply below a deleted comment.')).toBeVisible();
  await expect(page.getByText('This comment is no longer available.')).toBeVisible();
  await expect(page.getByText('unbroken'.repeat(80))).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('.discussion-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('switching away from a delayed discussion keeps the newer selection', async ({ page }) => {
  let release!: () => void;
  const releaseItem = new Promise<void>(resolve => { release = resolve; });
  await mockAPI(page, { delayItem: 1, releaseItem });
  await page.goto('/item?id=1');
  await page.getByRole('link', { name: 'Ask HN', exact: true }).click();
  await page.getByRole('link', { name: 'Ask HN: What are you working on this month?', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Discussion', exact: true }).getByRole('heading', { level: 2 })).toHaveText('Ask HN: What are you working on this month?');
  release();
  await expect(page.locator('.discussion-panel[hidden] .article-heading h2')).toHaveText(firstTitle);
  await expect(page).toHaveURL(/id=7/);
  await expect(page.getByRole('region', { name: 'Discussion', exact: true }).getByRole('heading', { level: 2 })).toHaveText('Ask HN: What are you working on this month?');
});

test('light front page and keyboard focus', async ({ page }, testInfo) => {
  await mockAPI(page);
  await page.goto('/');
  await page.getByLabel('Color theme').selectOption('light');
  await expect(page.locator('.story-row')).toHaveCount(30);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.locator(':focus').evaluate(element => (element as HTMLElement).blur());
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('front-page.png'), fullPage: true });
});

test('a failed feed recovers and an empty feed stays understandable', async ({ page }) => {
  const options = { failFeed: true };
  await mockAPI(page, options);
  await page.goto('/');
  await expect(page.getByText('Couldn’t load the stories.', { exact: false })).toBeVisible();
  options.failFeed = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.story-row')).toHaveCount(30);
  await page.route('**/showstories.json', route => route.fulfill({ json: [] }));
  await page.getByRole('link', { name: 'Show HN', exact: true }).click();
  await expect(page.getByText('No stories here just yet. Check back soon.')).toBeVisible();
});

test('reading works when storage is disabled and system theme follows the device', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockAPI(page);
  await page.goto('/');
  await expect(page.getByLabel('Color theme')).toHaveValue('system');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.getByRole('link', { name: firstTitle, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Discussion', exact: true }).getByRole('heading', { name: firstTitle })).toBeVisible();
  await page.getByLabel('Color theme').selectOption('light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
});

test('keyboard navigation restores focus and read indicators persist', async ({ page }) => {
  await mockAPI(page);
  await page.goto('/');
  const story = page.getByRole('link', { name: firstTitle, exact: true });
  await story.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Discussion', exact: true }).getByRole('heading', { name: firstTitle })).toBeFocused();
  await page.getByRole('link', { name: 'Back to stories' }).click();
  await expect(story).toBeFocused();
  await page.reload();
  await expect(page.locator('.story-row').first()).toHaveClass(/is-read/);
});
