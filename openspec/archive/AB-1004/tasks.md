# Task Checklist — AB-1004 (Backend Notes CRUD + Soft Delete)

Sequenced from `openspec/tickets/AB-1004/plan.md`. File IDs (S*, B*, M*, T*) match the plan's
tables. No new Prisma models/migrations — `Note`, `NoteTag`, `NoteVersion`, `ShareLink`, and the
`searchVector` column/GIN index/trigger already exist from AB-1001.

Outstanding decisions carried from the plan, treated as final unless flagged before implementation
starts: unknown/foreign `tagIds` are silently filtered rather than rejected (Architecture Decision
4); `CONTENT_TOO_LARGE` is enforced via the existing global body-parser limit, not a Zod size check
(Architecture Decision 3); no "sharing status" field on the note response (Architecture Decision 5).

### Phase 1 — Foundation (shared contracts, cross-cutting middleware, dependencies)

- [x] Add `RECOVERY_WINDOW_DAYS = 30` to `packages/shared/src/constants/limits.ts` (S1)
- [x] Write `packages/shared/src/schemas/note.schemas.ts` — `NoteTagRefSchema`,
      `CreateNoteRequestSchema`, `UpdateNoteRequestSchema`, `NoteResponseSchema`,
      `DeleteNoteResponseSchema`, `RestoreNoteResponseSchema`, `NoteIdParamSchema` (S2)
- [x] Write `packages/shared/src/types/note.types.ts` — `z.infer` exports only, no hand-written
      interfaces (S3)
- [x] Add `sanitize-html` (2.13.1) and `html-to-text` (9.0.5) to `apps/backend/package.json`
      dependencies, `@types/sanitize-html` (2.13.0) to devDependencies; run install (B1)
- [x] Add `validateParams(schema)` to `apps/backend/src/middleware/validate.ts`, alongside the
      existing `validateBody` (B2)
- [x] Update `apps/backend/src/middleware/error-handler.ts` — add the `entity.too.large` →
      `413 CONTENT_TOO_LARGE` branch, keep existing `AppError`/500-fallback branches intact (B3)
- [x] Confirm no DB migration is needed — `Note`/`NoteTag`/`NoteVersion`/`ShareLink` and the
      `searchVector` trigger already exist (`schema.prisma`, migration
      `20260722081152_search_vector`)

**Checkpoint 1**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 2 — Core implementation (content pipeline & service layer)

- [x] Create `apps/backend/src/modules/notes/notes.errors.ts` — `NoteNotFoundError`,
      `AlreadyDeletedError`, `NotDeletedError`, `RecoveryExpiredError` (M1)
- [x] Create `apps/backend/src/modules/notes/notes.content.ts` — `sanitizeNoteHtml` (SDS §23.4
      whitelist via `sanitize-html`), `extractPlainText` (block-aware via `html-to-text`) (M2)
- [x] Create `apps/backend/src/modules/notes/notes.service.ts` — `createNote`, `getNote`,
      `updateNote`, `softDeleteNote`, `restoreNote` (Prisma injected as first arg, per
      `auth.service.ts` precedent) (M3)

**Checkpoint 2**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 3 — Integration (router wiring)

- [x] Create `apps/backend/src/modules/notes/notes.controller.ts` — thin async handlers, no manual
      try/catch (M4)
- [x] Create `apps/backend/src/modules/notes/notes.router.ts` — wire routes with `requireAuth` +
      `validateParams(NoteIdParamSchema)` + `validateBody(...)` as applicable (M5)
- [x] Update `apps/backend/src/app.ts` — mount `app.use('/api/notes', notesRouter)` (M6)
- [x] Manual smoke check: `pnpm dev:backend` + `curl`/Postman calls for create → read → update →
      delete → restore against the running dev server (requires a valid access token from
      `POST /api/auth/login`)

**Checkpoint 3**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] `packages/shared/tests/unit/note.schemas.test.ts` — valid/invalid cases for every schema in
      S2 (title trim/default/max-length, empty content, non-UUID `tagIds`/`id` param) (S4)
- [x] `apps/backend/tests/unit/validate.middleware.test.ts` — add `validateParams` cases (valid
      UUID passes through, invalid UUID → `ValidationError`) (B4)
- [x] `apps/backend/tests/unit/error-handler.test.ts` — add the `entity.too.large` →
      `413 CONTENT_TOO_LARGE` case, keep existing cases green (B5)
- [x] `apps/backend/tests/unit/notes.content.test.ts` — sanitization strips disallowed
      tags/attributes and keeps whitelisted ones; plain-text extraction is space-separated across
      block elements, not concatenated (T1)
- [x] `apps/backend/tests/unit/notes.service.test.ts` — every scenario in `spec.md` §3 against a
      mocked Prisma client: create (title default/trim, empty content, tag association, foreign/
      unknown `tagIds` silently dropped), read (not-found/foreign/soft-deleted all → 404), update
      (partial update still versions, tag-replace atomicity, next-version-number computation),
      delete (already-deleted → 409), restore (not-deleted → 409, expired → 410 using
      `vi.setSystemTime` to test the exact 30-day boundary, within-window success) (T2)
- [x] `apps/backend/tests/integration/setup.ts` — extend the truncate helper to include `ShareLink`,
      `NoteVersion`, `NoteTag`, `Note`, `Tag` (FK-safe order), alongside existing
      `RefreshToken`/`User` (T4)
- [x] `apps/backend/tests/integration/notes.integration.test.ts` — full Supertest coverage of all 5
      endpoints against the real test DB (`docker compose up -d` required), one case per scenario
      in `spec.md` §3, plus a genuine >500 KB payload asserting `413 CONTENT_TOO_LARGE` end-to-end
      (T3)
- [x] No E2E (Playwright) tests — this ticket has no UI; AB-1012/AB-1016 cover E2E note-editor flows

**Checkpoint 4 (final quality gate)**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirm ≥80% coverage on all new/changed files in `apps/backend/src` and
      `packages/shared/src`
- [x] Confirm every Acceptance Criterion and Error Case in `spec.md` §3 has a passing test
