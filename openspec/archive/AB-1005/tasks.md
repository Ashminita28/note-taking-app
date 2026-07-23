# Task Checklist — AB-1005 (Backend Notes List: Pagination, Sorting, Filtering)

Sequenced from `openspec/tickets/AB-1005/plan.md`. File IDs (S*, B*, M*, T*) match the plan's
tables. No new Prisma models/migrations — `Note`, `Tag`, `NoteTag` and their indexes already exist
from AB-1001; this ticket extends AB-1004's existing `notes` module rather than creating a new one.

Outstanding decisions carried from the plan, treated as final unless flagged before implementation
starts: `tagIds` is a single comma-separated query param (Architecture Decision 1);
`includeTrashed=true` returns a trash-only view, not merged active+trash (Architecture Decision 2);
`id asc` is the pagination tie-breaker (Architecture Decision 3); tag AND-filtering uses Prisma's
query builder (ANDed `some` conditions), never raw SQL (Architecture Decision 4); validated query
params are stashed on a new `req.validatedQuery`, not reassigned onto `req.query`, because Express 5
makes `req.query` a getter-only property (Architecture Decision 5).

### Phase 1 — Foundation (shared contracts, cross-cutting middleware)

- [x] Add `as const` to `DEFAULT_SORT_BY` and `DEFAULT_SORT_ORDER` in
      `packages/shared/src/constants/defaults.ts` (S1)
- [x] Write `packages/shared/src/schemas/common.schemas.ts` — `PaginationMetaSchema` (S2)
- [x] Write `packages/shared/src/types/common.types.ts` — `PaginationMeta` (S3)
- [x] Update `packages/shared/src/schemas/note.schemas.ts` — `NOTE_SORT_FIELDS`, `SORT_ORDERS`,
      `commaSeparatedUuidList` helper, `ListNotesQuerySchema`, `ListNotesResponseSchema` (S4)
- [x] Update `packages/shared/src/types/note.types.ts` — `ListNotesQuery`, `ListNotesResponse`,
      `NoteSortField` (S5)
- [x] Add `validatedQuery?: unknown;` to the `Request` augmentation in
      `apps/backend/src/types/express.d.ts` (B1)
- [x] Add `validateQuery(schema)` to `apps/backend/src/middleware/validate.ts`, alongside the
      existing `validateBody`/`validateParams` — sets `req.validatedQuery`, never reassigns
      `req.query` (B2)
- [x] Confirm no DB migration is needed — `Note`/`Tag`/`NoteTag` and the `[userId, deletedAt]` /
      `[userId, updatedAt desc]` indexes already exist (`schema.prisma`, delivered by AB-1001)

**Checkpoint 1**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 2 — Core implementation (service layer)

- [x] Update `apps/backend/src/modules/notes/notes.service.ts` — add `listNotes(prisma, userId,
      query)`: dedupe `tagIds`, resolve to owned tags via the existing `resolveOwnedTagIds`
      (short-circuit to an empty page if any requested tag id doesn't resolve), build the
      `deletedAt`/AND-tag `where` clause, apply `[{[sortBy]: sortOrder}, {id: 'asc'}]` ordering, run
      `findMany` + `count` in one `$transaction`, map results via the existing `toNoteResponse` (M1)

**Checkpoint 2**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 3 — Integration (controller/router wiring)

- [x] Update `apps/backend/src/modules/notes/notes.controller.ts` — add `listNotesHandler`, reading
      `req.validatedQuery` (M2)
- [x] Update `apps/backend/src/modules/notes/notes.router.ts` — add `GET /` with `requireAuth` +
      `validateQuery(ListNotesQuerySchema)` + `listNotesHandler` (M3)
- [x] Manual smoke check: `pnpm dev:backend` + create a handful of notes (with/without tags, one
      soft-deleted) via existing endpoints, then `curl`/Postman `GET /api/notes` with combinations of
      `page`, `pageSize`, `sortBy`, `sortOrder`, `tagIds`, `includeTrashed` against the running dev
      server (requires a valid access token from `POST /api/auth/login`)

**Checkpoint 3**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] `packages/shared/tests/unit/note.schemas.test.ts` — `ListNotesQuerySchema`: defaults applied
      when omitted; `page`/`pageSize` coerced and bounds-checked (`page=0`, `pageSize=101` rejected);
      `sortBy`/`sortOrder` reject out-of-enum values; `tagIds` comma-string → UUID array, rejects a
      non-UUID segment; `includeTrashed` `"true"`/`"false"` → boolean, anything else rejected (S6)
- [x] `apps/backend/tests/unit/validate.middleware.test.ts` — add `validateQuery` cases: valid query
      passes through with defaults applied to `req.validatedQuery`; invalid query → `ValidationError`;
      `req.query` itself is left untouched (B3)
- [x] `apps/backend/tests/unit/notes.service.test.ts` — add a `listNotes` describe block against a
      mocked Prisma client: default pagination args, custom page/pageSize, `orderBy` includes the
      `id: 'asc'` tie-break, `deletedAt` filter flips for `includeTrashed`, single/multi tag AND
      where-clause shape, foreign/nonexistent tag id short-circuits to empty without calling
      `note.findMany`, empty-database → `totalPages: 0` (T1)
- [x] `apps/backend/tests/integration/notes.integration.test.ts` — add a `GET /api/notes` describe
      block against the real test DB (`docker compose up -d` required): default pagination, explicit
      page/pageSize, all 6 `sortBy`×`sortOrder` combinations, tie-break determinism (two notes with
      identical `updatedAt`), single-tag filter, multi-tag AND filter (confirm an OR-only match is
      excluded), non-owned/nonexistent tag id → empty `data`, soft-deleted excluded by default,
      `includeTrashed=true` trash-only view, empty-notes case, cross-user isolation, `422` for bad
      `page`/`pageSize`/`sortBy`/`sortOrder`/malformed `tagIds`, `401` unauthenticated (T2)
- [x] No E2E (Playwright) tests — this ticket has no UI; AB-1011 covers the frontend Dashboard /
      Notes List

**Checkpoint 4 (final quality gate)**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirm ≥80% coverage on all new/changed files in `apps/backend/src` and `packages/shared/src`
- [x] Confirm every Acceptance Criterion and Error Case in `spec.md` §3 has a passing test
