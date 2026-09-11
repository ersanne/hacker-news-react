import { test, expect, type Page } from '@playwright/test';
import { mockAPI, mockReader } from './fixtures';


async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'View settings' }).click();
  return page.getByRole('dialog');
}
function choose(page: Page, group: string, option: string) {
  return page.getByRole('group', { name: group }).getByRole('button', { name: option }).click();
}
// Column arrangement only exists where there is more than one column.
const desktopOnly = ({ project }: { project: { name: string } }) =>
  test.skip(project.name !== 'desktop', 'A phone shows one pane at a time.');

test('width and density are chosen once and remembered', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await mockAPI(page);
  await page.goto('/');
  const shell = page.locator('.app-shell');
  const width = () => shell.evaluate(element => element.getBoundingClientRect().width);
  const rowHeight = () => page.locator('.story-row').first().evaluate(element => element.getBoundingClientRect().height);

  const comfortable = await rowHeight();
  await openSettings(page);
  await choose(page, 'Width', 'Full');
  await expect(shell).toHaveAttribute('data-width', 'full');
  expect(await width()).toBe(1440);

  await choose(page, 'Density', 'Compact');
  await expect(shell).toHaveAttribute('data-density', 'compact');
  expect(await rowHeight()).toBeLessThan(comfortable);

  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-width', 'full');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-density', 'compact');
  expect(await width()).toBe(1440);
});

test('the middle column can be the comments or the article', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await mockAPI(page);
  await mockReader(page);
  await page.goto('/item?id=1&feed=top&article=1');
  const comments = page.locator('.discussion-column');
  const article = page.locator('.article-column');
  async function boxes() {
    const [left, right] = [(await comments.boundingBox())!, (await article.boundingBox())!];
    // Side by side, never stacked: the panes share a row and a height.
    expect(left.y).toBe(right.y);
    expect(left.height).toBe(right.height);
    return [left.x, right.x];
  }

  // Comments first is the default: the article is not sandwiched in the middle.
  const [commentsFirst, articleLast] = await boxes();
  expect(commentsFirst).toBeLessThan(articleLast);

  await openSettings(page);
  await choose(page, 'Middle column', 'Article');
  await page.keyboard.press('Escape');
  const [commentsLast, articleFirst] = await boxes();
  expect(articleFirst).toBeLessThan(commentsLast);
});

test('panes can be hidden while reading, and Escape brings them back', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await mockAPI(page);
  await mockReader(page);
  await page.goto('/item?id=1&feed=top&article=1');
  const feed = page.locator('.feed-column');
  const comments = page.locator('.discussion-column');
  const article = page.locator('.article-column');
  await expect(article.getByText('Extracted body for')).toBeVisible();

  await page.keyboard.press('c');
  await expect(page).toHaveURL(/panes=nocomments/);
  await expect(comments).toBeHidden();
  await expect(feed).toBeVisible();

  await page.keyboard.press('z');
  await expect(feed).toBeHidden();
  await expect(comments).toBeHidden();
  await expect(article).toBeVisible();
  // The article has the reader to itself.
  expect((await article.boundingBox())!.width).toBe((await page.locator('.reader').boundingBox())!.width);

  // j is inert rather than broken while there is no list to move through.
  await page.keyboard.press('j');
  await expect(article).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(feed).toBeVisible();
  await expect(comments).toBeVisible();
  await expect(page).toHaveURL('/item?id=1&feed=top&article=1');

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/?feed=top&article=1');
  await expect(page.locator('.story-row').first().locator('h2 a')).toBeFocused();
});

test('the toolbar hides the comments and the story list', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await mockAPI(page);
  await mockReader(page);
  await page.goto('/item?id=1&feed=top&article=1');
  await page.getByRole('link', { name: 'Hide comments' }).click();
  await expect(page.locator('.discussion-column')).toBeHidden();
  await page.getByRole('link', { name: 'Show comments' }).click();
  await expect(page.locator('.discussion-column')).toBeVisible();
  await page.getByRole('link', { name: 'Hide list' }).click();
  await expect(page.locator('.feed-column')).toBeHidden();
  await page.getByRole('link', { name: 'Show list' }).click();
  await expect(page.locator('.feed-column')).toBeVisible();
});

test('hiding the feed heading moves refresh to the top bar', async ({ page }) => {
  const requests = await mockAPI(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The front page' })).toBeVisible();
  await expect(page.locator('.app-header').getByRole('button', { name: 'Refresh stories' })).toHaveCount(0);

  const dialog = await openSettings(page);
  await dialog.getByLabel('Show').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'The front page' })).toHaveCount(0);

  // Every feed panel is mounted, so only the visible one may offer the button.
  const refresh = page.getByRole('button', { name: 'Refresh stories' });
  await expect(refresh).toHaveCount(1);
  await expect(page.locator('.app-header').getByRole('button', { name: 'Refresh stories' })).toBeVisible();
  const before = requests.filter(id => id === 1).length;
  await refresh.click();
  await expect(page.locator('.story-row')).toHaveCount(30);
  await expect.poll(() => requests.filter(id => id === 1).length).toBeGreaterThan(before);
});

test('auto-refresh offers new stories instead of moving the list', async ({ page }) => {
  await page.clock.install();
  const requests = await mockAPI(page);
  await page.goto('/');
  await expect(page.locator('.story-row')).toHaveCount(30);

  const dialog = await openSettings(page);
  await dialog.getByLabel('Auto-refresh interval').selectOption('1');
  await page.keyboard.press('Escape');

  await page.route('https://hacker-news.firebaseio.com/v0/topstories.json', route =>
    route.fulfill({ json: [66, 67, 68, ...Array.from({ length: 65 }, (_, i) => i + 1)] }));
  await page.route(/item\/6[678]\.json/, route => route.fulfill({
    json: { id: 66, type: 'story', title: 'A newly arrived story', url: 'https://example.com/new', by: 'ada', score: 5, time: 1, descendants: 0 },
  }));

  const scroll = page.locator('.feed-panel:not([hidden]) .feed-scroll');
  await scroll.evaluate(element => { element.scrollTop = 600; });
  const reading = page.locator('.story-row').nth(14);
  const before = (await reading.boundingBox())!.y;
  const settled = requests.length;
  await page.clock.runFor('01:00');

  const pill = page.getByRole('button', { name: /new stories/ });
  await expect(pill).toHaveText(/3 new stories/);
  // The list a reader is part-way down stays exactly as it was, and the pill
  // arrives without nudging the row under their eyes.
  await expect(page.locator('.story-row')).toHaveCount(30);
  expect((await reading.boundingBox())!.y).toBeCloseTo(before, 0);
  // Polling asks for the id list only, and leaves the cached stories alone.
  expect(requests.length).toBe(settled);

  await pill.click();
  await expect(page.getByRole('link', { name: 'A newly arrived story', exact: true }).first()).toBeVisible();
  await expect(pill).toHaveCount(0);
});

test('at the top of an untouched list new stories simply appear', async ({ page }) => {
  await page.clock.install();
  await mockAPI(page);
  await page.goto('/');
  await expect(page.locator('.story-row')).toHaveCount(30);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Auto-refresh interval').selectOption('1');
  await page.keyboard.press('Escape');

  await page.route('https://hacker-news.firebaseio.com/v0/topstories.json', route =>
    route.fulfill({ json: [66, ...Array.from({ length: 65 }, (_, i) => i + 1)] }));
  await page.route(/item\/66\.json/, route => route.fulfill({
    json: { id: 66, type: 'story', title: 'A newly arrived story', url: 'https://example.com/new', by: 'ada', score: 5, time: 1, descendants: 0 },
  }));

  await page.clock.runFor('01:00');
  await expect(page.getByRole('link', { name: 'A newly arrived story', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /new stories/ })).toHaveCount(0);
});

test('the keyboard help lists the pane shortcuts', async ({ page }) => {
  await mockAPI(page);
  await page.goto('/');
  const dialog = await openSettings(page);
  await dialog.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  await expect(page.getByText('Show or hide the comments pane')).toBeVisible();
  await expect(page.getByText('Focus mode')).toBeVisible();
});

test('a phone is offered no pane controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Pane hiding is a multi-column affordance.');
  await mockAPI(page);
  await mockReader(page);
  await page.goto('/item?id=1&feed=top&article=1');
  await expect(page.locator('.pane-focus')).toBeHidden();
  await expect(page.locator('.pane-comments')).toBeHidden();
  await page.keyboard.press('z');
  await expect(page.locator('.article-panel')).toBeVisible();
});
