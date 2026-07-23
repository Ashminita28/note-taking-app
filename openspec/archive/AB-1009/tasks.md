# Task Checklist — AB-1009 (Backend Version History)

Sequenced from `openspec/tickets/AB-1009/plan.md`. File IDs (S*, B*, T*) match the plan's file
lists. No new Prisma models/migrations — `NoteVersion` already exists (AB-1001) and version
creation on note save already exists (AB-1004); this ticket creates a new `versions` module
(router/controller/service/errors) mounted at the **same** `/api/notes` prefix as `notesRouter`
(unlike `share`, which spans three different sub-paths and mounts at the bare `/api`), plus a
background auto-purge function wired to a `setInterval` in `server.ts`.

Decisions carried from the plan, treated as final unless implementation surfaces a reason to
revisit: soft-deleted notes resolve to `NOTE_NOT_FOUND` (not a distinct code) on all three
endpoints, consistent with `getNote`'s `deletedAt: null` scoping; restore recomputes `contentPlain`
via the existing `extractPlainText` helper (no re-`sanitizeNoteHtml` — version content was already
sanitized when captured); `toNoteResponse`/`NOTE_WITH_TAGS_INCLUDE` are exported from
`notes.service.ts` and reused, not duplicated; auto-purge avoids Prisma's `having` clause (unverified
exact syntax) in favor of `groupBy` + an in-application-code `count > VERSION_MIN_RETAINED` filter;
the purge interval is fired only from `server.ts`, never from `createApp()`, so integration tests
never trigger it.

**Implementation deviation from the plan (discovered, not speculative):** the plan's
`versions.controller.ts` sketch typed `getVersionHandler`/`restoreVersionHandler` as
`Request<VersionNumberParam>`. This fails to compile — Express's `Router.get<P>` requires
`P extends ParamsDictionary` (string-valued fields only), but `VersionNumberParam.versionNumber` is
`number` after Zod's `.coerce`, so TypeScript falls back to the default `P = ParamsDictionary` and
rejects the handler as a mismatch. Fixed by typing both handlers as plain `Request` and casting
`req.params as unknown as VersionNumberParam` inside the handler body, matching this codebase's
existing `req.body as CreateNoteRequest`-style casts rather than relying on the route generic. No
other plan decisions changed during implementation; all four open items from `plan.md` §7 confirmed
correct on the first build/test run (see Checkpoint 4 notes below).

### Phase 1 — Foundation (shared contracts + constants)

- [x] Write `packages/shared/src/schemas/version.schemas.ts` — replace the `export {};` placeholder
      with `VersionNumberParamSchema` (`id` UUID + `versionNumber` coerced positive int),
      `VersionListItemSchema`, `ListVersionsResponseSchema`, `VersionDetailSchema`,
      `GetVersionResponseSchema`, `RestoreVersionResponseSchema` (reuses `NoteResponseSchema` from
      `note.schemas.ts`) (S1)
- [x] Write `packages/shared/src/types/version.types.ts` — replace the `export {};` placeholder with
      `z.infer` exports for every schema in S1 (S2)
- [x] Update `packages/shared/src/constants/limits.ts` — add `VERSION_PREVIEW_LENGTH` (200),
      `VERSION_RETENTION_DAYS` (90), `VERSION_MIN_RETAINED` (10) (S3)
- [x] Confirm no changes needed to `packages/shared/src/index.ts` (barrel already re-exports
      `version.schemas.js`/`version.types.js`) or `constants/errors.ts` (`VERSION_NOT_FOUND` already
      exists, mapped to `404`)
- [x] Confirm reuse of `NoteIdParamSchema` from `packages/shared/src/schemas/note.schemas.ts` for the
      list endpoint's `:id`-only param — no duplicate schema
- [x] Confirm no DB migration is needed — `NoteVersion` (`id`, `noteId`, `versionNumber` unique per
      `noteId`, `title`, `content`, `createdAt`) already exists in `schema.prisma` (delivered by
      AB-1001)

**Checkpoint 1**
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
pnpm --filter @note-app/backend build
```

### Phase 2 — Core implementation (service layer)

- [x] Update `apps/backend/src/modules/notes/notes.service.ts` — export the previously-private
      `NOTE_WITH_TAGS_INCLUDE` constant and `toNoteResponse` function (no behavior change) so
      `versions.service.ts` can reuse them for the restore endpoint's `{note}` response
- [x] Write `apps/backend/src/modules/versions/versions.errors.ts` — `VersionNotFoundError`
      (`VERSION_NOT_FOUND`); `NoteNotFoundError` imported from `../notes/notes.errors.js`, not
      redefined (B1)
- [x] Write `apps/backend/src/modules/versions/versions.service.ts`:
      - `requireOwnedNote` helper — `findFirst` scoped to `{id, userId, deletedAt: null}`, throws
        `NoteNotFoundError` if not found (covers not-found/foreign/soft-deleted in one check)
      - `listVersions` — `findMany` ordered `versionNumber desc`, maps to
        `{versionNumber, title, contentPreview (sliced to VERSION_PREVIEW_LENGTH), createdAt}`
      - `getVersion` — `findUnique` by `{noteId_versionNumber}`; `VersionNotFoundError` if missing;
        returns full `{versionNumber, title, content, createdAt}`
      - `restoreVersion` — verifies target version exists (`VersionNotFoundError` if not); inside
        `$transaction`: updates the note's `title`/`content`/`contentPlain` (via `extractPlainText`)
        from the target version, computes `next versionNumber = max + 1` via `aggregate`, creates
        the new version row, re-fetches the note with tags; returns
        `{note: toNoteResponse(note)}`
      - `purgeOldVersions` — `groupBy` on `noteId` with `_count: {id: true}`; filters to
        `count > VERSION_MIN_RETAINED` in application code; per eligible note, fetches the
        `VERSION_MIN_RETAINED` most-recent version `id`s, then `deleteMany` where `noteId` matches,
        `id` is not in that retained set, and `createdAt` is older than the 90-day cutoff; returns
        the total deleted count (B2)

**Checkpoint 2**
```
pnpm --filter @note-app/backend build
pnpm --filter @note-app/backend lint --max-warnings 0
```

### Phase 3 — Integration (controller/router/app/server wiring)

- [x] Write `apps/backend/src/modules/versions/versions.controller.ts` — thin handlers:
      `listVersionsHandler` (200), `getVersionHandler` (200), `restoreVersionHandler` (200) (B3)
- [x] Write `apps/backend/src/modules/versions/versions.router.ts` — `GET /:id/versions`
      (`requireAuth` + `validateParams(NoteIdParamSchema)`), `GET /:id/versions/:versionNumber`
      (`requireAuth` + `validateParams(VersionNumberParamSchema)`),
      `POST /:id/versions/:versionNumber/restore` (same validation) (B4)
- [x] Update `apps/backend/src/app.ts` — import `versionsRouter`, add
      `app.use('/api/notes', versionsRouter)` after `notesRouter`/`shareRouter`, update the "Further
      feature routes..." comment to reference AB-1010 onward (B6)
- [x] Update `apps/backend/src/server.ts` — import `prisma` and `purgeOldVersions`; wire a
      `setInterval(..., 24h).unref()` that calls `purgeOldVersions(prisma)` and logs (not throws) on
      failure (B7)
- [x] Manual smoke check: start the backend against the real dev DB (`pnpm dev:backend`), create a
      note, `PATCH` it twice to generate versions 2/3, then exercise the full lifecycle via `curl`:
      list versions (newest-first, previews truncated), view an older version (full content, note
      unchanged), restore an older version (note content updated, new version appended, prior
      versions still individually viewable), soft-delete the note and confirm all three endpoints
      404. Clean up smoke-test data afterward.

**Checkpoint 3**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] `packages/shared/tests/unit/version.schemas.test.ts` — `VersionNumberParamSchema`: valid UUID
      `id` + positive int `versionNumber` (including numeric-string coercion), rejects non-UUID `id`,
      non-numeric/zero/negative/non-integer `versionNumber` (T1)
- [x] `apps/backend/tests/unit/versions.service.test.ts` — mocked `prisma.note`/`prisma.noteVersion`/
      `$transaction` per the `share.service.test.ts` `createMockPrisma()` pattern; covers
      `listVersions` (mapping + truncated preview, `NoteNotFoundError` for missing/foreign/
      soft-deleted), `getVersion` (success, `VersionNotFoundError`, `NoteNotFoundError` precedence),
      `restoreVersion` (updates title/content/`contentPlain`, creates version at `max + 1`, returns
      mapped `{note}`, both 404 error paths with no mutation), `purgeOldVersions` (only
      above-threshold notes trigger `findMany`/`deleteMany`, correct `where` args including the
      retained-`id` exclusion and cutoff, summed return count) (T2)
- [x] `apps/backend/tests/integration/versions.integration.test.ts` — full coverage of all 26
      `spec.md` scenarios against the real test DB (`createApp()`, `supertest`, `registerAndLogin`,
      `resetNotesTables()` — already truncates `noteVersion` before `note`, no setup changes needed):
      - List/view scenarios (1–13): generate real versions via existing `PATCH /api/notes/:id` calls
        (not seeded directly) then exercise `GET .../versions` and `GET .../versions/:n`, including
        preview truncation, not-found/foreign/soft-deleted/validation/unauthenticated cases
      - Restore scenarios (14–22): restore an older version, confirm via follow-up `GET /api/notes/:id`
        and `GET .../versions` that content updated, a new version was appended, and prior versions
        remain individually fetchable; not-found/foreign/soft-deleted/validation/unauthenticated cases
      - Auto-purge scenarios (23–26): call `purgeOldVersions(prisma)` directly (no HTTP route) after
        seeding `noteVersion` rows with explicit past `createdAt` timestamps via direct Prisma writes,
        across multiple notes to prove per-note isolation (T3)
- [x] No E2E (Playwright) tests — this ticket has no UI; the Version History Drawer (UX-SCR-012) is
      a later frontend ticket (AB-1015)

**Checkpoint 4 (final quality gate)**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirmed ≥80% coverage on all new/changed files — `src/modules/versions` at 100%
      stmts/branch/funcs/lines; overall backend coverage 99.59% (352 tests, up from 314); shared
      package 135 tests all green (up from 126)
- [x] Confirmed every Acceptance Criterion and Error Case in `spec.md` §3 has a passing test — all
      26 scenarios covered by `versions.integration.test.ts` (38 new backend tests total between
      unit + integration, plus 9 new shared schema tests), all passing on the first run
- [x] Confirmed the open items from `plan.md` §7:
      1. Prisma's generated compound-unique field name for `@@unique([noteId, versionNumber])` is
         exactly `noteId_versionNumber` — `findUnique({ where: { noteId_versionNumber: {...} } })`
         compiled with no adjustment needed
      2. `prisma.noteVersion.groupBy({ by: ['noteId'], _count: { id: true } })` compiled and returned
         `{ noteId, _count: { id: number } }[]` exactly as expected — no adjustment needed
      3. The 24-hour purge interval (no immediate startup run) was kept as planned — not
         independently re-confirmed with the user during this implementation pass, flagging as
         still-open if a different cadence is wanted
      4. `id: { notIn: retainedIds }` performs fine at `VERSION_MIN_RETAINED` (10) list size — no
         issue observed in the integration tests seeding up to 15 versions per note
