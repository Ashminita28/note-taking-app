import { test, expect } from '@playwright/test';
import { uniqueEmail, loginViaUi } from './helpers';

const PASSWORD = 'E2ePass!234';

test.describe('Sharing', () => {
  test('golden path: generate, copy, view publicly unauthenticated, then revoke (UX §7.8)', async ({
    page,
    request,
    browser,
  }) => {
    const email = uniqueEmail('share-golden');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Share Golden Path User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    await loginViaUi(page, email, PASSWORD);
    // Headless Chromium blocks the Clipboard API without an explicit grant.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByRole('button', { name: '+ New Note' }).click();
    await expect(page).toHaveURL('/notes/new');
    await page.getByLabel('Note title').fill('Shareable Note');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Content visible to anyone with the link.');
    await expect(page).toHaveURL(/\/notes\/(?!new$)[\w-]+$/, { timeout: 10_000 });
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Share').click();
    await expect(page.getByRole('dialog', { name: 'Share note' })).toBeVisible();

    await page.getByRole('button', { name: 'Generate Link' }).click();
    const shareUrlInput = page.getByLabel('Share link');
    await expect(shareUrlInput).toBeVisible();
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toContain('/shared/');

    await page.getByRole('button', { name: 'Copy Link' }).click();
    await expect(page.getByRole('button', { name: 'Copied! ✓' })).toBeVisible();

    // Fresh, unauthenticated browser context — confirms the public view needs no session.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(shareUrl);
    await expect(publicPage.getByRole('heading', { name: 'Shareable Note' })).toBeVisible();
    await expect(publicPage.getByText('Content visible to anyone with the link.')).toBeVisible();
    // TipTap always renders a `.ProseMirror` div (editable or not) — read-only is confirmed via `contenteditable="false"`, not absence of the class.
    await expect(publicPage.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
    await expect(publicPage.getByRole('button', { name: 'More actions' })).toHaveCount(0);
    await publicContext.close();

    await page.getByRole('button', { name: 'Revoke Link' }).click();
    await page.getByRole('button', { name: 'Yes, revoke' }).click();
    await expect(page.getByText('No active share link for this note.')).toBeVisible();

    const revokedContext = await browser.newContext();
    const revokedPage = await revokedContext.newPage();
    await revokedPage.goto(shareUrl);
    await expect(revokedPage.getByText('Note not found')).toBeVisible();
    await revokedContext.close();
  });
});
