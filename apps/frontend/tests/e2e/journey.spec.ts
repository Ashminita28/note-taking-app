import { test, expect } from '@playwright/test';
import { uniqueEmail, loginViaUi } from './helpers';

const PASSWORD = 'E2ePass!234';

test.describe('End-to-End Journey', () => {
  test('golden path: register through logout across every feature', async ({ page, context, browser }) => {
    // A single continuous 10-step journey (three ~2s autosave debounces plus register, login,
    // search, share, version-history, trash, and logout round trips) comfortably exceeds
    // Playwright's default 30s per-test timeout — this is the one test in the suite long enough
    // to need its own budget, so it's raised here rather than for every test in the config.
    test.setTimeout(90_000);

    const name = 'Journey User';
    const email = uniqueEmail('journey');

    // 1. Register -> redirect to /login
    await page.goto('/register');
    await page.getByLabel('Full name').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/login');

    // 2. Login -> redirect to dashboard
    await loginViaUi(page, email, PASSWORD);

    // 3. Create a note with title and rich-text content, verify autosave
    await page.getByRole('button', { name: '+ New Note' }).click();
    await expect(page).toHaveURL('/notes/new');
    await page.getByLabel('Note title').fill('Journey Note');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Original content about quarterly roadmap planning.');
    await expect(page).toHaveURL(/\/notes\/(?!new$)[\w-]+$/, { timeout: 10_000 });
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

    // 4. Create a tag and assign it to the note, verify the tag chip appears
    await page.getByRole('button', { name: 'Add tag' }).click();
    await page.getByLabel('Search or create tag').fill('Journey Tag');
    await page.getByText('Create "Journey Tag"').click();
    await expect(page.getByText('Journey Tag')).toBeVisible();
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

    // One more edit so an older version has genuinely different content to restore to later.
    await page.locator('.ProseMirror').click();
    await page.keyboard.type(' Updated with extra detail after tagging.');
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

    // 5. Search for the note, verify highlighted results.
    // `SearchBar` (and its global Ctrl+K listener) only mounts in `DashboardHeader` (Dashboard /
    // Search pages) — not on the note editor page, where Ctrl+K is instead NoteEditor's own
    // "insert link" shortcut. Navigate back to the Dashboard first.
    await page.getByRole('button', { name: 'Back to Dashboard' }).click();
    await expect(page).toHaveURL('/');
    await page.keyboard.press('Control+k');
    await page.getByLabel('Search notes').fill('roadmap');
    await expect(page).toHaveURL(/\/search\?q=roadmap$/, { timeout: 5_000 });
    await expect(page.getByText('Journey Note')).toBeVisible();
    await expect(page.locator('mark', { hasText: 'roadmap' }).first()).toBeVisible();
    await page.getByText('Journey Note').click();
    await expect(page).toHaveURL(/\/notes\/[\w-]+$/);

    // 6. Generate a share link, verify copy; open the shared URL, verify the public view
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Share').click();
    await expect(page.getByRole('dialog', { name: 'Share note' })).toBeVisible();
    await page.getByRole('button', { name: 'Generate Link' }).click();
    const firstShareUrl = await page.getByLabel('Share link').inputValue();
    expect(firstShareUrl).toContain('/shared/');
    await page.getByRole('button', { name: 'Copy Link' }).click();
    await expect(page.getByRole('button', { name: 'Copied! ✓' })).toBeVisible();

    const publicContext1 = await browser.newContext();
    const publicPage1 = await publicContext1.newPage();
    await publicPage1.goto(firstShareUrl);
    await expect(publicPage1.getByRole('heading', { name: 'Journey Note' })).toBeVisible();
    await publicContext1.close();
    await page.keyboard.press('Escape');

    // 7. View version history, verify version list; restore a version, verify content reverts
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('History').click();
    await expect(page.getByRole('dialog', { name: 'Version history' })).toBeVisible();
    await page.getByRole('button', { name: 'Version 1' }).click();
    await expect(page.getByText(/Viewing version \d+ from/)).toBeVisible();
    await page.getByRole('button', { name: 'Restore this version' }).click();
    await expect(page.getByText(/Version \d+ restored\./).first()).toBeVisible();
    await expect(page.locator('.ProseMirror')).not.toContainText('Updated with extra detail');
    await expect(page.locator('.ProseMirror')).toContainText('Original content about quarterly roadmap planning.');

    // 8. Soft-delete the note, verify trash. Restore from trash.
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Move to trash').click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Note moved to trash.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Trash' }).click();
    await expect(page.getByText('Journey Note')).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Trash is empty')).toBeVisible();

    // 9. Revoke share link, verify expired access.
    // BR-014: soft-deleting the note already auto-revoked the first share link — confirm that,
    // then generate a fresh link so there is something real for this step to revoke.
    // `TrashToggle` is the same button flipping label ("Trash" <-> "Back to notes") — switch back
    // to the main notes list, where the restored note now lives, before looking for it.
    await page.getByRole('button', { name: 'Back to notes' }).click();
    await page.getByText('Journey Note').click();
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Share').click();
    await expect(page.getByText('No active share link for this note.')).toBeVisible();
    await page.getByRole('button', { name: 'Generate Link' }).click();
    const secondShareUrl = await page.getByLabel('Share link').inputValue();
    expect(secondShareUrl).not.toBe(firstShareUrl);

    await page.getByRole('button', { name: 'Revoke Link' }).click();
    await page.getByRole('button', { name: 'Yes, revoke' }).click();
    await expect(page.getByText('No active share link for this note.')).toBeVisible();

    const publicContext2 = await browser.newContext();
    const publicPage2 = await publicContext2.newPage();
    await publicPage2.goto(secondShareUrl);
    await expect(publicPage2.getByText('Note not found')).toBeVisible();
    await publicContext2.close();

    // 10. Logout, verify redirect to login.
    // `UserMenu` (and its "Sign out" action) only renders in `DashboardHeader`, not on the note
    // editor page, so navigate back to the Dashboard before logging out.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to Dashboard' }).click();
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: 'User menu' }).click();
    await page.getByText('Sign out').click();
    await expect(page).toHaveURL('/login');
  });

  test('E1: duplicate email registration is rejected', async ({ page, request }) => {
    const email = uniqueEmail('journey-dup');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Dup User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    await page.goto('/register');
    await page.getByLabel('Full name').fill('Dup User Two');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Email already registered')).toBeVisible();
    await expect(page).toHaveURL('/register');
  });

  test('E2: invalid login credentials are rejected', async ({ page, request }) => {
    const email = uniqueEmail('journey-badlogin');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Bad Login User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('WrongPass!234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('E3: a revoked share link is inaccessible', async ({ request, browser }) => {
    const email = uniqueEmail('journey-revoked');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Revoked Link User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    const loginRes = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = await loginRes.json();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const noteRes = await request.post('/api/notes', { headers: authHeaders, data: { title: 'Revoke Me' } });
    const { note } = await noteRes.json();
    const shareRes = await request.post(`/api/notes/${note.id}/share`, { headers: authHeaders, data: {} });
    const { shareLink } = await shareRes.json();
    await request.delete(`/api/notes/${note.id}/share`, { headers: authHeaders });

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/shared/${shareLink.token}`);
    await expect(publicPage.getByText('Note not found')).toBeVisible();
    await publicContext.close();
  });
});
