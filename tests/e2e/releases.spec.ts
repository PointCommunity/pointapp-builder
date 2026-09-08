import { expect, test } from '@playwright/test';

test('saved content flows through Staging to exact Production and supports cache revalidation', async ({
  page,
  request,
}) => {
  await page.goto('/auth/dev?githubUserId=1202831&login=brimdor');
  if (
    await page
      .getByLabel('New draft name')
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByLabel('New draft name').fill(`Release ${Date.now()}`);
    await page.getByRole('button', { name: 'Create first draft' }).click();
  } else {
    await page.getByText('Draft actions').click();
    await page
      .getByRole('region', { name: 'Draft and revision controls' })
      .getByRole('button', { name: 'Duplicate' })
      .click();
    await expect(page.getByText('Draft created.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Branding' }).click();
  await page.getByLabel('Tagline').fill(`Release candidate ${Date.now()}`);
  await page.getByRole('button', { name: 'Save new revision' }).click();
  await expect(page.getByText(/Revision \d+ saved/)).toBeVisible();
  await page.getByRole('button', { name: 'Releases' }).click();
  await page.getByRole('button', { name: 'Validate saved revision' }).click();
  await expect(page.getByText('Ready to publish')).toBeVisible();
  await page.getByRole('button', { name: 'Publish to Staging' }).click();
  await expect(page.getByText('Published to PointApp Staging.')).toBeVisible();
  await page.getByRole('button', { name: 'Promote Staging to Production' }).click();
  await expect(page.getByText('Exact Staging candidate promoted to Production.')).toBeVisible();
  const first = await request.get('/content/v1/channels/production');
  expect(first.status()).toBe(200);
  const etag = first.headers().etag;
  expect(etag).toMatch(/^"sha256-/);
  const cached = await request.get('/content/v1/channels/production', {
    headers: { 'if-none-match': etag },
  });
  expect(cached.status()).toBe(304);
  const envelope = await first.json();
  expect(envelope.manifestDigest).toBe(etag.slice(8, -1));
  expect(envelope.signing.algorithm).toBe('Ed25519');
});
