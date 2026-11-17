import { expect, test } from '@playwright/test';
import { loginPage, logout, umamiUser } from './helpers';

test.describe('Login tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('logs user in with correct credentials and logs user out', async ({ page }) => {
    await page.getByTestId('input-username').locator('input').fill(umamiUser.username);
    await page.getByTestId('input-password').locator('input').fill(umamiUser.password);
    await page.getByTestId('button-submit').click();

    await expect(page).toHaveURL(/\/websites$/);

    await logout(page);
  });

  test('shows validation for blank inputs or incorrect credentials', async ({ page }) => {
    await page.getByTestId('button-submit').click();
    await expect(
      page.getByTestId('input-username').getByText('Required', { exact: true }),
    ).toBeVisible();

    await page.getByTestId('input-username').locator('input').fill(umamiUser.username);
    await page.getByTestId('input-password').locator('input').fill('wrongpassword');
    await page.getByTestId('button-submit').click();

    await expect(page.getByText(/Incorrect username and\/or password./i)).toBeVisible();
  });

  test('clears the local login even when the logout endpoint fails', async ({ page, request }) => {
    const { token } = await loginPage(page, request);
    let sentAuthenticated = false;
    await page.route('**/api/auth/logout', route => {
      sentAuthenticated = route.request().headers().authorization === `Bearer ${token}`;
      return route.fulfill({ status: 503, json: { error: { message: 'Service unavailable' } } });
    });

    await page.goto('/logout');

    await expect(page).toHaveURL(/\/login$/);
    expect(sentAuthenticated).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('umami.auth'))).toBeNull();
  });
});
