import { test, expect } from '@playwright/test';
import { mockAPI } from './fixtures';

test('wide-screen gutters cannot scroll the page beyond the reader', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Wide-screen layout');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockAPI(page);
  await page.goto('/item?id=1');
  await expect(page.locator('.comments-list > .comment')).toHaveCount(20);
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    viewport: innerHeight,
    document: document.documentElement.scrollHeight,
    body: document.body.scrollHeight,
  }));
  expect(dimensions.document).toBe(dimensions.viewport);
  for (const x of [40, 1880]) {
    await page.mouse.move(x, 500);
    await page.mouse.wheel(0, 2500);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  const discussion = page.locator('.discussion-panel:not([hidden]) .discussion-scroll');
  await discussion.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => discussion.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const feed = page.locator('.feed-panel:not([hidden]) .feed-scroll');
  await feed.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => feed.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
