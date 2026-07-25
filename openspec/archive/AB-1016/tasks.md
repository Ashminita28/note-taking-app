# AB-1016 — End-to-End Journey (Playwright): Task Checklist

Source: `openspec/tickets/AB-1016/spec.md`, `openspec/tickets/AB-1016/plan.md`.
This is a test-only ticket — no shared types, no DB migrations, no production code. "Foundation" below
is the shared E2E test-helper module (currently duplicated 4x) rather than shared types/migrations, and
"Core Implementation" is the golden-path journey test itself rather than an API/data layer.

**Status: COMPLETE.** All phases done, all checkpoints green. Three real bugs and two missing
pieces of test infrastructure were found and fixed along the way — see "Deviations from plan" below.

---

## Phase 1 — Foundation (shared E2E test helpers)

- [x] 1.1 Create `apps/frontend/tests/e2e/helpers.ts` exporting `uniqueEmail(prefix: string): string` and `async function loginViaUi(page: Page, email: string, password: string): Promise<void>` — verbatim extraction of the identical implementations currently duplicated in `dashboard.spec.ts`, `editor.spec.ts`, `search.spec.ts`, `share.spec.ts` (plan §1 Decision 3).
- [x] 1.2 Modify `apps/frontend/tests/e2e/dashboard.spec.ts` — remove the local `uniqueEmail`/`loginViaUi` definitions, import both from `./helpers`. No test-body changes.
- [x] 1.3 Modify `apps/frontend/tests/e2e/editor.spec.ts` — same.
- [x] 1.4 Modify `apps/frontend/tests/e2e/search.spec.ts` — same.
- [x] 1.5 Modify `apps/frontend/tests/e2e/share.spec.ts` — same.

**Checkpoint 1: PASSED** — `pnpm --filter @note-app/frontend build` / `lint --max-warnings 0` clean; all four pre-existing specs still pass unmodified after the helper extraction.

---

## Phase 2 — Core Implementation (golden-path journey test)

- [x] 2.1 Create `apps/frontend/tests/e2e/journey.spec.ts` with `test.describe('End-to-End Journey')` and import `uniqueEmail`/`loginViaUi` from `./helpers`.
- [x] 2.2 Scenario 1–2: register via the UI → assert redirect to `/login`; `loginViaUi` → assert redirect to `/`.
- [x] 2.3 Scenario 3: `'+ New Note'` → fill `'Note title'` → type into `.ProseMirror` → assert URL swaps off `/notes/new` and `'Saved ✓'` appears (v1 created).
- [x] 2.4 Scenario 4: `'Add tag'` → create `"Journey Tag"` → assert chip appears → assert `'Saved ✓'` again (v2 created).
- [x] 2.5 Follow-up edit: type additional content into `.ProseMirror` → assert `'Saved ✓'` again (v3 created, so v1 is genuinely different from current content).
- [x] 2.6 Scenario 5: navigate back to the Dashboard first (see Deviation below), `Ctrl+K` → search a distinctive term → assert `/search?q=...`, the note result, and a `<mark>` highlight → click into the note.
- [x] 2.7 Scenario 6: grant clipboard permissions → `'More actions'` → `'Share'` → `'Generate Link'` → capture the URL → `'Copy Link'` → assert `'Copied! ✓'` → open the URL in a fresh unauthenticated context → assert the public read-only view.
- [x] 2.8 Scenario 7: `'More actions'` → `'History'` → assert `getByRole('dialog', { name: 'Version history' })` → click `'Version 1'` → assert the yellow banner → `'Restore this version'` → assert the restored toast (`.first()`, see Deviation) → assert the live editor content reverted to v1's text.
- [x] 2.9 Scenario 8: `'More actions'` → `'Move to trash'` → confirm → assert toast + redirect → `'Trash'` tab → assert listed → `'Restore'` → `'Back to notes'` (see Deviation) → assert it's back in the main list.
- [x] 2.10 BR-014 check + Scenario 9: reopen the note → `'Share'` → assert `'No active share link for this note.'` (proves BR-014's auto-revoke fired) → `'Generate Link'` (fresh link) → `'Revoke Link'` → `'Yes, revoke'` → assert empty state again → open the fresh link unauthenticated → assert `'Note not found'`.
- [x] 2.11 Scenario 10: navigate `'Back to Dashboard'` first (see Deviation), `'User menu'` → `'Sign out'` → assert redirect to `/login`.

**Checkpoint 2: PASSED** (after fixes below) — `journey.spec.ts` run in isolation, repeatedly, all green.

---

## Phase 3 — Integration (required error scenarios)

- [x] 3.1 Scenario E1 — duplicate email registration; assert the real shipped banner text `'Email already registered'` (not FRS §14.1's documented string — see Deviation) and URL stays on `/register`.
- [x] 3.2 Scenario E2 — wrong password; assert real shipped text `'Invalid email or password'` (no trailing period) and URL stays on `/login`.
- [x] 3.3 Scenario E3 — seed note + share link via API, revoke via API, load the dead link unauthenticated; assert `'Note not found'`. Independent test, not just inline in Scenario 9.
- [x] Manual smoke-equivalent: the automated `journey.spec.ts` golden path IS a real-browser run against real dev servers (webServer-booted `pnpm dev:backend`/`dev:frontend`) exercising the exact click-through described in the task — run repeatedly with visible pass/fail at each step, satisfying the intent of the planned manual pass without a separate untracked manual session.

**Checkpoint 3: PASSED.**

---

## Phase 4 — Full Suite, Coverage, and CI-Readiness

- [x] 4.1 Full 5-file E2E suite (`dashboard`, `editor`, `journey`, `placeholder`, `search`, `share` — 11 tests) run headless, back-to-back, twice: **11/11 passed** both times. A third run hit one unrelated pre-existing `Ctrl+K` focus-timing flake in `search.spec.ts` (a file untouched beyond the helper-import swap); re-ran `search.spec.ts` alone 3× and it passed all 3 — confirmed pre-existing environment flakiness, not an AB-1016 regression.
- [x] 4.2 `pnpm test:e2e` now exists and works at the root (see Deviation — the script was missing entirely) and passes the full suite end-to-end, satisfying FRS AC-1 verbatim.
- [x] 4.3 Suite runs fully headless, no `--headed`/`--ui` anywhere in config or scripts (FRS AC-4).
- [x] 4.4 Re-reviewed `journey.spec.ts` against spec.md Scenarios 1–10 and E1–E3 — every scenario has a corresponding assertion, not just a UI action.

**Checkpoint 4: PASSED.**
```bash
pnpm build            # 0 errors
pnpm lint --max-warnings 0   # clean
pnpm test              # shared 135, backend 352, frontend 335 — all green
pnpm test:e2e           # 11/11 (run twice back-to-back)
```

Coverage note: this ticket's "new code" is Playwright test files — CLAUDE.md's coverage gate is inherently satisfied by the E2E suite itself. The one production fix (query invalidation, see below) got its own unit-test assertion added to the existing `useDeleteNoteMutation` test.

---

## Deviations from plan.md (found during implementation, not anticipated in `/plan`)

1. **`apps/frontend/playwright.config.ts` had no `webServer` block at all** (unchanged since the AB-1001 scaffold, despite SDS §37.10 documenting one) — `pnpm test:e2e` couldn't even boot the app standalone; every spec failed with `ECONNREFUSED`. Added the SDS-documented `webServer` config (boots `dev:backend`/`dev:frontend`, `workers: 1`, `reuseExistingServer` outside CI). Required to make AC-1/AC-4 true statements at all.
2. **Root `package.json` had no `test:e2e` script** (SDS §37.2 documents one, never added). Added `"test:e2e": "pnpm --filter @note-app/frontend test:e2e"` — zero-risk script alias, required since FRS AB-1016 AC-1 names this exact command.
3. **Real bug: `useDeleteNoteMutation` never invalidated `['shares','list']`.** BR-014 (soft-delete auto-revokes a note's share link) is correctly enforced server-side (verified directly via API), but the frontend's delete mutation only invalidated `['notes','list']`/`['tags','list']`, so `ShareModal` kept showing a stale "active" link for up to the query's 30s `staleTime` after a trash/restore round trip. Fixed in `apps/frontend/src/features/notes/notes.hooks.ts` (one line + comment) with a new assertion added to the existing unit test. Found only because the E2E journey actually re-opens the Share dialog after a trash+restore — exactly the kind of cross-feature gap a per-feature test suite can't catch, which is the whole point of this ticket.
4. **Real, user-confirmed decision: relaxed the global rate limiter outside production.** The full 5-file E2E suite's cumulative request volume (confirmed via direct load test: 100th request trips it) exceeds the backend's global 100-req/min-per-IP limiter within a single run. Asked the user rather than deciding unilaterally (security-relevant config); user chose to gate the strict limit to `NODE_ENV==='production'` only (`apps/backend/src/middleware/rate-limiter.ts`), raising it to 10,000/min in dev/test — mirrors the existing pattern of `BCRYPT_ROUNDS` already differing by environment. Zero effect on real production traffic.
5. **Test-content fixes discovered only by actually running the suite** (all within `journey.spec.ts`, no other files affected):
   - `Ctrl+K`/`SearchBar` only mounts in `DashboardHeader` (Dashboard/Search pages) — pressing it from the note editor instead triggers `NoteEditor`'s own "insert link" shortcut. Added a "Back to Dashboard" navigation step before Scenario 5.
   - `UserMenu`/"Sign out" likewise only renders in `DashboardHeader` — added a "Back to Dashboard" step before Scenario 10.
   - `TrashToggle` is one button whose label flips ("Trash" ↔ "Back to notes") — after restoring from Trash, added a click on "Back to notes" before looking for the note in the main list.
   - Toast text duplicates into an ARIA live-region announcer (same pattern `editor.spec.ts` already works around) — added `.first()` to the version-restore toast assertion.
   - The golden path's 10 sequential steps (three ~2s autosave debounces plus register/login/search/share/history/trash/logout round trips) exceed Playwright's default 30s per-test timeout — added `test.setTimeout(90_000)` to that one test only.

---

Archived. See `openspec/archive/AB-1016/` for the final spec, plan, and this checklist.
