import { test, expect } from '@playwright/test';
import { mockAPI, mockComments } from './fixtures';

test('an HN item link opens in the reader while other links leave it', async ({ page, context }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=66&feed=top');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });

  const outward = discussion.getByRole('link', { name: /this write-up/ });
  await expect(outward).toHaveAttribute('target', '_blank');

  // The pane arrangement travels with the link, so the reader keeps its layout.
  await discussion.getByRole('link', { name: /the earlier thread/ }).click();
  await expect(page).toHaveURL('/item?id=1&feed=top');
  await expect(discussion.getByRole('heading', { level: 2 })).toHaveText('The quiet craft of building software that lasts');
  expect(context.pages()).toHaveLength(1);
});

test('the conventions a comment types come through as the markup they meant', async ({ page }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=66');
  const comment = page.locator('.discussion-panel:not([hidden]) .comment .prose').first();

  await expect(comment.locator('code').first()).toHaveText('pnpm build');
  await expect(comment.locator('blockquote blockquote p')).toHaveText('nested deeper');
  await expect(comment.locator('ul li')).toHaveText(['first item', 'second item']);
  await expect(comment.locator('sup')).toHaveText('[1]');
  // The indent that marked the block as code is not part of the code.
  await expect(comment.locator('pre')).toHaveText('one\n  two\nthree');
});

test('a code block can be copied, and the thread keys still work from its button', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The clipboard permission is a desktop Chrome grant');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=66');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });

  await discussion.getByRole('button', { name: 'Copy code' }).first().click();
  await expect(discussion.getByText('Copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('one\n  two\nthree');

  // Focus inside a comment body still belongs to the comment it sits in.
  await page.keyboard.press('n');
  await expect.poll(() => page.evaluate(() => document.activeElement?.className)).toContain('comment');
});

test('a long code block folds, and wrapping is a preference every block follows', async ({ page }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=66');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  const blocks = discussion.locator('.code-block');

  // The short block is shown whole; only the long one is folded.
  await expect(blocks).toHaveCount(2);
  await expect(blocks.first()).toHaveAttribute('data-folded', 'off');
  await expect(blocks.last()).toHaveAttribute('data-folded', 'on');
  await discussion.getByRole('button', { name: 'Show all 22 lines' }).click();
  await expect(blocks.last()).toHaveAttribute('data-folded', 'off');

  await discussion.getByRole('button', { name: 'Wrap long lines' }).first().click();
  await expect(blocks.first()).toHaveAttribute('data-wrap', 'on');
  await expect(blocks.last()).toHaveAttribute('data-wrap', 'on');
  await page.reload();
  await expect(blocks.first()).toHaveAttribute('data-wrap', 'on');
});
