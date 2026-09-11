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
