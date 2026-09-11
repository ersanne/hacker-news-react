import { test, expect } from '@playwright/test';
import { mockAPI, mockComments, pinSettings } from './fixtures';

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

test('the story author is marked in their own thread', async ({ page }) => {
  await pinSettings(page, { autoExpand: false });
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=1');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  const rows = discussion.locator('.comments-list > .comment');

  // Story 1 is by simonw, and so is the comment at the top of its thread.
  await expect(rows.first().locator('.op-badge')).toHaveText(/OP/);
  await expect(rows.nth(1).locator('.op-badge')).toHaveCount(0);

  // A removed comment has no author, and an absent author is not a match.
  for (let i = 0; i < 2; i++) await discussion.getByRole('button', { name: 'Show 1 reply', exact: true }).first().click();
  await expect(page.getByText('This comment is no longer available.')).toBeVisible();
  await expect(discussion.locator('.op-badge')).toHaveCount(1);
});

test('a thin reply thread opens on its own, and a longer one waits', async ({ page }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=1');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });

  // simonw's thread runs four deep, so it still waits to be opened. Everything
  // below it is thin enough to unfurl in that one click.
  await expect(page.getByText('A nested reply worth reading.')).toBeHidden();
  await discussion.getByRole('button', { name: 'Show 1 reply', exact: true }).click();
  await expect(page.getByText('A surviving reply below a deleted comment.')).toBeVisible();

  // Turning the preference off puts every reply back behind its own click.
  await page.getByRole('button', { name: 'View settings' }).click();
  await page.getByRole('dialog', { name: 'View settings' }).getByLabel('Open').uncheck();
  await page.keyboard.press('Escape');
  await page.reload();
  await discussion.getByRole('button', { name: 'Show 1 reply', exact: true }).click();
  await expect(page.getByText('A nested reply worth reading.')).toBeVisible();
  await expect(page.getByText('A surviving reply below a deleted comment.')).toBeHidden();
});

test('a reply past the flattening depth names the comment it answers', async ({ page }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=1');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  // The chain runs simonw → ada → removed → grace → deepreader. Everything
  // under ada is thin enough to open on its own, and grace sits at the depth
  // where that stops, so the last reply is opened deliberately.
  await discussion.getByRole('button', { name: 'Show 1 reply', exact: true }).click();
  await discussion.getByRole('button', { name: 'Show 1 reply', exact: true }).click();

  // Only that last reply has lost the indent that said what it answers.
  const peeks = discussion.locator('.parent-peek');
  await expect(peeks).toHaveCount(1);
  await expect(peeks).toContainText('In reply to grace: A surviving reply below a deleted comment.');

  await peeks.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-comment-id'))).toBe('3000');
});

test('X folds the whole conversation and keeps the comment being read', async ({ page }) => {
  await mockAPI(page);
  await mockComments(page);
  await page.goto('/item?id=1');
  const discussion = page.getByRole('region', { name: 'Discussion', exact: true });
  await expect(discussion.locator('.comments-list > .comment')).toHaveCount(20);

  await page.keyboard.press('n');
  await page.keyboard.press('n');
  const reading = await page.evaluate(() => document.activeElement?.getAttribute('data-comment-id'));

  await page.keyboard.press('X');
  await expect(discussion.locator('.collapsed-note')).toHaveCount(20);
  await expect(discussion.getByRole('button', { name: 'Expand all' })).toBeVisible();
  // The tree is rebuilt to fold it, so the comment being read has to survive.
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-comment-id'))).toBe(reading);

  await page.keyboard.press('X');
  await expect(discussion.locator('.collapsed-note')).toHaveCount(0);
  // Expanding everything opens the replies too, not merely the threads.
  await expect(page.getByText('A nested reply worth reading.')).toBeVisible();
  await expect(page.getByText('A surviving reply below a deleted comment.', { exact: true })).toBeVisible();
});
