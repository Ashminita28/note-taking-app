# Task Checklist — AB-1007 (Backend Full-Text Search)

Sequenced from `openspec/tickets/AB-1007/plan.md`. File IDs (S*, B*, T*) match the plan's file
lists. No new Prisma models/migrations — `searchVector`, its GIN index, and its update trigger
already exist from AB-1004; this ticket creates a brand-new `search` module (router/controller/
service, no `search.errors.ts` needed since it has no domain-specific error codes) and is the
**first** feature in the codebase to use raw SQL (`prisma.$queryRaw` with `Prisma.sql`/`Prisma.join`
composition) — pre-approved as the sole exception to "no raw SQL" per `apps/backend/CLAUDE.md`.

Decisions carried from the plan, treated as final unless flagged during implementation: `tagIds`
reuses AB-1005's exact comma-separated-UUID-list wire format (Architecture Decision 1); the raw
query is two `$queryRaw` calls (data + count) sharing one `buildWhereFragment` helper so they can
never disagree on matching rows (Decision 2); `ts_headline` cost is accepted as-is, no additional
content-length cap beyond the existing 500KB `NOTE_CONTENT_MAX_SIZE_BYTES` (Decision 3); tag
AND-logic is expressed as `HAVING COUNT(DISTINCT "tagId") = N` rather than Prisma-builder `AND`
arrays, since raw SQL composes differently from `notes.service.ts`'s approach (Decision 4); no
`resolveOwnedTagIds` pre-check — a foreign/unowned `tagId` naturally yields zero matches under the
outer `userId` scope (flagged in plan §7 item 1 to confirm during implementation, not to redesign
speculatively).

**Implementation deviation from the plan (discovered via integration test failures, not
speculative):** `buildWhereFragment`'s original draft compared `n."userId" = ${userId}` and
`"tagId" IN (${Prisma.join(query.tagIds)})` with bare string parameters. Postgres rejected this —
`ERROR: operator does not exist: uuid = text` — since `userId`/`tagId` are `uuid` columns and
`$queryRaw` binds JS strings as `text` parameters with no implicit cast. Fixed by adding explicit
casts: `n."userId" = ${userId}::uuid` and `"tagId"::text IN (${Prisma.join(query.tagIds)})` (casting
the column to `text` here instead of casting each interpolated tag id, since the tag ids are
already Zod-validated UUID strings). This resolves plan §7 item 2's concern about `Prisma.join`
usage as a side effect — it was never the empty-array case that was the bug.

**Test-authoring pitfall found and fixed (not a service-code bug):** the Scenario 13 `it.each`
validation-table test originally built its throwaway user email as
`` `search-invalid-${field}-${queryString}@example.com` ``, embedding raw query strings like
`page=-1` into the local part. `AccessTokenPayloadSchema`'s `z.string().email()` (in
`packages/shared/src/schemas/auth.schemas.ts`) rejects the `=` character, so `verifyAccessToken`
failed schema validation and `requireAuth` returned `401 TOKEN_INVALID` instead of ever reaching
`validateQuery` — a false failure caused by the test's own fixture data, not the search endpoint.
Fixed by sanitizing the email local part: `queryString.replace(/[^a-zA-Z0-9]/g, '-')`.

Plan §7 items 1 and 3 were confirmed with no further changes needed: a foreign/unowned `tagId`
naturally yields zero matches (the `HAVING COUNT` subquery only reads real `NoteTag` rows, and the
outer `userId` scope already prevents cross-user leakage regardless), and `ts_rank`'s Postgres
`real` return type deserializes cleanly to a JS `number` via `$queryRaw` with no extra conversion
needed (unlike the `bigint` count, which does need `Number()`).

### Phase 1 — Foundation (shared contracts)

- [x] Write `packages/shared/src/schemas/search.schemas.ts` — replace the `export {};` placeholder
      with `commaSeparatedUuidList` (mirrors AB-1005's), `SearchQuerySchema` (`q` trimmed/required
      1–200 chars, `page`/`pageSize` with existing `PAGE_MIN`/`PAGE_SIZE_MIN`/`PAGE_SIZE_MAX`
      defaults, optional `tagIds`), `SearchResultSchema` (`id`, `title`, `snippet`, `rank`,
      `createdAt`, `updatedAt`), `SearchResponseSchema` (`data` + `PaginationMetaSchema`) (S1)
- [x] Write `packages/shared/src/types/search.types.ts` — replace the `export {};` placeholder with
      `SearchQuery`, `SearchResult`, `SearchResponse`, all `z.infer` from S1's schemas (S2)
- [x] Confirm no changes needed to `packages/shared/src/index.ts` (barrel already re-exports
      `search.schemas.js`/`search.types.js` at lines 8 and 17), `constants/limits.ts`
      (`SEARCH_QUERY_MIN_LENGTH`/`SEARCH_QUERY_MAX_LENGTH`/`PAGE_MIN`/`PAGE_SIZE_MIN`/
      `PAGE_SIZE_MAX` already exist), or `constants/defaults.ts` (`DEFAULT_PAGE`/
      `DEFAULT_PAGE_SIZE` already exist)
- [x] Confirm no DB migration is needed — `searchVector`, `idx_note_search_vector` GIN index, and
      the `note_search_vector_update` trigger already exist (delivered by AB-1004, migration
      `20260722081152_search_vector`)

**Checkpoint 1** — passed (94 shared tests, then 112 after Phase 4's schema tests were added)
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
```

### Phase 2 — Core implementation (service layer)

- [x] Write `apps/backend/src/modules/search/search.service.ts` — `buildWhereFragment` (shared
      `Prisma.Sql` fragment: user scope, non-deleted, `searchVector @@ plainto_tsquery`, optional
      tag `HAVING COUNT(DISTINCT "tagId") = N` subquery guarded so `Prisma.join` is never called on
      an empty array), `searchNotes` (two `$queryRaw` calls — ranked/highlighted page data via
      `ts_rank`/`ts_headline`, and a `COUNT(*)` for `totalItems` — both built from the same
      `buildWhereFragment` output; bigint count converted via `Number()`; secondary `id ASC` sort
      after `rank DESC` for deterministic pagination, mirroring `notes.service.ts`'s tie-breaker
      convention) (B1). Required explicit `::uuid`/`::text` casts — see deviation note above.
- [x] No `search.errors.ts` — confirmed the endpoint has no domain-specific error codes (only
      `VALIDATION_ERROR` from Zod and `TOKEN_*` from `requireAuth`, both already wired centrally)

**Checkpoint 2** — passed
```
pnpm --filter @note-app/backend build
pnpm --filter @note-app/backend lint --max-warnings 0
```

### Phase 3 — Integration (controller/router wiring)

- [x] Write `apps/backend/src/modules/search/search.controller.ts` — `searchNotesHandler` (thin:
      pulls `req.userId`/`req.validatedQuery`, calls `searchNotes`, `res.status(200).json(result)`)
      (B2)
- [x] Write `apps/backend/src/modules/search/search.router.ts` — `GET /` with `requireAuth` +
      `validateQuery(SearchQuerySchema)` (B3)
- [x] Update `apps/backend/src/app.ts` — import and mount `searchRouter` at `/api/search`; update
      the "Further feature routes..." comment to reference AB-1008 onward (B4)
- [x] Manual smoke check skipped in favor of the full `search.integration.test.ts` suite (T2), which
      exercises the endpoint against the real test DB through the actual HTTP layer

**Checkpoint 3** — passed (full repo build/lint/test green, 243 backend tests at this point)
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] `packages/shared/tests/unit/search.schemas.test.ts` — `SearchQuerySchema`: `q` missing/empty/
      whitespace-only rejected, `q` >200 chars rejected, `q` trimmed, `page`/`pageSize` default and
      coerce-from-string, `pageSize` >100 rejected, `page` 0/negative/non-integer rejected,
      `tagIds` comma-separated parses to UUID array, malformed `tagIds` entry rejected (S3) — 18
      tests
- [x] `apps/backend/tests/unit/search.service.test.ts` — mock `prisma.$queryRaw` directly (tagged-
      template call interception); assert response shape mapping (bigint `count` → `Number`, `Date`
      → ISO string), `totalItems === 0` → `totalPages: 0`, tag-filter fragment present vs. absent
      changes the query, both `$queryRaw` calls (data + count) invoked once per `searchNotes` call
      (T1) — 6 tests
- [x] `apps/backend/tests/integration/search.integration.test.ts` — added a local
      `createSearchableNoteDirect` helper (sets `contentPlain` explicitly via `prisma.note.create`
      so the AB-1004 trigger populates `searchVector` realistically, following
      `notes.integration.test.ts`'s `createNoteDirect` precedent) plus reuse of `resetNotesTables`/
      `registerAndLogin` from `tests/integration/setup.ts`; one extra test creates a note via the
      real `POST /api/notes` endpoint to confirm the full create→search round-trip. Full coverage of
      all 16 spec scenarios: title match, content match, stemming (Scenarios 1–3); rank ordering
      with title-weight beating content-weight, asserting array order not just membership (Scenario
      4); no-results shape (Scenario 5); tag-filter AND logic (Scenario 6); pagination across two
      pages with consistent ranking (Scenario 7); soft-deleted exclusion (Scenario 8); cross-user
      isolation (Scenario 9); validation table for missing/empty/whitespace/too-long `q`, bad
      `page`/`pageSize`, malformed `tagIds` → all `422 VALIDATION_ERROR` (Scenarios 10–14, the
      `page`/`pageSize` table required the email-sanitization fix noted above); special characters
      (`&`, `|`, `:`, `!`) in `q` → `200` not `500`, proving parameterized binding, not string
      interpolation (Scenario 15); unauthenticated → `401` (Scenario 16) (T2) — 22 tests
- [x] No E2E (Playwright) tests — this ticket has no UI; AB-1011/1012 cover the frontend Search
      Results screen (UX-SCR-009) and Dashboard search input (UX-SCR-006)

**Checkpoint 4 (final quality gate)** — passed
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirm ≥80% coverage on all new/changed files in `apps/backend/src/modules/search` and
      `packages/shared/src/{schemas,types}/search.*` — `src/modules/search` is at 100%
      stmts/funcs/lines, 90% branch (`search.service.ts` 88.88% branch — the single uncovered branch
      is the `countRows[0]?.count ?? 0n` defensive fallback, unreachable since `COUNT(*)` always
      returns exactly one row); overall backend coverage 99.47%
- [x] Confirm every Acceptance Criterion and Error Case in `spec.md` §3 has a passing test — all 16
      scenarios covered by `search.integration.test.ts` (271 backend tests total, all green)
- [x] Confirm the three open items from `plan.md` §7 were checked during implementation — see the
      deviation notes above: item 1 (foreign `tagId` behavior) and item 3 (`ts_rank` → JS `number`
      deserialization) needed no code changes; item 2 (`Prisma.join`/empty-array guard) was
      superseded by the real bug found (missing `::uuid`/`::text` casts), which was fixed instead
