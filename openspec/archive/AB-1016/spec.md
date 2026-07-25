# AB-1016 — End-to-End Journey (Playwright) Spec

## 1. Ticket

- **ID:** AB-1016
- **Title:** End-to-End Journey (Playwright)
- **Dependencies:**
  - AB-1010 (Frontend Auth) through AB-1015 (Frontend Version History) — all confirmed complete (`openspec/archive/AB-1010` … `AB-1015`). This ticket introduces no new UI or API; it only drives the screens and endpoints those tickets already shipped.
  - Existing E2E scaffolding already in `apps/frontend/tests/e2e/`: `dashboard.spec.ts`, `editor.spec.ts`, `search.spec.ts`, `share.spec.ts` (and a `placeholder.spec.ts` stub that this ticket's new spec file supersedes as the "real" smoke coverage — the stub itself is left alone unless `/plan` decides otherwise). These four files establish the conventions this ticket follows exactly: a module-level `uniqueEmail(prefix)` helper (`${prefix}-${Date.now()}-${random}@example.com`) and a `loginViaUi(page, email, password)` helper, `request.post('/api/...')` used to seed backend state (register/login/create notes/tags) faster than driving the UI for setup, and one long "golden path" `test()` per file that exercises the full happy-path flow for that feature, with `getByRole`/`getByLabel` selectors matching real UI copy exactly (e.g. `'Sign in'`, `'+ New Note'`, `'Saved ✓'`, `'More actions'`, `'Move to trash'`, `'Note moved to trash.'`, `'Undo'`).
  - Confirmed exact UI strings this ticket's journey depends on, read directly from the shipped components (not just the FRS/UX prose): `ActionHeader`'s "More actions" dropdown has `Share`, `History`, and `Move to trash` items (`ActionHeader.tsx`); the version drawer is `<Drawer>` with `aria-label="Version history"`, buttons `Back to current` / `Restore this version`, and a restore toast of the literal form `` `Version ${versionNumber} restored.` `` (`VersionHistoryDrawer.tsx`); the share flow's dialog is `getByRole('dialog', { name: 'Share note' })` with `Generate Link` / `Copy Link` → `Copied! ✓` / `Revoke Link` → `Yes, revoke` (`share.spec.ts`, already-shipped `ShareModal`); trash/restore toasts are `'Note moved to trash.'` and `'Note restored'` (`editor.spec.ts`, `dashboard.spec.ts`).
- **Status:** done — see §8 for scope amendments discovered during `/implement`.

## 2. Requirements Covered

Per the Requirement Traceability Matrix (FRS §25.2), AB-1016 spans **all FR-\* requirements** and **all UX-SCR-\* screens** — it is a coverage ticket, not a new-feature ticket. The specific requirements exercised by the journey below:

| Requirement ID | Restatement (as exercised by this journey) |
| --------------- | ----------- |
| FR-AUTH-001 | Register with name/email/password; duplicate email is rejected with 409 `EMAIL_ALREADY_EXISTS`. |
| FR-AUTH-002 | Login with email/password returns tokens and redirects to the dashboard; wrong credentials return 401 `INVALID_CREDENTIALS`. |
| FR-AUTH-004 | Logout invalidates the refresh token and returns the user to `/login`. |
| FR-NOTE-001, FR-NOTE-003 | Create a note with title + rich-text content; autosave persists it without an explicit save action. |
| FR-NOTE-004, FR-NOTE-005 | Soft-deleting a note moves it to Trash; restoring from Trash brings it back (BR-003: 30-day recovery window). |
| FR-TAG-001 | Create a new tag inline and assign it to the note; the tag chip appears on the note. |
| FR-SRCH-001 | Full-text search finds the note by content and highlights the matched term. |
| FR-SHARE-001, FR-SHARE-002 | Generate a share link, copy it, and load it in an unauthenticated context to confirm the public read-only view. |
| FR-SHARE-003 | Revoke the share link; the previously-shared URL becomes inaccessible (404 `SHARE_LINK_NOT_FOUND`). |
| FR-VER-001 (relied upon, not directly asserted), FR-VER-002, FR-VER-003, FR-VER-004 | Open the Version History drawer, see the version list, and restore an older version (BR-009: restore creates a new version, does not rewrite history). |

**Business rules exercised:** BR-002 (own-resource-only — implicit throughout, already covered per-feature by AB-1010–1015's own specs), BR-006 (one active share link per note), BR-009 (restore creates a new version), BR-014 (soft-deleting a note revokes its share link — **not** part of this journey's happy path, since the journey revokes the share explicitly before trashing nothing of the sort; left as an out-of-scope cross-check, see §6), BR-016 (tags hard-deleted — not exercised, this journey only creates a tag, never deletes one).

**Explicitly not re-litigated:** field-level validation minutiae, drawer animation timing, focus-trap mechanics, responsive breakpoints, and pagination/sort edge cases — all already covered by the per-feature specs (`dashboard.spec.ts`, `editor.spec.ts`, `search.spec.ts`, `share.spec.ts`) and their originating tickets' own OpenSpec scenarios. This ticket's job is the *connective* journey across features in one continuous session, plus the 3 required error scenarios — not to re-prove each feature's internals.

## 3. Scenarios

### The Golden Path — One Continuous Journey (FRS §25.3 AB-1016, steps 1–10)

**Scenario 1 — Register a new account, then verify redirect to Login**
- **Given** an unauthenticated visitor with a fresh, never-used email address
- **When** they fill in name, email, and password on `/register` and submit
- **Then** the account is created (`POST /api/auth/register` → 201) and the app redirects to `/login`.

**Scenario 2 — Login, then verify redirect to Dashboard**
- **Given** the just-registered account
- **When** the user submits the same email/password on `/login`
- **Then** `POST /api/auth/login` succeeds and the app redirects to `/` (Dashboard, UX-SCR-006).

**Scenario 3 — Create a note with title and rich-text content, verify autosave**
- **Given** the user is on the Dashboard
- **When** they click "+ New Note", fill the "Note title" field, click into the `.ProseMirror` editor, and type rich-text content
- **Then** within the autosave debounce window the URL swaps from `/notes/new` to `/notes/:id` and a "Saved ✓" indicator appears (mirrors `editor.spec.ts`'s existing golden path).

**Scenario 4 — Create a tag and assign it to the note, verify the tag chip appears**
- **Given** the note from Scenario 3 is open and saved
- **When** the user clicks "Add tag", types a new tag name, and selects "Create \"{name}\""
- **Then** the tag is created (`POST /api/tags`) and its chip renders on the note (FR-TAG-001).

**Scenario 5 — Search for the note, verify highlighted results**
- **Given** the note has saved content containing a distinctive term
- **When** the user opens search (`Ctrl+K`) and types that term
- **Then** the URL becomes `/search?q={term}`, the note appears in results, and the matched term is wrapped in a `<mark>` highlight (mirrors `search.spec.ts`).

**Scenario 6 — Generate a share link, verify copy; open the shared URL, verify the public view**
- **Given** the note is open and the user grants clipboard permissions
- **When** the user opens "More actions" → "Share", clicks "Generate Link", then "Copy Link"
- **Then** the dialog shows "Copied! ✓" and the generated URL contains `/shared/`; when that URL is opened in a fresh, unauthenticated browser context, the note's title and content render read-only (`.ProseMirror[contenteditable="false"]`) with no "More actions" control (FR-SHARE-001, FR-SHARE-002).

**Scenario 7 — View version history, verify the version list; restore a version, verify a new version is created**
- **Given** the note has been saved at least twice (once in Scenario 3, once implicitly by the tag/share flows autosaving metadata, or via an explicit second edit if the flows above don't produce a second snapshot — see Open Question 1)
- **When** the user opens "More actions" → "History"
- **Then** the drawer (`aria-label="Version history"`) lists the note's versions newest-first; clicking an older version shows the yellow "Viewing version {N} from {date}" banner (read-only), and clicking "Restore this version" calls `POST /api/notes/:id/versions/:n/restore`, shows the toast `` `Version {n} restored.` ``, closes the drawer, and updates the live editor content to that version's content (FR-VER-002–004, BR-009).

**Scenario 8 — Soft-delete the note, verify Trash; restore from Trash**
- **Given** the note is open
- **When** the user opens "More actions" → "Move to trash" and confirms
- **Then** the app returns to `/`, shows the toast "Note moved to trash.", the note disappears from the main list and appears under "Trash"; clicking "Restore" (or the toast's "Undo") brings the note back to the main list (FR-NOTE-004, FR-NOTE-005).

**Scenario 9 — Revoke the share link, verify expired access**
- **Given** the note (now restored from Trash) still has the active share link generated in Scenario 6
- **When** the user reopens the Share dialog and clicks "Revoke Link" → "Yes, revoke"
- **Then** the dialog shows "No active share link for this note."; reloading the previously-copied share URL in an unauthenticated context now shows "Note not found" (`404 SHARE_LINK_NOT_FOUND`) instead of the note content (FR-SHARE-003).

**Scenario 10 — Logout, verify redirect to Login**
- **Given** the user is authenticated on any in-app page
- **When** they open the user menu and select "Sign out"
- **Then** `POST /api/auth/logout` is called, the in-memory auth state is cleared, and the app redirects to `/login` (FR-AUTH-004).

### Required Error Scenarios (FRS AB-1016 AC-3: "at least 3 error scenarios")

**Scenario E1 — Duplicate email registration is rejected**
- **Given** an email address that is already registered
- **When** a second registration attempt is submitted with that same email
- **Then** `POST /api/auth/register` returns `409 EMAIL_ALREADY_EXISTS` and the UI shows "An account with this email already exists." without navigating away from `/register` (FR-AUTH-001 EC-1).

**Scenario E2 — Invalid login credentials are rejected**
- **Given** a registered account
- **When** the user submits the correct email with an incorrect password
- **Then** `POST /api/auth/login` returns `401 INVALID_CREDENTIALS`, the UI shows "Invalid email or password.", and the user remains on `/login` (FR-AUTH-002 EC-2).

**Scenario E3 — A revoked share link is inaccessible**
- **Given** a share link was generated and then revoked (Scenario 9)
- **When** anyone (including the original owner, unauthenticated) navigates to that URL afterward
- **Then** the public view shows "Note not found" (`404 SHARE_LINK_NOT_FOUND`) rather than the note content — this is asserted as its own scenario (not only inline in Scenario 9) so the ticket's "≥3 error scenarios" requirement has an explicit, independently-runnable test (FR-SHARE-002/003 error catalogue, §14.5).

## 4. API / Interface Contract

No new endpoints. This ticket drives the full set already shipped by AB-1001–1009 (backend) as consumed by AB-1010–1015 (frontend):

| Method | Path | Used in Scenario |
| ------ | ---- | ----------------- |
| POST | `/api/auth/register` | 1, E1 |
| POST | `/api/auth/login` | 2, E2 |
| POST | `/api/auth/logout` | 10 |
| POST | `/api/notes` | 3 (via UI autosave) |
| PATCH | `/api/notes/:id` | 3 (autosave), 7 (restore updates note) |
| DELETE | `/api/notes/:id` | 8 |
| POST | `/api/notes/:id/restore` | 8 |
| POST | `/api/tags` | 4 |
| GET | `/api/search?q=` | 5 |
| POST | `/api/notes/:id/share` | 6 |
| DELETE | `/api/notes/:id/share` | 9 |
| GET | `/api/shared/:token` | 6, 9, E3 |
| GET | `/api/notes/:id/versions` | 7 |
| GET | `/api/notes/:id/versions/:versionNumber` | 7 |
| POST | `/api/notes/:id/versions/:versionNumber/restore` | 7 |

## 5. State & Data Impact

- **New test file:** `apps/frontend/tests/e2e/journey.spec.ts` (name TBD at `/plan` — see Open Question 2). Intended as a test-only ticket at spec time — **this was not the final scope; see §8.**
- Reuses the existing `uniqueEmail()` / `loginViaUi()` helpers' pattern (whether by duplicating them locally, matching the other four spec files' precedent, or extracting a shared helper module — see Open Question 3).
- No new Prisma models, no `packages/shared` changes, no backend changes.
- Each test run creates its own fresh user via `uniqueEmail(prefix)`, so isolation between runs comes from unique emails/notes rather than a full database reset — this matches the precedent already established by the four existing spec files, even though SDS §30.3 describes DB-reset-based isolation for integration tests specifically (see Open Question 4 on whether AB-1016 needs anything beyond that existing convention).

## 6. Out of Scope

- Any new UI, API, or Prisma schema — purely test coverage over AB-1010–1015's shipped work.
- Re-testing feature internals already covered by `dashboard.spec.ts`, `editor.spec.ts`, `search.spec.ts`, `share.spec.ts` (pagination, sort, focus trap, responsive layout, drawer animation timing, tag filter chips, undo-from-toast mechanics beyond a single pass).
- BR-014 (soft-deleting a note auto-revokes its share link) as an explicit assertion — the journey's ordering revokes the share link *before* any delete step touches that note, so this cross-cutting rule is not exercised here; it would need its own scenario if desired (flag for `/plan`).
- Password reset / OTP flow (FR-PWD-\*) — not part of the FRS-specified 10-step journey.
- Cross-browser coverage (Firefox/WebKit) — `playwright.config.ts` (SDS §37.10) only configures the `chromium` project; unchanged by this ticket.
- Changing `playwright.config.ts`, the test-database strategy, or CI wiring — out of scope unless `/plan` determines the existing setup is insufficient for a single-file, full-journey test. **In practice, `/implement` found `playwright.config.ts` had no `webServer` block at all and the suite could not run; this turned out to be in-scope by necessity — see §8.**

## 7. Open Questions for `/plan`

1. **Ensuring ≥2 version snapshots exist before Scenario 7 (History):** BR-008 says "every note save creates exactly one version snapshot." The journey's earlier steps (create note, add tag, generate share link) may or may not each trigger a note *save* (as opposed to a tag/share side-table write) — need to confirm which of Scenarios 3–6 actually produce additional `NoteVersion` rows, or whether Scenario 7 needs its own explicit second edit (e.g., typing more content) purely so there's an older version to restore *to*.
2. **Test file name and shape:** one new `journey.spec.ts` with a single long `test()` following the FRS's 10 numbered steps literally (closest to the ticket's literal wording), vs. splitting into a `test.describe('End-to-End Journey')` block with the golden path as one test plus the 3 error scenarios as separate `test()`s in the same file (closer to the existing four files' internal convention of "one golden path + auxiliary tests per describe block"). Recommend the latter for consistency; confirming before `/plan` locks it in.
3. **Shared test helpers:** `uniqueEmail()` and `loginViaUi()` are currently copy-pasted verbatim across all four existing spec files. AB-1016 needs both again — introduce `tests/e2e/helpers.ts` now and backfill the other four files to import from it, or continue the copy-paste precedent to keep this ticket's diff minimal and strictly additive? (Leans toward introducing the shared helper now, since a 5th copy is the usual threshold, but this changes files outside this ticket's nominal scope.)
4. **Test database isolation:** SDS §30.3 specifies a reset-per-suite `notetaking_test` database for integration tests, but the E2E `webServer` config (SDS §37.10) boots `pnpm dev:backend`/`pnpm dev:frontend` with no visible test-specific `DATABASE_URL` override, and the existing four E2E specs rely entirely on per-test unique emails for isolation rather than a DB reset. Confirm AB-1016 should follow that same existing convention as-is (recommended, since changing the DB/webServer strategy is a bigger, cross-cutting infra change unrelated to writing the journey test itself) rather than introducing a real reset-per-run mechanism to literally satisfy the FRS's "clean state per run" wording.
5. **Restore-from-Trash affordance in Scenario 8:** `dashboard.spec.ts` uses a "Restore" button in the Trash list view; `editor.spec.ts` uses the toast's "Undo" action right after deletion. The FRS step says "Soft-delete the note → verify trash. Restore from trash" without specifying which affordance — confirm using the Trash-list "Restore" button (not the toast "Undo") so the test also exercises actually navigating into the Trash view, per the literal FRS wording.

## 8. Post-Implementation Amendment (scope changes found during `/implement`)

This ticket was scoped and planned (§1–7 above, and `plan.md`) as test-only, with zero production/config changes. During `/implement`, running the suite for the first time surfaced gaps that made the test-only boundary unworkable as written. These are documented in full, with rationale, in `tasks.md`'s "Deviations from plan.md" section; summarized here so this spec accurately reflects final scope:

- **`apps/frontend/playwright.config.ts` gained a `webServer` block.** It had none at all (despite SDS §37.10 already documenting one), so `pnpm test:e2e` couldn't boot the app and every spec failed with `ECONNREFUSED`. This directly supersedes §6's "out of scope unless `/plan` determines..." line and Open Question 4 / `plan.md` Decision 4's "no changes to `playwright.config.ts`" — the config change was required to make AC-1/AC-4 true statements at all, not a strategy change to the test-database isolation approach (which is unchanged: still `uniqueEmail()`-per-test, no DB reset).
- **Root `package.json` gained a `test:e2e` script.** FRS AC-1 names `pnpm test:e2e` as the acceptance command, but the script never existed at the root. Added as a zero-risk alias delegating to the frontend's existing script.
- **`apps/frontend/src/features/notes/notes.hooks.ts` received a one-line production bugfix.** `useDeleteNoteMutation` wasn't invalidating `['shares','list']`, so `ShareModal` showed a stale "active" share link after a trash/restore round trip (BR-014 is correctly enforced server-side; only the frontend cache was stale). Found only because the journey test re-opens the Share dialog after trash+restore — a cross-feature gap the per-feature specs couldn't catch. Covered by a new assertion in the existing `notes.hooks.test.tsx` unit test.
- **`apps/backend/src/middleware/rate-limiter.ts` was changed, with explicit user sign-off (not a unilateral call).** The full E2E suite's request volume trips the global 100-req/min-per-IP limiter within a single run. The strict limit is now gated to `NODE_ENV === 'production'` only; dev/test get a relaxed 10,000/min, mirroring the existing environment-conditional pattern used for `BCRYPT_ROUNDS`. Zero effect on production traffic.

None of these are new features or new scenarios — the 10 golden-path scenarios and 3 error scenarios in §3 are unchanged and are exactly what shipped. The amendment is scope of *supporting* files touched to make those scenarios runnable at all, not scope of *what is tested*.
