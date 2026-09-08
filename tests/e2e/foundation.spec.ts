import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, githubUserId = '1202831', login = 'brimdor') {
  await page.goto(`/auth/dev?githubUserId=${githubUserId}&login=${login}`);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

const viewports = [
  { name: 'small phone', width: 320, height: 760 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const viewport of viewports) {
  test(`${viewport.name} authenticated layout remains usable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signIn(page);

    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('app-preview')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('signed-out visitors see login and no protected Builder panels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /sign in with github/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Content' })).toHaveCount(0);
});

test('new users are Pending Editors until Owner approval', async ({ page, context }) => {
  const suffix = Date.now().toString();
  const githubUserId = `90${suffix.slice(-11)}`;
  const login = `new-${suffix.slice(-12)}`;

  await page.goto(`/auth/dev?githubUserId=${githubUserId}&login=${login}`);
  await expect(page.getByRole('heading', { name: /access request pending/i })).toBeVisible();
  await expect(page.getByText(`Signed in as @${login}`)).toBeVisible();

  await context.clearCookies();
  await signIn(page);
  await page.getByRole('button', { name: 'Access' }).click();
  const member = page.locator('.membership-list > li').filter({ hasText: `@${login}` });
  await expect(member.getByText(`@${login}`, { exact: true })).toBeVisible();
  await expect(member.getByText('Pending', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Approve @${login}` }).click();
  await expect(member.getByText('Active', { exact: true })).toBeVisible();
});

test('actual Owner role controls release affordances with no role dropdown', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Releases' }).click();
  await expect(page.getByRole('button', { name: 'Publish to Staging' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Promote Staging to Production' })).toBeVisible();
  await expect(page.getByLabel('Foundation role')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tablet preview' }).click();
  await expect(page.getByTestId('app-preview')).toHaveAttribute('data-device', 'tablet');
});

test('authenticated shell has no automatically detectable accessibility violations', async ({
  page,
}) => {
  await signIn(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
