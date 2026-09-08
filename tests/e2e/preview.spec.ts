import { expect, test } from '@playwright/test';

test('@experience phone and tablet previews keep navigation and safe bounds usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/auth/dev?githubUserId=1202831&login=brimdor');
  const preview = page.getByTestId('app-preview');
  await expect(preview).toHaveAttribute('data-device', 'phone');
  await preview.getByRole('button', { name: 'Events' }).click();
  await expect(preview.getByRole('button', { name: 'Events' })).toHaveClass(/is-active/);
  await page.getByRole('button', { name: 'Tablet preview' }).click();
  await expect(preview).toHaveAttribute('data-device', 'tablet');
  const bounds = await preview.boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(768);
  await expect(preview.locator('.mobile-tabs')).toBeVisible();
});
