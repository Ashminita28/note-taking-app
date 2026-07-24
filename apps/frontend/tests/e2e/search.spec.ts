import { test, expect } from '@playwright/test';

const PASSWORD = 'E2ePass!234';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function loginViaUi(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Search', () => {
  test('golden path: Ctrl+K, debounced search, highlighted results, and Escape', async ({ page, request }) => {
    const email = uniqueEmail('search-golden');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Search Golden Path User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    const loginRes = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = await loginRes.json();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    await request.post('/api/notes', {
      headers: authHeaders,
      data: { title: 'Weekly Standup Notes', content: '<p>Discussed the quarterly budget review.</p>' },
    });
    await request.post('/api/notes', { headers: authHeaders, data: { title: 'Grocery List' } });

    await loginViaUi(page, email, PASSWORD);

    await page.keyboard.press('Control+k');
    await expect(page.getByLabel('Search notes')).toBeFocused();
    await page.getByLabel('Search notes').fill('budget');

    await expect(page).toHaveURL(/\/search\?q=budget$/, { timeout: 5_000 });
    await expect(page.getByText('Weekly Standup Notes')).toBeVisible();
    await expect(page.locator('mark', { hasText: 'budget' }).first()).toBeVisible();
    await expect(page.getByText('Grocery List')).not.toBeVisible();

    await page.getByText('Weekly Standup Notes').click();
    await expect(page).toHaveURL(/\/notes\/[\w-]+$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/search\?q=budget$/);

    await page.getByLabel('Search notes').press('Escape');
    await expect(page).toHaveURL('/');
    await expect(page.getByLabel('Search notes')).toHaveValue('');
  });

  test('no results shows the empty state', async ({ page, request }) => {
    const email = uniqueEmail('search-empty');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Search Empty State User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    await loginViaUi(page, email, PASSWORD);

    await page.keyboard.press('Control+k');
    await page.getByLabel('Search notes').fill('nonexistentterm12345');

    await expect(page.getByText('No notes found for "nonexistentterm12345"')).toBeVisible({ timeout: 5_000 });
  });
});
