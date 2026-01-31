import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display home page', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Nexus');
    await expect(page.locator('h2')).toContainText('Passwordless Identity at the Edge');
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');
  });
});
