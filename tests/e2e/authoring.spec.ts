import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/auth/dev?githubUserId=1202831&login=brimdor');
  await expect(page.getByText('@brimdor')).toBeVisible();
}
async function newDraft(page: Page, prefix: string) {
  const name = `${prefix} ${Date.now()}`;
  await page.getByLabel('New draft name').fill(name);
  await page.getByRole('button', { name: 'Create first draft' }).click();
  await expect(page.getByText('Draft created.')).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Draft/ })).toHaveValue(/.+/);
  return name;
}
async function isolatedDraft(page: Page, prefix: string) {
  if (
    await page
      .getByLabel('New draft name')
      .isVisible()
      .catch(() => false)
  ) {
    await newDraft(page, prefix);
    return;
  }
  await page.getByText('Draft actions').click();
  await page
    .getByRole('region', { name: 'Draft and revision controls' })
    .getByRole('button', { name: 'Duplicate' })
    .click();
  await expect(page.getByText('Draft created.')).toBeVisible();
}

test('an Owner authors, saves, reloads, duplicates, archives, and recovers a draft', async ({
  page,
}) => {
  await signIn(page);
  await isolatedDraft(page, 'Authoring');
  await page.getByRole('button', { name: 'Branding' }).click();
  const appName = `Point App ${Date.now()}`;
  await page.getByLabel('App name').fill(appName);
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save new revision' }).click();
  await expect(page.getByText(/Revision \d+ saved/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Branding' }).click();
  await expect(page.getByLabel('App name')).toHaveValue(appName);
  await page.getByText('Draft actions').click();
  await page
    .getByRole('region', { name: 'Draft and revision controls' })
    .getByRole('button', { name: 'Duplicate' })
    .click();
  await expect(page.getByText('Draft created.')).toBeVisible();
  const actions = page.getByRole('region', { name: 'Draft and revision controls' });
  const archive = actions.getByRole('button', { name: 'Archive' });
  await actions
    .locator('details')
    .first()
    .evaluate((details: HTMLDetailsElement) => {
      details.open = true;
    });
  await archive.click();
  await expect(actions.locator('option:checked')).toContainText('(archived)');
  const recover = actions.getByRole('button', { name: 'Recover' });
  await actions
    .locator('details')
    .first()
    .evaluate((details: HTMLDetailsElement) => {
      details.open = true;
    });
  await recover.click();
  await expect(actions.locator('option:checked')).not.toContainText('(archived)');
  await actions
    .locator('details')
    .first()
    .evaluate((details: HTMLDetailsElement) => {
      details.open = true;
    });
  await expect(archive).toBeVisible();
});

test('every content panel persists through one immutable revision', async ({ page }) => {
  await signIn(page);
  await isolatedDraft(page, 'Panels');
  await page.getByRole('button', { name: 'Content' }).click();
  await page.getByLabel('Add element').selectOption('scripture');
  await page.getByRole('button', { name: /Add to/ }).click();
  await page.getByRole('button', { name: 'Navigation' }).click();
  await page.getByRole('button', { name: 'Branding' }).click();
  await page.getByLabel('Tagline').fill('A persistent PointApp experience');
  await page.getByRole('button', { name: 'Audience' }).click();
  await page.getByRole('button', { name: 'Add audience' }).click();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await page.getByRole('button', { name: 'New campaign' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Refresh interval (seconds)').fill('120');
  await page.getByRole('button', { name: 'Save new revision' }).click();
  await expect(page.getByText(/Revision \d+ saved/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Branding' }).click();
  await expect(page.getByLabel('Tagline')).toHaveValue('A persistent PointApp experience');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Refresh interval (seconds)')).toHaveValue('120');
});
