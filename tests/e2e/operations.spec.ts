import { expect, test } from '@playwright/test';

test('Owner sees safe capacity, health, and audited operations', async ({ page }) => {
  await page.goto('/auth/dev?githubUserId=1202831&login=brimdor');
  await page.getByRole('button', { name: 'Operations' }).click();
  await expect(
    page.getByRole('heading', { name: 'Operations', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(page.getByText('service health')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  await expect(page.locator('.audit-list li').first()).toBeVisible();
  await expect(page.locator('.capacity-grid')).not.toContainText(/secret|token|cookie/i);
});
