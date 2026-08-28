import { expect, test } from '@playwright/test';
import { addWebsite, deleteWebsite, loginPage } from './helpers';

test.describe('Website tests', () => {
  test('adds a website and provides its tracking code in settings', async ({ page, request }) => {
    const auth = await loginPage(page, request);
    await page.goto('/websites');
    await page.getByRole('button', { name: 'Add website', exact: true }).click();
    await expect(page.getByRole('dialog').locator('..')).toHaveCSS('position', 'fixed');
    await page.getByTestId('input-name').locator('input').fill('Add test');
    await page.getByTestId('input-domain').locator('input').fill('addtest.com');
    const created = page.waitForResponse(
      r => r.url().endsWith('/api/websites') && r.request().method() === 'POST',
    );
    await page.getByTestId('button-submit').click();
    const website = await (await created).json();
    try {
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Add test', exact: true })).toBeVisible();
      await page.goto(`/websites/${website.id}/settings`);
      await expect(page.locator('textarea').first()).toContainText(`/script.js`);
    } finally {
      await deleteWebsite(request, auth, website.id);
    }
  });

  test('edits a website and persists its settings', async ({ page, request }) => {
    const auth = await loginPage(page, request);
    const website = await addWebsite(request, auth, 'Update test', 'updatetest.com');
    try {
      await page.goto(`/websites/${website.id}/settings`);
      await page.getByTestId('input-name').locator('input').fill('Updated website');
      await page.getByTestId('input-domain').locator('input').fill('updatedwebsite.com');
      const saved = page.waitForResponse(
        r => r.url().endsWith(`/api/websites/${website.id}`) && r.request().method() === 'POST',
      );
      await page.getByTestId('button-submit').click();
      expect((await saved).status()).toBe(200);
      await page.reload();
      await expect(page.getByTestId('input-name').locator('input')).toHaveValue('Updated website');
      await expect(page.getByTestId('input-domain').locator('input')).toHaveValue(
        'updatedwebsite.com',
      );
      await expect(page.locator('textarea').first()).toContainText('/script.js');
    } finally {
      await deleteWebsite(request, auth, website.id);
    }
  });

  test('deletes a website with explicit confirmation', async ({ page, request }) => {
    const auth = await loginPage(page, request);
    const website = await addWebsite(request, auth, 'Delete test', 'deletetest.com');
    await page.goto(`/websites/${website.id}/settings`);
    await page.getByTestId('button-delete').click();
    await page.getByRole('dialog').locator('input').fill('DELETE');
    const deleted = page.waitForResponse(
      r => r.url().endsWith(`/api/websites/${website.id}`) && r.request().method() === 'DELETE',
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    expect((await deleted).status()).toBe(200);
    await expect(page).toHaveURL(/\/websites$/);
    await expect(page.locator(`a[href="/websites/${website.id}"]`)).toHaveCount(0);
  });
});
