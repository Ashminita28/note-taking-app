# Technical Plan — AB-1005 (Backend Notes List: Pagination, Sorting, Filtering)

Traces every file to a scenario in `openspec/tickets/AB-1005/spec.md`. Follows the layered
architecture (Router → Validation → Controller → Service → Prisma) and module structure
(`<name>.router/controller/service/errors.ts`) defined in `apps/backend/CLAUDE.md`. Extends the
existing `notes` module (created by AB-1004) rather than creating a parallel one.

## 0. Architecture Decisions

Resolves the four open questions raised in `spec.md` §5, plus two implementation-driven decisions
discovered while reading the current codebase state:

1. **`tagIds` wire format (spec open question 1, resolved): single comma-separated query param.**
   `?tagIds=t1,t2` — not repeated params (`?tagIds=t1&tagIds=t2`). Keeps the query schema a flat
   `z.string()` transform (`split(',').map(trim).filter(Boolean)` piped into `z.array(uuid())`)
   consistent with how `page`/`sortBy`/etc. are single scalar params, and avoids Express's
   inconsistent single-value-vs-array query parsing depending on param repetition.
2. **`includeTrashed=true` is a trash-only view, not merged active+trash** (spec open question 2,
   confirmed): matches UX-SCR-006's "toggle trash view" control (`docs/UX.md` §8.6) and FRS AF-2
   ("user requests trashed notes only"). `deletedAt: null` when `false` (default), `deletedAt: {not:
   null}` when `true` — never both in one response.
3. **Tie-breaker is `id asc`** (spec open question 3, confirmed): appended as a second `orderBy`
   entry after the requested `sortBy`/`sortOrder` on every query, so pagination is stable even when
   multiple notes share the same `sortBy` value.
4. **AND-tag-filter strategy must use Prisma's query builder, not raw SQL** (spec open question 4,
   resolved): `apps/backend/CLAUDE.md` prohibits raw SQL except for full-text search (AB-1007), which
   rules out a `HAVING COUNT(DISTINCT tagId) = N` raw query. Instead: dedupe the requested tag ids,
   resolve them to the subset actually owned by the user (reusing `resolveOwnedTagIds`, already in
   `notes.service.ts` from AB-1004), and if any requested id doesn't resolve (nonexistent or
   foreign-owned — Scenario 9), short-circuit to an empty page without querying `Note` at all (a
   note's tags always belong to the same user as the note, per AB-1004's tag-resolution invariant, so
   a foreign/unknown tag id can never match). Otherwise build `AND: ownedTagIds.map(tagId => ({tags:
   {some: {tagId}}}))` — N ANDed `some` existence checks, one per required tag, which is exactly "has
   all of these tags" (Scenario 7).
5. **`req.query` is read-only in Express 5 — cannot reuse the `validateBody`/`validateParams`
   reassignment pattern as-is.** `node_modules/express/lib/request.js` defines `query` via
   `defineGetter` with no setter (computed from `req.originalUrl` and memoized) — `req.query =
   result.data` throws `TypeError: Cannot set property query of #<IncomingMessage> which has only a
   getter` under ESM strict mode. New `validateQuery` middleware instead stashes the parsed/defaulted
   query on a new `req.validatedQuery` property (mirroring the existing `req.userId` augmentation in
   `types/express.d.ts`), which the controller reads. `req.query` itself is left untouched.
6. **`DEFAULT_SORT_BY`/`DEFAULT_SORT_ORDER` need `as const`.** Currently plain `string`-typed exports
   in `constants/defaults.ts` (unused until now). Zod's `.default(DEFAULT_SORT_BY)` on a
   `z.enum(['createdAt','updatedAt','title'])` schema requires the literal union type, not `string` —
   without `as const` this is a type error, not a runtime issue.
7. **No DB schema changes.** `Note`, `Tag`, `NoteTag` already exist (SDS §15, delivered by AB-1001);
   the existing indexes (`@@index([userId, deletedAt])`, `@@index([userId, updatedAt(sort: Desc)])`)
   cover the default list query. No migration in this ticket.
8. **`listNotes` runs `findMany` + `count` in one `$transaction`** (read-only, array form) so the
   returned page and `totalItems` reflect the same snapshot even under concurrent writes — consistent
   with AB-1004's use of `$transaction` for multi-step Prisma operations.

## 1. `packages/shared` — Contracts

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| S1 | `packages/shared/src/constants/defaults.ts` | Mod | Add `as const` to `DEFAULT_SORT_BY` and `DEFAULT_SORT_ORDER` (Architecture Decision 6) — values unchanged (`'updatedAt'`, `'desc'`). |
| S2 | `packages/shared/src/schemas/common.schemas.ts` | Mod | Replace `export {}` stub with `PaginationMetaSchema`: `{page: z.number().int(), pageSize: z.number().int(), totalItems: z.number().int(), totalPages: z.number().int()}` (SDS §18.2) — shared shape, reused by AB-1007's search response later. |
| S3 | `packages/shared/src/types/common.types.ts` | Mod | Replace `export {}` stub with `PaginationMeta = z.infer<typeof PaginationMetaSchema>`. |
| S4 | `packages/shared/src/schemas/note.schemas.ts` | Mod | Add: `NOTE_SORT_FIELDS = ['createdAt', 'updatedAt', 'title'] as const`; `SORT_ORDERS = ['asc', 'desc'] as const`; a `commaSeparatedUuidList` helper (`z.string().transform(v => v.split(',').map(s => s.trim()).filter(Boolean)).pipe(z.array(z.string().uuid()))`); `ListNotesQuerySchema` (`page` — `z.coerce.number().int().min(PAGE_MIN).optional().default(DEFAULT_PAGE)`; `pageSize` — `z.coerce.number().int().min(PAGE_SIZE_MIN).max(PAGE_SIZE_MAX).optional().default(DEFAULT_PAGE_SIZE)`; `sortBy` — `z.enum(NOTE_SORT_FIELDS).optional().default(DEFAULT_SORT_BY)`; `sortOrder` — `z.enum(SORT_ORDERS).optional().default(DEFAULT_SORT_ORDER)`; `tagIds` — `commaSeparatedUuidList.optional()`; `includeTrashed` — `z.enum(['true','false']).optional().default('false').transform(v => v === 'true')`); `ListNotesResponseSchema` (`{data: z.array(NoteResponseSchema), pagination: PaginationMetaSchema}`, importing `PaginationMetaSchema` from `./common.schemas.js`). |
| S5 | `packages/shared/src/types/note.types.ts` | Mod | Add `ListNotesQuery = z.infer<typeof ListNotesQuerySchema>`, `ListNotesResponse = z.infer<typeof ListNotesResponseSchema>`, `NoteSortField = (typeof NOTE_SORT_FIELDS)[number]`. |
| S6 | `packages/shared/tests/unit/note.schemas.test.ts` | Mod | Add a `ListNotesQuerySchema` describe block: defaults applied when all params omitted; `page`/`pageSize` coerced from query-string values and bounds-checked (`page=0`, `pageSize=101` rejected); `sortBy`/`sortOrder` reject values outside the enum; `tagIds` comma-string parses to a UUID array, rejects a non-UUID segment; `includeTrashed` `"true"`/`"false"` transform to booleans, anything else rejected. |

`index.ts` barrel already re-exports `./schemas/common.schemas.js`, `./types/common.types.js`,
`./schemas/note.schemas.js`, and `./types/note.types.js` — no barrel changes needed.

## 2. `apps/backend` — Cross-Cutting Additions

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| B1 | `apps/backend/src/types/express.d.ts` | Mod | Add `validatedQuery?: unknown;` to the `Request` interface augmentation, alongside the existing `userId?: string;` (Architecture Decision 5). |
| B2 | `apps/backend/src/middleware/validate.ts` | Mod | Add `validateQuery(schema: ZodType)` alongside `validateBody`/`validateParams` — parses `req.query`, forwards a `ValidationError` on failure, otherwise sets `req.validatedQuery = result.data` (never reassigns `req.query` itself) and calls `next()`. |
| B3 | `apps/backend/tests/unit/validate.middleware.test.ts` | Mod | Add cases for `validateQuery`: valid query passes through and populates `req.validatedQuery` with defaults applied; invalid query (e.g. bad `sortBy`) calls `next` with a `ValidationError`; confirms `req.query` itself is left untouched. |

## 3. `apps/backend/src/modules/notes` — Feature Module (extends AB-1004's files)

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| M1 | `apps/backend/src/modules/notes/notes.service.ts` | Mod | Add `listNotes(prisma, userId, query: ListNotesQuery): Promise<ListNotesResponse>` (details below). Reuses the existing private `resolveOwnedTagIds` and `toNoteResponse`/`NOTE_WITH_TAGS_INCLUDE` already in this file — no duplication. |
| M2 | `apps/backend/src/modules/notes/notes.controller.ts` | Mod | Add `listNotesHandler(req, res)`: calls `listNotes(prisma, req.userId as string, req.validatedQuery as ListNotesQuery)`, responds `200` with the result as-is (already shaped `{data, pagination}`). |
| M3 | `apps/backend/src/modules/notes/notes.router.ts` | Mod | Add `router.get('/', requireAuth, validateQuery(ListNotesQuerySchema), listNotesHandler);` before the existing `GET /:id` route (no path-matching conflict — `/` vs. `/:id` are distinct patterns — ordered for readability only). |

**`listNotes` implementation detail:**

```
1. Dedupe query.tagIds (Set) if present.
2. If tagIds present and non-empty:
     ownedTagIds = await resolveOwnedTagIds(prisma, userId, dedupedTagIds)
     if ownedTagIds.length !== dedupedTagIds.length:
       return { data: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } }  // Scenario 9
   else ownedTagIds = []
3. baseWhere = { userId, deletedAt: query.includeTrashed ? { not: null } : null }  // Scenarios 10, 11
4. where = ownedTagIds.length > 0
     ? { ...baseWhere, AND: ownedTagIds.map(tagId => ({ tags: { some: { tagId } } })) }  // Scenario 7
     : baseWhere
5. orderBy = [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }]  // Scenarios 4, 5
6. [notes, totalItems] = await prisma.$transaction([
     prisma.note.findMany({ where, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: NOTE_WITH_TAGS_INCLUDE }),
     prisma.note.count({ where }),
   ])
7. totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize)
8. return { data: notes.map(toNoteResponse), pagination: { page: query.page, pageSize: query.pageSize, totalItems, totalPages } }
```

Covers Scenarios 1–13 (pagination, sorting incl. tie-break, tag AND-filtering incl. the
foreign/nonexistent-tag short-circuit, trash view, empty list, user-scoping via `WHERE userId`).
Scenarios 14–18 (validation/auth errors) are fully handled by `validateQuery`/`requireAuth` before
`listNotes` ever runs — no additional error classes needed in `notes.errors.ts`.

## 4. Tests — `apps/backend`

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| T1 | `apps/backend/tests/unit/notes.service.test.ts` | Mod | Add a `listNotes` describe block with a mocked Prisma client (`$transaction` returning `[notes, count]`, spies on `findMany`/`count`/`tag.findMany` args): default pagination args passed to Prisma, custom page/pageSize, orderBy includes the `id: 'asc'` tie-break, `deletedAt` filter flips correctly for `includeTrashed`, single/multi tag `AND` where-clause shape, foreign-tag-id short-circuits to empty without calling `note.findMany`, empty-database case returns `totalPages: 0`. |
| T2 | `apps/backend/tests/integration/notes.integration.test.ts` | Mod | Add a `GET /api/notes` describe block covering every spec scenario end-to-end against the real test DB: default pagination, explicit page/pageSize, all 6 `sortBy`×`sortOrder` combinations, tie-break determinism (seed two notes with identical `updatedAt`), single-tag filter, multi-tag AND filter (verify OR-would-differ case `n2`/`n3` are excluded), non-owned/nonexistent tag id → empty `data`, soft-deleted excluded by default, `includeTrashed=true` trash-only view, empty-notes case, cross-user isolation (user A never sees user B's notes), `422` for bad `page`/`pageSize`/`sortBy`/`sortOrder`/malformed `tagIds`, `401` unauthenticated. Reuses `registerAndLogin`/`createTag` helpers already in this file. |

No changes needed to `tests/integration/setup.ts` — `resetNotesTables` already truncates
`Note`/`Tag`/`NoteTag` (and everything FK-dependent on them).

## 5. Build / Lint / Test Checkpoints

Run after `packages/shared` changes (S-block), before touching backend:
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
```

Run after backend cross-cutting + module changes (B/M blocks):
```
docker compose up -d
pnpm --filter @note-app/backend build
pnpm --filter @note-app/backend lint --max-warnings 0
pnpm --filter @note-app/backend test
```

Final full-monorepo gate (CLAUDE.md mandatory quality gates) before commit:
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```
Confirm ≥80% coverage on all new/modified files (`pnpm --filter @note-app/backend test:coverage`,
`pnpm --filter @note-app/shared test`).

## 6. Out of Scope (unchanged from spec.md)

- All note CRUD (`POST /api/notes`, `GET /api/notes/:id`, `PATCH /api/notes/:id`, `DELETE
  /api/notes/:id`, `POST /api/notes/:id/restore`) — AB-1004, already implemented, untouched by this
  plan except for reusing `resolveOwnedTagIds`/`toNoteResponse`.
- Tags CRUD, tag validation, per-tag note counts — AB-1006.
- `GET /api/search` — AB-1007.
- Sharing endpoints — AB-1008.
- Version history endpoints — AB-1009.
- Frontend Dashboard / Notes List UI (UX-SCR-006) — AB-1011.
