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

test.describe('Dashboard / Notes List', () => {
  test('fresh account shows the empty state with a working CTA', async ({ page, request }) => {
    const email = uniqueEmail('dash-empty');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Empty State User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    await loginViaUi(page, email, PASSWORD);

    await expect(page.getByText('No notes yet')).toBeVisible();
    await page.getByRole('button', { name: 'Create your first note' }).click();
    await expect(page).toHaveURL('/notes/new');
  });

  test('golden path: tag filter, sort, pagination, and trash restore', async ({ page, request }) => {
    const email = uniqueEmail('dash-golden');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Golden Path User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    const loginRes = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = await loginRes.json();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const workTagRes = await request.post('/api/tags', { headers: authHeaders, data: { name: 'Work' } });
    const { tag: workTag } = await workTagRes.json();
    await request.post('/api/tags', { headers: authHeaders, data: { name: 'Personal' } });

    await request.post('/api/notes', {
      headers: authHeaders,
      data: { title: 'Alpha Note', content: '<p>Alpha body</p>', tagIds: [workTag.id] },
    });
    await request.post('/api/notes', { headers: authHeaders, data: { title: 'Beta Note' } });
    await request.post('/api/notes', { headers: authHeaders, data: { title: 'Gamma Note' } });

    // 18 filler notes so the total (21) spans two pages at the default pageSize of 20.
    for (let i = 0; i < 18; i += 1) {
      await request.post('/api/notes', { headers: authHeaders, data: { title: `Filler Note ${i}` } });
    }

    const trashNoteRes = await request.post('/api/notes', { headers: authHeaders, data: { title: 'Trashed Note' } });
    const { note: trashNote } = await trashNoteRes.json();
    await request.delete(`/api/notes/${trashNote.id}`, { headers: authHeaders });

    await loginViaUi(page, email, PASSWORD);

    await expect(page.getByRole('button', { name: /Work/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Personal/ })).toBeVisible();

    await page.getByRole('button', { name: /Work/ }).click();
    await expect(page.getByText('Alpha Note')).toBeVisible();
    await expect(page.getByText('Beta Note')).not.toBeVisible();
    await page.getByRole('button', { name: /Work/ }).click();

    await page.getByRole('button', { name: 'Sort notes' }).click();
    await page.getByText('Title A–Z').click();
    await expect(page.locator('[data-note-card]').first()).toContainText('Alpha Note');

    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();

    await page.getByRole('button', { name: 'Trash' }).click();
    await expect(page.getByText('Trashed Note')).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Trash is empty')).toBeVisible();
  });
});
