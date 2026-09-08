import { expect, test } from '@playwright/test';

test('saved content flows through Staging to exact Production and supports cache revalidation', async ({
  page,
  request,
}) => {
  await page.goto('/auth/dev?githubUserId=1202831&login=brimdor');
  const newDraftName = page.getByLabel('New draft name');
  const draftActions = page.getByText('Draft actions');
  await expect(newDraftName.or(draftActions)).toBeVisible();
  if (await newDraftName.isVisible().catch(() => false)) {
    await page.getByLabel('New draft name').fill(`Release ${Date.now()}`);
    await page.getByRole('button', { name: 'Create first draft' }).click();
  } else {
    await draftActions.click();
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
  await page.getByRole('button', { name: 'Staging', exact: true }).click();
  await expect(page.getByText('Exact PointApp Staging')).toBeVisible();
  await expect(page.getByText(/Previewing signed Staging/)).toBeVisible();
  await page.getByRole('button', { name: 'Promote Staging to Production' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Promote exact Staging candidate?' }),
  ).toContainText(/The envelope will not be rebuilt/);
  await page.getByRole('button', { name: 'Promote exact candidate' }).click();
  await expect(page.getByText('Exact Staging candidate promoted to Production.')).toBeVisible();
  const first = await request.get('/content/v1/channels/production');
  expect(first.status()).toBe(200);
  const firstEnvelope = await first.json();
  expect(firstEnvelope.signing.algorithm).toBe('Ed25519');

  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('button', { name: 'Branding' }).click();
  await page.getByLabel('Tagline').fill(`Second release ${Date.now()}`);
  await page.getByRole('button', { name: 'Save new revision' }).click();
  await expect(page.getByText(/Revision \d+ saved/)).toBeVisible();
  await page.getByRole('button', { name: 'Releases' }).click();
  await page.getByRole('button', { name: 'Validate saved revision' }).click();
  await page.getByRole('button', { name: 'Publish to Staging' }).click();
  await expect(page.getByText('Published to PointApp Staging.')).toBeVisible();
  await page.getByRole('button', { name: 'Promote Staging to Production' }).click();
  await page.getByRole('button', { name: 'Promote exact candidate' }).click();
  await expect(page.getByText('Exact Staging candidate promoted to Production.')).toBeVisible();
  const second = await request.get('/content/v1/channels/production');
  const secondEnvelope = await second.json();
  expect(secondEnvelope.manifestDigest).not.toBe(firstEnvelope.manifestDigest);

  const priorProduction = page
    .locator('.release-history li')
    .filter({ hasText: firstEnvelope.manifestDigest.slice(0, 12) });
  await priorProduction.getByRole('button', { name: 'Rollback here' }).click();
  await expect(page.getByLabel('Rollback reason')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Roll back to signed release' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Roll back Production?' })).toHaveCount(0);
  await priorProduction.getByRole('button', { name: 'Rollback here' }).click();
  await page.getByLabel('Rollback reason').fill('Restore verified first candidate');
  await page.getByRole('button', { name: 'Roll back to signed release' }).click();
  await expect(page.getByText('Production rolled back.')).toBeVisible();

  const rolledBack = await request.get('/content/v1/channels/production');
  const etag = rolledBack.headers().etag;
  expect(etag).toMatch(/^"sha256-/);
  const envelope = await rolledBack.json();
  expect(envelope.manifestDigest).toBe(firstEnvelope.manifestDigest);
  expect(envelope.manifestDigest).toBe(etag.slice(8, -1));
  const cached = await request.get('/content/v1/channels/production', {
    headers: { 'if-none-match': etag },
  });
  expect(cached.status()).toBe(304);
});
