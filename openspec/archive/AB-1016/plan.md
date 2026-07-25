# AB-1016 — End-to-End Journey (Playwright): Implementation Plan

## 1. Resolved Decisions (spec Open Questions 1–5, plus one decision surfaced during planning)

| # | Question (from spec.md) | Decision |
| - | ------------------------ | -------- |
| 1 | Ensuring ≥2 version snapshots exist before Scenario 7 | **Confirmed via source, no extra step needed for the drawer to be non-empty — but one extra edit is added anyway for a meaningful restore assertion.** `TagBar`'s `onChange` (`EditorPage.tsx:62-65`) feeds into `draft.tagIds`, which `useAutosave`'s dirty-check (`sameDraft`, `useAutosave.ts:31`) compares against `lastSavedRef` — so Scenario 4's tag assignment *does* trigger a second `PATCH /api/notes/:id`, and BR-008 ("every save creates exactly one version snapshot") means a v2 already exists by Scenario 7. However, v1 and v2 have identical `title`/`content` (only `tagIds` differed, and versions don't snapshot tags), so restoring v1 from v2 would be a no-op from the editor's point of view — not a meaningful assertion. **Decision:** insert one additional explicit content edit after tagging (typing an extra sentence into `.ProseMirror`, waiting for the resulting autosave), so a v3 exists whose content differs from v1. The journey then opens History, restores **v1** (the original, shorter content), and asserts the live editor content reverts to exactly that original text — a real, observable content change, not just a toast. |
| 2 | Test file name and shape | **New `apps/frontend/tests/e2e/journey.spec.ts`**, `test.describe('End-to-End Journey')` containing one long `test('golden path: register through logout across every feature', ...)` covering Scenarios 1–10 in one continuous session, plus three sibling `test()`s in the same file for Scenarios E1–E3 — mirroring the existing four files' internal shape (one golden path + auxiliary tests per `describe` block). `placeholder.spec.ts` is left untouched (out of scope per spec.md §1) — it is trivial pre-existing smoke coverage, not something this ticket needs to remove. |
| 3 | Shared test helpers | **Extract `apps/frontend/tests/e2e/helpers.ts`** exporting `uniqueEmail(prefix: string): string` and `loginViaUi(page, email, password): Promise<void>`, verified byte-for-byte identical across `dashboard.spec.ts`, `editor.spec.ts`, `search.spec.ts`, `share.spec.ts` today. `journey.spec.ts` imports from it, and the four existing files are updated to import from it too (replacing their local copies) rather than adding a 5th duplicate — this is a pure test-infra dedupe (no behavior change, each file's own tests are otherwise untouched) and directly serves CLAUDE.md's "never duplicate" principle once a 5th copy would otherwise exist. |
| 4 | Test database isolation | **No change to the isolation *strategy*.** Continue the existing convention (all four current specs) of isolating via `uniqueEmail(prefix)` per test rather than a DB reset; SDS §30.3's reset-per-suite database strategy is written for the integration-test (Supertest) layer, not this E2E layer, and none of the existing E2E specs alter it. Introducing real per-run DB resets for Playwright would be a cross-cutting infra change outside this ticket's mandate (spec.md §6). **Note (revised during `/implement`, see §8): this decision covered the isolation strategy only. `playwright.config.ts` itself still had to gain a `webServer` block during implementation — the suite could not run at all without it, which is a distinct question from DB-reset-vs-unique-email isolation.** |
| 5 | Restore-from-Trash affordance (Scenario 8) | **Use the Trash-list "Restore" button** (`dashboard.spec.ts`'s pattern: click "Trash" tab → find the note → click "Restore"), not the toast's "Undo" action — this exercises actually navigating into the Trash view per the FRS's literal "verify trash" wording, which the toast-only "Undo" path (used by `editor.spec.ts`) does not. |
| 7 (new — surfaced during planning) | **FRS error-catalogue copy vs. actually-shipped UI copy.** Read `RegisterForm.tsx` and `LoginForm.tsx` directly rather than trusting FRS §14's `User-Facing Message` column verbatim. | The FRS documents "An account with this email already exists." and "Invalid email or password." (with trailing periods) — but the shipped components render **"Email already registered"** (`RegisterForm.tsx:61`, a `role="alert"` banner, not a toast) and **"Invalid email or password"** (`LoginForm.tsx:48`, no trailing period) instead. The FRS's copy was evidently not the final implemented copy (or drifted since). Tests must assert what the UI actually renders, so `journey.spec.ts` and Scenarios E1/E2 use the real strings, not FRS §14's. Also: `RegisterForm.tsx:86` labels the name field **"Full name"**, not "Name". |
| 6 (new — surfaced during planning) | **Step ordering conflict: BR-014 vs. the FRS's literal step 8 → step 9 order.** `notes.service.ts:166-167` confirms soft-delete hard-deletes the note's `ShareLink` row (BR-014, actually implemented, not just documented). The FRS lists step 8 (soft-delete + restore) *before* step 9 (revoke share + verify expired access) — meaning by the time step 9 runs, the share link generated back in step 6 is **already gone**, so there is nothing left to click "Revoke Link" on. | **Regenerate a fresh share link immediately after the Scenario 8 trash-restore, then have Scenario 9 revoke *that* link.** This also gets a free, incidental assertion of BR-014 itself: right after restoring from Trash, the journey reopens the Share dialog and asserts it shows "No active share link for this note." (proving the *original* link from Scenario 6 was auto-revoked by the soft-delete) *before* generating the new one that Scenario 9 then revokes. This supersedes spec.md §6's note that BR-014 "is not exercised" — it now is, as a side effect of making the literal FRS ordering actually work. |

## 2. Architecture Overview

Planned as a test-only ticket with no production code changes — **this held for everything planned below, but not for the ticket's final scope; see §8 for the production/config changes made during `/implement`.** Structure of the new/changed test files:

```
apps/frontend/tests/e2e/
├── helpers.ts                    NEW — uniqueEmail(), loginViaUi()
├── journey.spec.ts               NEW — the full journey + 3 error scenarios
├── dashboard.spec.ts             MODIFIED — import helpers from './helpers' instead of local copies
├── editor.spec.ts                MODIFIED — same
├── search.spec.ts                MODIFIED — same
├── share.spec.ts                 MODIFIED — same
└── placeholder.spec.ts           unchanged
```

`journey.spec.ts` internal flow (one `test()` for the golden path):

```
register (Scenario 1) → assert redirect to /login
loginViaUi (Scenario 2) → assert redirect to /
+ New Note → title + ProseMirror content → assert autosave (URL swap, "Saved ✓")      [Scenario 3, v1 created]
Add tag → create "Journey Tag" → assert chip                                          [Scenario 4, v2 created]
Type additional content into ProseMirror → assert "Saved ✓" again                     [Decision 1, v3 created]
Ctrl+K → search distinctive term → assert /search?q=... + <mark> highlight            [Scenario 5]
  → click result → back to /notes/:id
More actions → Share → Generate Link → Copy Link → assert "Copied! ✓"                 [Scenario 6]
  → open shareUrl in fresh unauthenticated context → assert public read-only view
More actions → History → assert version list (newest-first) → select v1
  → assert yellow "Viewing version 1 from ..." banner → Restore this version
  → assert toast "Version 1 restored." → assert live editor content reverted          [Scenario 7]
More actions → Move to trash → confirm → assert toast + Trash tab shows the note
  → click Trash tab → click Restore → assert note back in main list                  [Scenario 8]
More actions → Share → assert "No active share link for this note." (BR-014 check)
  → Generate Link (new link) → assert new shareUrl                                    [Decision 6]
Revoke Link → Yes, revoke → assert "No active share link for this note."
  → open the new shareUrl in a fresh context → assert "Note not found"                [Scenario 9]
User menu → Sign out → assert redirect to /login                                      [Scenario 10]
```

Three additional `test()`s in the same file for E1 (duplicate email), E2 (invalid login), E3 (revoked share link, asserted independently of the golden path's own revoke check for a standalone, directly-runnable regression test).

## 3. Files to Create

| File | Purpose |
| ---- | ------- |
| `apps/frontend/tests/e2e/helpers.ts` | `export function uniqueEmail(prefix: string): string` and `export async function loginViaUi(page: Page, email: string, password: string): Promise<void>` — verbatim extraction of the identical implementations already in all four existing spec files. |
| `apps/frontend/tests/e2e/journey.spec.ts` | The full journey test + 3 error-scenario tests, per Section 2. |

No `packages/shared`, `apps/backend`, or any `apps/frontend/src` changes — this ticket touches only `apps/frontend/tests/e2e/`.

## 4. Files to Modify

| File | Change |
| ---- | ------ |
| `apps/frontend/tests/e2e/dashboard.spec.ts` | Remove the local `uniqueEmail`/`loginViaUi` definitions; add `import { uniqueEmail, loginViaUi } from './helpers';`. No test logic changes. |
| `apps/frontend/tests/e2e/editor.spec.ts` | Same. |
| `apps/frontend/tests/e2e/search.spec.ts` | Same. |
| `apps/frontend/tests/e2e/share.spec.ts` | Same. |

## 5. Test File Skeleton (`journey.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { uniqueEmail, loginViaUi } from './helpers';

const PASSWORD = 'E2ePass!234';

test.describe('End-to-End Journey', () => {
  test('golden path: register through logout across every feature', async ({ page, context, browser }) => {
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

    // 3. Create note, verify autosave
    await page.getByRole('button', { name: '+ New Note' }).click();
    await expect(page).toHaveURL('/notes/new');
    await page.getByLabel('Note title').fill('Journey Note');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Original content about quarterly roadmap planning.');
    await expect(page).toHaveURL(/\/notes\/(?!new$)[\w-]+$/, { timeout: 10_000 });
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

    // 4. Tag the note
    await page.getByRole('button', { name: 'Add tag' }).click();
    await page.getByLabel('Search or create tag').fill('Journey Tag');
    await page.getByText('Create "Journey Tag"').click();
    await expect(page.getByText('Journey Tag')).toBeVisible();
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

    // Decision 1: one more edit so an older version has genuinely different content to restore.
    await page.locator('.ProseMirror').click();
    await page.keyboard.type(' Updated with extra detail after tagging.');
    await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

    // 5. Search for the note
    await page.keyboard.press('Control+k');
    await page.getByLabel('Search notes').fill('roadmap');
    await expect(page).toHaveURL(/\/search\?q=roadmap$/, { timeout: 5_000 });
    await expect(page.getByText('Journey Note')).toBeVisible();
    await expect(page.locator('mark', { hasText: 'roadmap' }).first()).toBeVisible();
    await page.getByText('Journey Note').click();
    await expect(page).toHaveURL(/\/notes\/[\w-]+$/);

    // 6. Share, copy, public view
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Share').click();
    await page.getByRole('button', { name: 'Generate Link' }).click();
    const firstShareUrl = await page.getByLabel('Share link').inputValue();
    await page.getByRole('button', { name: 'Copy Link' }).click();
    await expect(page.getByRole('button', { name: 'Copied! ✓' })).toBeVisible();

    const publicContext1 = await browser.newContext();
    const publicPage1 = await publicContext1.newPage();
    await publicPage1.goto(firstShareUrl);
    await expect(publicPage1.getByRole('heading', { name: 'Journey Note' })).toBeVisible();
    await publicContext1.close();
    await page.keyboard.press('Escape');

    // 7. Version history: view list, restore an older version
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('History').click();
    await expect(page.getByRole('dialog', { name: 'Version history' })).toBeVisible();
    await page.getByRole('button', { name: 'Version 1' }).click();
    await expect(page.getByText(/Viewing version \d+ from/)).toBeVisible();
    await page.getByRole('button', { name: 'Restore this version' }).click();
    await expect(page.getByText(/Version \d+ restored\./)).toBeVisible();
    await expect(page.locator('.ProseMirror')).not.toContainText('Updated with extra detail');

    // 8. Soft-delete, verify trash, restore
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Move to trash').click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Note moved to trash.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Trash' }).click();
    await expect(page.getByText('Journey Note')).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Trash is empty')).toBeVisible();

    // 9. Revoke share (BR-014 already killed the first link on soft-delete; regenerate, then revoke)
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

    // 10. Logout
    await page.keyboard.press('Escape');
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

  test('E3: a revoked share link is inaccessible', async ({ page, request, browser }) => {
    const email = uniqueEmail('journey-revoked');
    const registerRes = await request.post('/api/auth/register', {
      data: { name: 'Revoked Link User', email, password: PASSWORD },
    });
    expect(registerRes.ok()).toBeTruthy();

    const loginRes = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
    const { accessToken } = await loginRes.json();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const noteRes = await request.post('/api/notes', { headers: authHeaders, data: { title: 'Revoke Me' } });
    const { note } = await noteRes.json();
    const shareRes = await request.post(`/api/notes/${note.id}/share`, { headers: authHeaders, data: {} });
    const { share } = await shareRes.json();
    await request.delete(`/api/notes/${note.id}/share`, { headers: authHeaders });

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/shared/${share.token}`);
    await expect(publicPage.getByText('Note not found')).toBeVisible();
    await publicContext.close();
  });
});
```

**Selectors below were confirmed by reading the actual source, not assumed from FRS/UX prose** — this closed three gaps no existing E2E spec covers (registration-through-UI, the version drawer, and logout), and surfaced two places where the FRS's documented copy has drifted from what's actually shipped:
- `RegisterForm.tsx`: field labels are `'Full name'` (not "Name"), `'Email'`, `'Password'`; submit button is `'Create account'`. On success it toasts "Account created! Please sign in." and navigates to `/login` (matches Scenario 1). On `EMAIL_ALREADY_EXISTS` it renders a `role="alert"` banner reading **`'Email already registered'`** — not FRS §14.1's "An account with this email already exists." — Scenario E1 asserts the real string.
- `LoginForm.tsx`: on `INVALID_CREDENTIALS` it renders **`'Invalid email or password'`** (no trailing period) — not FRS §14.1's "Invalid email or password." — Scenario E2 asserts the real string.
- `VersionHistoryDrawer.tsx` + `components/ui/drawer.tsx`: the drawer is `DialogPrimitive.Content asChild` wrapping a real `<aside>` — Radix's `Content` always sets `role="dialog"`/`aria-modal`, and `asChild`'s `Slot` merges those onto the child, so the *explicit* `role="dialog"` wins over the `<aside>` tag's implicit `complementary` role. The correct selector is `getByRole('dialog', { name: 'Version history' })`, matching the same pattern `share.spec.ts` already uses for `ShareModal`'s dialog — not `getByRole('complementary', ...)`.
- `VersionItem.tsx`: each row is a `<button>` whose accessible name concatenates `"Version {N}"` + the formatted date + the content preview — `getByRole('button', { name: 'Version 1' })` substring-matches reliably without depending on preview-text truncation.
- `UserMenu.tsx`: trigger is `<Button aria-label="User menu">{user.name}</Button>`; the menu item is literally `'Sign out'` — both confirmed exact.

## 6. Checkpoints (run after implementation, before commit)

```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test:e2e
```

Then the full monorepo gate before commit, per root `CLAUDE.md`:

```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

`pnpm test:e2e` (root) delegates to the frontend's Playwright suite (SDS §37.2) — this is the actual acceptance-criteria command (FRS AB-1016 AC-1: "`pnpm test:e2e` passes the entire journey").

## 7. Out-of-Scope Reminders Carried Forward from spec.md

- No new UI, API, or Prisma schema changes.
- No re-testing of feature internals already covered by the four existing per-feature spec files (pagination, sort, focus trap, responsive layout, drawer animation timing).
- Password reset / OTP flow (FR-PWD-\*) — not part of the FRS-specified 10-step journey.
- Cross-browser coverage (Firefox/WebKit) — unchanged, chromium-only per `playwright.config.ts`.
- No changes to test-database *strategy* or CI wiring (Decision 4). **`playwright.config.ts` itself was, in fact, changed during `/implement` — see §8.**

---

Not proceeding to implementation — awaiting approval.

## 8. Post-Implementation Amendment (scope changes found during `/implement`)

Implementation surfaced gaps this plan did not anticipate, all logged with full rationale in `tasks.md`'s "Deviations from plan.md" section. Summarized here so this plan reflects the ticket's actual final scope rather than only its pre-implementation intent:

1. **`apps/frontend/playwright.config.ts` gained a `webServer` block.** It had none at all — `pnpm test:e2e` couldn't boot the app and every spec failed with `ECONNREFUSED`. Added the block already documented in SDS §37.10 (boots `dev:backend`/`dev:frontend`, `workers: 1`, `reuseExistingServer` outside CI). This is additive/config-only (closing a pre-existing SDS-vs-code gap), not a change to the DB-isolation strategy decided in Decision 4 above. Verified working: `pnpm test:e2e` passes 11/11 (2.7m) as of this amendment.
2. **Root `package.json` gained a `test:e2e` script.** Never existed at the root despite FRS AC-1 naming it as the acceptance command; added as a one-line alias to the frontend's existing script. No new dependency, no lockfile change.
3. **One production bugfix: `apps/frontend/src/features/notes/notes.hooks.ts`.** `useDeleteNoteMutation` didn't invalidate `['shares','list']`, leaving `ShareModal` showing a stale share-link state after trash/restore. Found only because the journey test re-opens Share after trash+restore. Fixed with a corresponding unit-test assertion added to `notes.hooks.test.tsx`.
4. **`apps/backend/src/middleware/rate-limiter.ts` was changed, with explicit user sign-off before proceeding** (flagged as security-relevant rather than decided unilaterally). The full E2E suite's request volume trips the global 100-req/min-per-IP limit within a single run; the strict limit is now gated to `NODE_ENV === 'production'` only, with dev/test raised to 10,000/min — mirroring the existing environment-conditional pattern already used for `BCRYPT_ROUNDS`. No effect on production traffic.

Section 3 (Files to Create) and Section 4 (Files to Modify) above are unchanged and complete for the *test* files. This amendment covers the additional non-test files needed to make those tests actually runnable and correct — it does not add, remove, or change any of the 10 golden-path scenarios or 3 error scenarios.
