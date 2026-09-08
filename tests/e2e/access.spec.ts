import { expect, test } from '@playwright/test';

test('an approved Pending Editor can enter the Builder with the same GitHub identity', async ({
  page,
  context,
}) => {
  const suffix = Date.now().toString();
  const githubUserId = `91${suffix.slice(-11)}`;
  const login = `approved-${suffix.slice(-12)}`;

  await page.goto(`/auth/dev?githubUserId=${githubUserId}&login=${login}`);
  await expect(page.getByRole('heading', { name: /access request pending/i })).toBeVisible();

  await context.clearCookies();
  await page.goto('/auth/dev?githubUserId=1202831&login=brimdor');
  await page.getByRole('button', { name: 'Access' }).click();
  const member = page.locator('.membership-list > li').filter({ hasText: `@${login}` });
  await page.getByRole('button', { name: `Approve @${login}` }).click();
  await expect(member.getByText('Active', { exact: true })).toBeVisible();

  await context.clearCookies();
  await page.goto(`/auth/dev?githubUserId=${githubUserId}&login=${login}`);
  await expect(page.getByRole('button', { name: 'Content' })).toBeVisible();
  await expect(page.getByText(`@${login}`)).toBeVisible();
});
