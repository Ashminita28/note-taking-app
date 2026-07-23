# Task Checklist — AB-1006 (Backend Tags CRUD + Note Counts)

Sequenced from `openspec/tickets/AB-1006/plan.md`. File IDs (S*, B*, T*) match the plan's tables.
No new Prisma models/migrations — `Tag` and `NoteTag` and their indexes already exist from AB-1001;
this ticket creates a brand-new `tags` module (router/controller/service/errors), unlike AB-1005
which extended an existing module.

Outstanding decisions carried from the plan, treated as final unless flagged before implementation
starts: case-insensitive name uniqueness is enforced with an app-level `mode: 'insensitive'`
pre-check, not a `citext`/raw-SQL migration (Architecture Decision 2). **Implementation deviation
from the plan:** the `P2002` catch as a race-condition safety net was dropped — `auth.service.ts`'s
`registerUser` (the codebase's existing precedent for the identical case-insensitive-uniqueness race
trade-off, for email/BR-001) only does a pre-check with no `P2002` catch at all, so `tags.service.ts`
was written the same way for consistency, accepting the same narrow race window rather than adding
asymmetric defense-in-depth the rest of the codebase doesn't have. Note counts use Prisma's filtered
`_count` (Architecture Decision 4); `DELETE /api/tags/:id` is a real hard delete, cascading `NoteTag`
via the existing FK — the soft-delete rule (CON-007) governs notes only, not tags (Architecture
Decision 6); `registerAndLogin` moves from `notes.integration.test.ts` into shared
`tests/integration/setup.ts` (Architecture Decision 7).

### Phase 1 — Foundation (shared contracts)

- [x] Write `packages/shared/src/schemas/tag.schemas.ts` — `trimmedTagName`, `HEX_COLOR_PATTERN` +
      `hexColorSchema`, `CreateTagRequestSchema` (color defaults to `DEFAULT_TAG_COLOR`),
      `UpdateTagRequestSchema`, `TagResponseSchema`, `TagWithCountSchema`, `ListTagsResponseSchema`,
      `DeleteTagResponseSchema`, `TagIdParamSchema` (S1)
- [x] Write `packages/shared/src/types/tag.types.ts` — `CreateTagRequest`, `UpdateTagRequest`,
      `TagResponse`, `TagWithCount`, `ListTagsResponse`, `DeleteTagResponse`, `TagIdParam`, all
      `z.infer` from S1's schemas (S2)
- [x] Confirm no changes needed to `packages/shared/src/index.ts` (barrel already re-exports
      `tag.schemas.js`/`tag.types.js`), `constants/limits.ts` (`TAG_NAME_MIN/MAX_LENGTH` already
      exist), or `constants/defaults.ts` (`DEFAULT_TAG_COLOR` already exists)
- [x] Confirm no DB migration is needed — `Tag`/`NoteTag`, `@@unique([userId, name])`, and
      `onDelete: Cascade` FKs already exist (`schema.prisma`, delivered by AB-1001)

**Checkpoint 1**
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
```

### Phase 2 — Core implementation (service layer)

- [x] Write `apps/backend/src/modules/tags/tags.errors.ts` — `TagNameExistsError`,
      `TagNotFoundError` (B1)
- [x] Write `apps/backend/src/modules/tags/tags.service.ts` — `toTagResponse`,
      `assertNameAvailable` (case-insensitive pre-check with `excludeId` support), `createTag`,
      `listTags` (filtered `_count`), `updateTag`, `deleteTag` (B2). No `isUniqueConstraintError`/
      `P2002` catch — dropped per the deviation noted above.

**Checkpoint 2**
```
pnpm --filter @note-app/backend build
pnpm --filter @note-app/backend lint --max-warnings 0
```

### Phase 3 — Integration (controller/router wiring)

- [x] Write `apps/backend/src/modules/tags/tags.controller.ts` — `listTagsHandler`,
      `createTagHandler`, `updateTagHandler`, `deleteTagHandler` (B3)
- [x] Write `apps/backend/src/modules/tags/tags.router.ts` — `GET /`, `POST /`, `PATCH /:id`,
      `DELETE /:id`, each with `requireAuth` + the matching `validateBody`/`validateParams` (B4)
- [x] Update `apps/backend/src/app.ts` — mount `tagsRouter` at `/api/tags` (B5)
- [x] Manual smoke check skipped in favor of the full `tags.integration.test.ts` suite (T4), which
      exercises every endpoint against the real test DB through the actual HTTP layer — equivalent
      coverage to a curl/Postman smoke check, run automatically at every checkpoint

**Checkpoint 3**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] `packages/shared/tests/unit/tag.schemas.test.ts` — `CreateTagRequestSchema`: with/without
      color (default applied), name trimmed, empty/whitespace name rejected, name >50 chars
      rejected, malformed color rejected; `UpdateTagRequestSchema`: all-optional, partial updates,
      still validates provided fields; `TagIdParamSchema`: valid/invalid UUID (S3) — 21 tests
- [x] Move `registerAndLogin` into `apps/backend/tests/integration/setup.ts`; update
      `notes.integration.test.ts` to import it from there instead of defining it locally (T1, T2)
- [x] `apps/backend/tests/unit/tags.service.test.ts` — mocked-Prisma tests for `createTag`
      (happy path, pre-check duplicate → `TagNameExistsError`), `listTags` (`orderBy: {name: 'asc'}`,
      filtered `_count` shape, `noteCount` mapping, empty list), `updateTag` (not-found →
      `TagNotFoundError`, partial-field updates only send changed fields, `excludeId` passed on
      rename, conflict → `TagNameExistsError`), `deleteTag` (not-found → `TagNotFoundError`, success
      message) (T3) — 13 tests. No `P2002` case, per the dropped safety net.
- [x] `apps/backend/tests/integration/tags.integration.test.ts` — full endpoint coverage of all 29
      spec scenarios against the real test DB (`docker compose up -d` required): `POST /api/tags`
      create variants, case-insensitive `409`, `422` validation cases, whitespace trimming, per-user
      scoping, `401`; `GET /api/tags` note-count accuracy (soft-deleted excluded), zero-note tags,
      alphabetical order, empty list, cross-user isolation, `401`; `PATCH /api/tags/:id` field
      combinations, association preservation on rename, self-rename case-variant no-conflict, `404`
      not-found/foreign-owned, `409` conflict, `422`, `401`; `DELETE /api/tags/:id` cascade
      confirmation (note itself untouched), `404` not-found/foreign-owned, `401` (T4) — 29 tests
- [x] No E2E (Playwright) tests — this ticket has no UI; AB-1011/1012 cover the frontend Tag
      Management Modal and Dashboard sidebar

**Checkpoint 4 (final quality gate)**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirm ≥80% coverage on all new/changed files in `apps/backend/src` and `packages/shared/src`
      — `src/modules/tags` is at 100% stmts/branch/funcs/lines; overall backend coverage 99.44%
- [x] Confirm every Acceptance Criterion and Error Case in `spec.md` §3 has a passing test — all 29
      scenarios covered by `tags.integration.test.ts`
