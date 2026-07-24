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

test.describe('Note Editor', () => {
  // NOTE: `useAuthStore` (AB-1010) holds tokens in memory only, with no localStorage/cookie
  // persistence. A hard navigation (`page.goto`/`page.reload`) to a protected route therefore
  // always redirects to /login — a pre-existing gap outside AB-1012's scope. These specs
  // exclusively use in-app client-side navigation (button/link clicks), matching the same
  // convention already established in dashboard.spec.ts.
  test('golden path: create, autosave, tag, delete, and undo', async ({ page, request }) => {
    const email = uniqueEmail('editor-golden');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Editor Golden Path User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    await loginViaUi(page, email, PASSWORD);

    await page.getByRole('button', { name: '+ New Note' }).click();
    await expect(page).toHaveURL('/notes/new');

    await page.getByLabel('Note title').fill('My E2E Note');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Hello from the editor golden path.');

    // Autosave debounces 2s; wait for the URL to swap to the created note's id and for the
    // "Saved" indicator, without ever losing focus/content in the editor (plan.md Decision 1).
    await expect(page).toHaveURL(/\/notes\/(?!new$)[\w-]+$/, { timeout: 10_000 });
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.ProseMirror')).toContainText('Hello from the editor golden path.');

    // Confirm the note actually persisted server-side by navigating away and back in (client-side).
    await page.getByRole('button', { name: 'Back to Dashboard' }).click();
    await expect(page).toHaveURL('/');
    await page.getByText('My E2E Note').click();
    await expect(page.getByLabel('Note title')).toHaveValue('My E2E Note');
    await expect(page.locator('.ProseMirror')).toContainText('Hello from the editor golden path.');

    await page.getByRole('button', { name: 'Add tag' }).click();
    await page.getByLabel('Search or create tag').fill('E2E Tag');
    await page.getByText('Create "E2E Tag"').click();
    await expect(page.getByText('E2E Tag')).toBeVisible();

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Move to trash').click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.getByRole('button', { name: 'Move to trash' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Note moved to trash.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Note restored').first()).toBeVisible();
    await expect(page.getByText('My E2E Note')).toBeVisible();
  });
});
