import { expect, test } from '@playwright/test';
import { loginPage, logout } from './helpers';

test.describe('User tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, request }) => {
    await loginPage(page, request);
    await page.goto('/admin/users');
  });

  test('adds a user', async ({ page }) => {
    await expect(page.getByText(/Create user/i)).toBeVisible();

    await page.getByTestId('button-create-user').click();
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill('Test-user');
    await page.getByLabel('Password', { exact: true }).fill('testPasswordPlaywright');
    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
    await page.getByTestId('dropdown-item-user').click();
    await page.getByTestId('button-submit').click();

    await expect(
      page
        .getByRole('row')
        .filter({ has: page.getByRole('link', { name: 'test-user', exact: true }) }),
    ).toContainText('User');
  });

  test('edits a user role and password', async ({ page }) => {
    const userRow = page.locator('table tbody tr').filter({
      has: page.locator('td', { hasText: /Test-user/i }),
    });

    await userRow.getByRole('link', { name: 'test-user', exact: true }).click();
    await page.getByLabel('Password', { exact: true }).fill('newPassword');
    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
    await page.getByTestId('dropdown-item-viewOnly').click();
    const saved = page.waitForResponse(
      r => r.url().includes('/api/users/') && r.request().method() === 'POST',
    );
    await page.getByTestId('button-submit').click();
    expect((await saved).status()).toBe(200);

    await page.goto('/admin/users');
    await expect(
      page.locator('table tbody tr').filter({ has: page.locator('td', { hasText: /Test-user/i }) }),
    ).toContainText('View only');

    await logout(page);
    await page.getByTestId('input-username').locator('input').fill('Test-user');
    await page.getByTestId('input-password').locator('input').fill('newPassword');
    await page.getByTestId('button-submit').click();

    await expect(page).toHaveURL(/\/websites$/);
  });

  test('deletes a user', async ({ page }) => {
    const userRow = page.locator('table tbody tr').filter({
      has: page.locator('td', { hasText: /Test-user/i }),
    });

    await userRow.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(/Are you sure you want to delete Test-user?/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(userRow).toHaveCount(0);
  });
});
