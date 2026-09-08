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
  const newDraftName = page.getByLabel('New draft name');
  const draftActions = page.getByText('Draft actions');
  await expect(newDraftName.or(draftActions)).toBeVisible();
  if (await newDraftName.isVisible().catch(() => false)) {
    await newDraft(page, prefix);
    return;
  }
  await draftActions.click();
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
  const suffix = Date.now().toString().slice(-6);
  const mediaTitle = `Welcome ${suffix}`;
  const audienceName = `Group ${suffix}`;
  const campaignTitle = `Update ${suffix}`;
  const navigationLabel = `Start ${suffix}`;
  await page.getByRole('button', { name: 'Content' }).click();
  await page.getByLabel('Add element').selectOption('scripture');
  await page.getByRole('button', { name: /Add to/ }).click();
  await page.getByRole('button', { name: 'Library' }).click();
  const png = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(16, 16);
  png.writeUInt32BE(16, 20);
  await page.getByLabel('Title').fill(mediaTitle);
  await page.getByLabel('Alt text').fill('People gathering at Point');
  await page.locator('input[type="file"]').setInputFiles({
    name: `welcome-${suffix}.png`,
    mimeType: 'image/png',
    buffer: png,
  });
  await page.getByRole('button', { name: 'Add media' }).click();
  await expect(page.getByText(mediaTitle, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Navigation' }).click();
  await page.getByLabel('Label', { exact: true }).first().fill(navigationLabel);
  await page.getByRole('button', { name: 'Branding' }).click();
  await page.getByLabel('Tagline').fill('A persistent PointApp experience');
  await page.getByRole('button', { name: 'Audience' }).click();
  await page.getByRole('button', { name: 'Add audience' }).click();
  await page.locator('.form-card').last().getByLabel('Name').fill(audienceName);
  await page.getByRole('button', { name: 'Notifications' }).click();
  await page.getByRole('button', { name: 'New campaign' }).click();
  await page.locator('.form-card').last().getByLabel('Title').fill(campaignTitle);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Refresh interval (seconds)').fill('120');
  await page.getByRole('button', { name: 'Save new revision' }).click();
  await expect(page.getByText(/Revision \d+ saved/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Branding' }).click();
  await expect(page.getByLabel('Tagline')).toHaveValue('A persistent PointApp experience');
  await page.getByRole('button', { name: 'Navigation' }).click();
  await expect(page.getByLabel('Label', { exact: true }).first()).toHaveValue(navigationLabel);
  await page.getByRole('button', { name: 'Audience' }).click();
  await expect(page.locator(`input[value="${audienceName}"]`)).toBeVisible();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.locator(`input[value="${campaignTitle}"]`)).toBeVisible();
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByText(mediaTitle, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Refresh interval (seconds)')).toHaveValue('120');
});

test('concurrent work is preserved through an explicit recovery draft', async ({
  page,
  context,
}) => {
  await signIn(page);
  await isolatedDraft(page, 'Conflict');
  const selectedDraftId = await page.getByRole('combobox', { name: /^Draft/ }).inputValue();
  const second = await context.newPage();
  await signIn(second);
  await second.getByRole('combobox', { name: /^Draft/ }).selectOption(selectedDraftId);

  await page.getByRole('button', { name: 'Branding' }).click();
  await page.getByLabel('Tagline').fill(`First editor ${Date.now()}`);
  await page.getByRole('button', { name: 'Save new revision' }).click();
  await expect(page.getByText(/Revision \d+ saved/)).toBeVisible();

  const preservedValue = `Second editor ${Date.now()}`;
  await second.getByRole('button', { name: 'Branding' }).click();
  await second.getByLabel('Tagline').fill(preservedValue);
  await second.getByRole('button', { name: 'Save new revision' }).click();
  await expect(second.getByText('Concurrent edit detected')).toBeVisible();
  await second.getByRole('button', { name: 'Preserve mine as a new draft' }).click();
  await expect(
    second.getByText('Unsaved changes were preserved in a recovered draft.'),
  ).toBeVisible();
  await second.getByRole('button', { name: 'Branding' }).click();
  await expect(second.getByLabel('Tagline')).toHaveValue(preservedValue);
  await second.close();
});
