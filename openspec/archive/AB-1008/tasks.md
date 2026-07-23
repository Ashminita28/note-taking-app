# Task Checklist — AB-1008 (Backend Sharing)

Sequenced from `openspec/tickets/AB-1008/plan.md`. File IDs (S*, B*, T*) match the plan's file
lists. No new Prisma models/migrations — `ShareLink` already exists (AB-1001) and its hard-delete-
on-soft-delete side effect already exists (AB-1004); this ticket creates a brand-new `share` module
(router/controller/service/errors) mounted at the bare `/api` prefix since its routes span three
different sub-paths (`/api/notes/:id/share`, `/api/shares`, `/api/shared/:token`).

Decisions carried from the plan, treated as final unless implementation surfaces a reason to
revisit: atomic view-count increment uses Prisma's native `{ increment: 1 }` inside `updateMany`,
not raw SQL — satisfies SDS §25.3's atomicity requirement while staying inside
`apps/backend/CLAUDE.md`'s "no raw SQL except search" constraint (Plan Decision, Section 1); an
expired existing share link is `update`d in place (new token, `expiresAt`, reset `viewCount: 0`,
refreshed `createdAt`) rather than delete+create, avoiding a race on the unique `noteId` constraint
(Decision 1); a new required `FRONTEND_URL` env var is added, kept distinct from `CORS_ORIGIN`
(Decision 2); author name is `User.name` via `ShareLink → Note → User` (Decision 3); the public
`:token` param is validated as `z.string().min(1)`, not `.uuid()`, so a malformed token still
resolves to `404 SHARE_LINK_NOT_FOUND` per FRS EC-1 rather than `422 VALIDATION_ERROR` (Token Param
Validation decision).

**Implementation deviation from the plan (discovered, not speculative):** `apps/backend/vitest.config.ts`
injects its own fixed `env` block for the whole integration/unit test run (`NODE_ENV`, `DATABASE_URL`,
`JWT_SECRET`, `CORS_ORIGIN`) rather than reading `.env`/`.env.test`. Since `FRONTEND_URL` is now a
required env var, every backend test would have failed at `env.ts`'s `safeParse` before this was
added. Fixed by adding `FRONTEND_URL: 'http://localhost:5173'` to that same `env` block. This
resolves Plan §7 Open Item 1 exactly — the answer is `vitest.config.ts`, not a separate `.env.test`
file (no such file exists in this repo; `vitest.config.ts` is the sole test-env mechanism).

All other plan decisions held with no further changes needed during implementation.

### Phase 1 — Foundation (shared contracts + config)

- [x] Write `packages/shared/src/schemas/share.schemas.ts` — replace the `export {};` placeholder
      with `CreateShareRequestSchema` (`expiresInHours` optional, coerced int,
      `SHARE_EXPIRY_MIN_HOURS`–`SHARE_EXPIRY_MAX_HOURS`, no `.default()` — server resolves the
      default from `config.SHARE_DEFAULT_EXPIRY_HRS`), `ShareLinkSchema`, `CreateShareResponseSchema`,
      `RevokeShareResponseSchema`, `ShareListItemSchema`, `ListSharesResponseSchema`,
      `SharedNoteViewSchema`, `GetSharedNoteResponseSchema`, `ShareTokenParamSchema` (plain
      `z.string().min(1)`, not `.uuid()`) (S1)
- [x] Write `packages/shared/src/types/share.types.ts` — replace the `export {};` placeholder with
      `z.infer` exports for every schema in S1 (S2)
- [x] Confirmed no changes needed to `packages/shared/src/index.ts` (barrel already re-exports
      `share.schemas.js`/`share.types.js`), `constants/limits.ts` (`SHARE_EXPIRY_MIN_HOURS`/
      `SHARE_EXPIRY_MAX_HOURS` already exist), `constants/defaults.ts` (`DEFAULT_SHARE_EXPIRY_HOURS`
      already exists), or `constants/errors.ts` (`SHARE_LINK_EXPIRED`/`SHARE_LINK_NOT_FOUND` already
      exist)
- [x] Confirmed reuse of `NoteIdParamSchema` from `packages/shared/src/schemas/note.schemas.ts` for
      the `:id` param on `POST`/`DELETE /api/notes/:id/share` — no duplicate schema
- [x] Updated `apps/backend/src/config/env.ts` — added required `FRONTEND_URL: z.string().min(1, ...)`
      (B5)
- [x] Updated `apps/backend/.env` and `apps/backend/.env.example` — added `FRONTEND_URL`
      (`http://localhost:5173` in dev, matching `CORS_ORIGIN`'s current value) (B5)
- [x] Updated `apps/backend/vitest.config.ts` — added `FRONTEND_URL` to the test `env` block (see
      deviation note above; not in the original plan, discovered during this phase)
- [x] Confirmed no DB migration is needed — `ShareLink` (`id`, `noteId` unique, `token` unique,
      `viewCount`, `expiresAt`, `createdAt`) already exists in `schema.prisma` (delivered by AB-1001)

**Checkpoint 1** — passed
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
pnpm --filter @note-app/backend build
```

### Phase 2 — Core implementation (service layer)

- [x] Write `apps/backend/src/modules/share/share.errors.ts` — `ShareLinkNotFoundError`
      (`SHARE_LINK_NOT_FOUND`), `ShareLinkExpiredError` (`SHARE_LINK_EXPIRED`); `NoteNotFoundError`
      imported from `../notes/notes.errors.js`, not redefined (B1)
- [x] Write `apps/backend/src/modules/share/share.service.ts`:
      - `generateShareLink` — verifies note exists/owned/not-deleted (`NoteNotFoundError`); looks up
        existing `ShareLink` by `noteId`; if active (`expiresAt > now`) returns unchanged (FRS AF-1);
        if expired, `update`s in place with a new token/expiry/reset `viewCount`; if none, `create`s;
        resolves `expiresInHours` via `input.expiresInHours ?? config.SHARE_DEFAULT_EXPIRY_HRS`;
        builds `url` via `FRONTEND_URL`
      - `revokeShareLink` — verifies note exists/owned (`NoteNotFoundError`); verifies a `ShareLink`
        row exists (`ShareLinkNotFoundError` if not); `delete`s
      - `listShares` — `findMany` scoped to `note: { userId }` and `expiresAt: { gt: now }`, ordered
        `createdAt desc`, mapped to `{noteId, noteTitle, url, expiresAt, viewCount, createdAt}`
      - `getSharedNote` — `findUnique` by `token` including `note.user`; `ShareLinkNotFoundError` if
        missing or note soft-deleted (defensive); `ShareLinkExpiredError` if past `expiresAt`;
        atomic `updateMany` with `viewCount: { increment: 1 }` guarded by `expiresAt: { gt: now }`;
        returns `{title, content, authorName, createdAt}` only — no `id`, `tags`, `viewCount`, or
        email (B2)

**Checkpoint 2** — passed
```
pnpm --filter @note-app/backend build
pnpm --filter @note-app/backend lint --max-warnings 0
```

### Phase 3 — Integration (controller/router wiring)

- [x] Write `apps/backend/src/modules/share/share.controller.ts` — thin handlers:
      `generateShareLinkHandler` (201), `revokeShareLinkHandler` (200), `listSharesHandler` (200),
      `getSharedNoteHandler` (200, no `req.userId` — public) (B3)
- [x] Write `apps/backend/src/modules/share/share.router.ts` — full sub-paths mounted at the bare
      `/api` prefix: `POST /notes/:id/share` and `DELETE /notes/:id/share` (both `requireAuth` +
      `validateParams(NoteIdParamSchema)`, POST also `validateBody(CreateShareRequestSchema)`),
      `GET /shares` (`requireAuth` only), `GET /shared/:token` (`validateParams(ShareTokenParamSchema)`,
      **no** `requireAuth`) (B4)
- [x] Updated `apps/backend/src/app.ts` — imported `shareRouter`, added `app.use('/api', shareRouter)`,
      updated the "Further feature routes..." comment to reference AB-1009 onward (B6)
- [x] Manual smoke check: started the backend against the real dev DB (`pnpm dev:backend`),
      registered a user, created a note, then exercised the full lifecycle via `curl` — generate
      (201, correct default 7-day expiry and `FRONTEND_URL`-based `url`), public view twice (`200`,
      `viewCount` 0→1→2, no `id`/`tags`/`email` in the response), list (`200`, matching metadata),
      revoke (`200`), public view after revoke (`404 SHARE_LINK_NOT_FOUND`) — all correct. Dev DB
      smoke-test data cleaned up afterward.

**Checkpoint 3** — passed (314 backend tests unaffected, no regressions from wiring)
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] `packages/shared/tests/unit/share.schemas.test.ts` — `CreateShareRequestSchema`:
      `expiresInHours` omitted/valid/min-bound/max-bound/below-min/above-max/non-integer/non-numeric;
      `ShareTokenParamSchema`: accepts UUID-shaped and non-UUID-shaped strings alike, rejects empty
      and missing (T3) — 14 tests
- [x] `apps/backend/tests/unit/share.service.test.ts` — mocked `prisma.note`/`prisma.shareLink` per
      the `tags.service.test.ts` `createMockPrisma()` pattern, with `vi.useFakeTimers()` to make
      expiry-boundary assertions deterministic; covers every branch in `generateShareLink` (create /
      return-existing-active / regenerate-expired / `NoteNotFoundError`), `revokeShareLink` (success /
      `NoteNotFoundError` / `ShareLinkNotFoundError`), `listShares` (mapping + exact `where`/`include`/
      `orderBy` args, empty list), `getSharedNote` (`ShareLinkNotFoundError` for missing token and for
      soft-deleted note, `ShareLinkExpiredError`, success with exact `updateMany` increment args and a
      response shape asserted to omit `id`/`tags`/`email`/`viewCount`) (T1) — 14 tests
- [x] `apps/backend/tests/integration/share.integration.test.ts` — full coverage of all 24 spec
      scenarios (plus 3 extra sub-cases for foreign-user variants) against the real test DB
      (`createApp()`, `supertest`, `registerAndLogin`, `resetNotesTables()` — already truncates
      `shareLink` first, no setup changes needed):
      - Scenarios 1–9 (`POST /api/notes/:id/share`): default/custom expiry (asserted via
        `expiresAt`/`createdAt` diff in hours), existing-active returned unchanged (token/viewCount
        preserved, no duplicate row), existing-expired regenerated (new token, `viewCount` reset,
        still exactly one row), note not found/foreign/soft-deleted (all `NOTE_NOT_FOUND`), expiry
        validation (too low/high/non-integer), unauthenticated
      - Scenarios 10–14 (`GET /api/shared/:token`): successful public access with the exact response
        shape (no `id`/`tags`/`viewCount`), `viewCount` confirmed incremented via a follow-up
        `prisma.shareLink.findUnique`; concurrent-increment correctness — 10 concurrent requests via
        `Promise.all` starting from `viewCount: 5`, final value asserted to be exactly `15` (proves
        the atomic-increment approach holds under real concurrent connections, not just mocked call
        args); token not found; expired (asserted `viewCount` does NOT increment); soft-deleted note
        (built via direct Prisma writes to reach precisely)
      - Scenarios 15–19 (`DELETE /api/notes/:id/share`): success (row actually gone), revoked link
        immediately inaccessible publicly, note not found/foreign, no active link
        (`SHARE_LINK_NOT_FOUND` distinct from `NOTE_NOT_FOUND`), unauthenticated
      - Scenarios 20–24 (`GET /api/shares`): listing with full metadata, expired links excluded,
        empty list, cross-user isolation, unauthenticated (T2) — 27 tests
- [x] No E2E (Playwright) tests — this ticket has no UI; a later frontend ticket covers the Share
      Modal (UX-SCR-011) and Shared Note View (UX-SCR-013)

**Checkpoint 4 (final quality gate)** — passed
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirmed ≥80% coverage on all new/changed files — `src/modules/share` at 100%
      stmts/branch/funcs/lines; overall backend coverage 99.54% (314 tests); shared package 126
      tests all green
- [x] Confirmed every Acceptance Criterion and Error Case in `spec.md` §3 has a passing test — all
      24 scenarios covered by `share.integration.test.ts` (41 new backend tests total between unit +
      integration, plus 14 new shared schema tests)
- [x] Confirmed the three open items from `plan.md` §7:
      1. `FRONTEND_URL` needed to be added to `apps/backend/vitest.config.ts`'s inline `env` block —
         see deviation note above
      2. `shareLink.findMany`'s `note: { userId }` relation filter compiled and behaved exactly as
         expected — Scenario 23 (cross-user isolation) passed on the first run
      3. `shareLink.update`'s explicit `createdAt: now` overwrite was accepted by Prisma with no
         schema-level objection — Scenario 4 (expired-link regeneration) passed on the first run
