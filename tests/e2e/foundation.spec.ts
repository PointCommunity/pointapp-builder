import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'small phone', width: 320, height: 760 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const viewport of viewports) {
  test(`${viewport.name} layout remains usable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('app-preview')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const shortTargets = await page
      .locator('button:visible')
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => button.getBoundingClientRect().height < 44)
          .map((button) => button.textContent),
      );
    expect(shortTargets).toEqual([]);
  });
}

test('role-aware release controls and device previews are interactive', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Releases' }).click();

  await expect(page.getByRole('button', { name: 'Publish to Staging' })).toBeDisabled();
  await page.getByLabel('Foundation role').selectOption('publisher');
  await expect(page.getByRole('button', { name: 'Publish to Staging' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Promote Staging to Production' })).toBeDisabled();

  await page.getByLabel('Foundation role').selectOption('owner');
  await expect(page.getByRole('button', { name: 'Promote Staging to Production' })).toBeEnabled();
  await page.getByRole('button', { name: 'Tablet preview' }).click();
  await expect(page.getByTestId('app-preview')).toHaveAttribute('data-device', 'tablet');
});

test('foundation has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
