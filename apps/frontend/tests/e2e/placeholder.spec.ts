import { test, expect } from '@playwright/test';

test('app shell loads the login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});
