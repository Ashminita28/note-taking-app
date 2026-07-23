# AB-1007 — Backend Full-Text Search: Implementation Plan

## 1. Summary

Implement `GET /api/search` following the existing module layering (router → validate → controller → service). No new Prisma models/migrations — `searchVector`, its GIN index, and its update trigger already exist from AB-1004. This is the **first** feature to use raw SQL (`prisma.$queryRaw` with `Prisma.sql`/`Prisma.join` composition), which `apps/backend/CLAUDE.md` pre-approves as the sole exception to "no raw SQL."

Resolved open questions from `spec.md`:
1. **`tagIds` wire format:** reuse AB-1005's exact decision — single comma-separated query param (`?tagIds=t1,t2`), via the same `commaSeparatedUuidList` pattern.
2. **Raw query structure:** two raw queries sharing the same `WHERE`/`FROM` fragment — one `SELECT ... ts_rank ... ts_headline ... ORDER BY rank DESC LIMIT/OFFSET` for page data, one `SELECT COUNT(*)` for `totalItems`. Composed with `Prisma.sql` fragments, not string concatenation.
3. **`ts_headline` performance:** accepted as-is (`contentPlain` is capped at `NOTE_CONTENT_MAX_SIZE_BYTES` = 500KB already, per AB-1004; no additional cap needed for this ticket).
4. **Injection safety:** all dynamic values (`q`, `userId`, `tagIds`) passed as `Prisma.sql` template parameters, never interpolated into the SQL string.

## 2. Files to Create

### `packages/shared/src/schemas/search.schemas.ts` (currently `export {};` placeholder — replace)
```ts
import { z } from 'zod';
import { SEARCH_QUERY_MIN_LENGTH, SEARCH_QUERY_MAX_LENGTH, PAGE_MIN, PAGE_SIZE_MIN, PAGE_SIZE_MAX } from '../constants/limits.js';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../constants/defaults.js';
import { PaginationMetaSchema } from './common.schemas.js';

/** Canonical source: FRS FR-SRCH-001 (validation rules), SDS Section 17.4/24.4 (search query/response). */

/** `?tagIds=t1,t2` — mirrors AB-1005's `commaSeparatedUuidList` decision exactly, for API consistency. */
const commaSeparatedUuidList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().uuid()));

export const SearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(SEARCH_QUERY_MIN_LENGTH, 'Search query is required.')
    .max(SEARCH_QUERY_MAX_LENGTH, `Search query must be at most ${SEARCH_QUERY_MAX_LENGTH} characters.`),
  page: z.coerce.number().int().min(PAGE_MIN).optional().default(DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(PAGE_SIZE_MIN)
    .max(PAGE_SIZE_MAX)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
  tagIds: commaSeparatedUuidList.optional(),
});

export const SearchResultSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  snippet: z.string(),
  rank: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SearchResponseSchema = z.object({
  data: z.array(SearchResultSchema),
  pagination: PaginationMetaSchema,
});
```
Notes:
- `q.min(1)` on a `.trim()`'d string covers both Scenario 10 (empty/missing — Zod already rejects `undefined` since `q` isn't `.optional()`) and Scenario 12 (whitespace-only, since `.trim()` runs before `.min()`).
- No `sortBy`/`sortOrder` params — search is always ranked by relevance (`rank DESC`), per FRS AC-3; unlike `/api/notes` there's no user-facing sort toggle in UX-SCR-009.

### `packages/shared/src/types/search.types.ts` (currently `export {};` placeholder — replace)
```ts
import type { z } from 'zod';
import type { SearchQuerySchema, SearchResultSchema, SearchResponseSchema } from '../schemas/search.schemas.js';

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
```
`packages/shared/src/index.ts` already barrels both files (`export * from './schemas/search.schemas.js'` and `'./types/search.types.js'` are already present, lines 8 and 17) — **no barrel edit needed**.

### `apps/backend/src/modules/search/search.router.ts`
```ts
import { Router } from 'express';
import { SearchQuerySchema } from '@note-app/shared';
import { validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { searchNotesHandler } from './search.controller.js';

const router = Router();

router.get('/', requireAuth, validateQuery(SearchQuerySchema), searchNotesHandler);

export { router as searchRouter };
```

### `apps/backend/src/modules/search/search.controller.ts`
```ts
import type { Request, Response } from 'express';
import type { SearchQuery } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import { searchNotes } from './search.service.js';

export async function searchNotesHandler(req: Request, res: Response): Promise<void> {
  const result = await searchNotes(prisma, req.userId as string, req.validatedQuery as SearchQuery);
  res.status(200).json(result);
}
```
No `search.errors.ts` — this endpoint has no domain-specific error codes (only `VALIDATION_ERROR` from Zod and `TOKEN_*` from `requireAuth`, both already wired centrally), matching the spec's Section 4/6 conclusion.

### `apps/backend/src/modules/search/search.service.ts`
Core logic — the only genuinely new pattern in this codebase (raw SQL via `Prisma.sql`):
```ts
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { SearchQuery, SearchResponse } from '@note-app/shared';

interface SearchRow {
  id: string;
  title: string;
  snippet: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CountRow {
  count: bigint;
}

/**
 * Builds the shared WHERE fragment (user scope, non-deleted, search match, optional tag filter) so
 * the data query and count query stay in lockstep — they must agree on which rows match.
 */
function buildWhereFragment(userId: string, query: SearchQuery): Prisma.Sql {
  const tagFilter =
    query.tagIds && query.tagIds.length > 0
      ? Prisma.sql`AND n."id" IN (
          SELECT "noteId" FROM "NoteTag"
          WHERE "tagId" IN (${Prisma.join(query.tagIds)})
          GROUP BY "noteId"
          HAVING COUNT(DISTINCT "tagId") = ${query.tagIds.length}
        )`
      : Prisma.empty;

  return Prisma.sql`
    n."userId" = ${userId}
    AND n."deletedAt" IS NULL
    AND n."searchVector" @@ plainto_tsquery('english', ${query.q})
    ${tagFilter}
  `;
}

export async function searchNotes(
  prisma: PrismaClient,
  userId: string,
  query: SearchQuery,
): Promise<SearchResponse> {
  const { page, pageSize } = query;
  const where = buildWhereFragment(userId, query);
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>`
      SELECT
        n."id" AS "id",
        n."title" AS "title",
        ts_rank(n."searchVector", plainto_tsquery('english', ${query.q})) AS "rank",
        ts_headline('english', n."contentPlain", plainto_tsquery('english', ${query.q}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
        ) AS "snippet",
        n."createdAt" AS "createdAt",
        n."updatedAt" AS "updatedAt"
      FROM "Note" n
      WHERE ${where}
      ORDER BY "rank" DESC, n."id" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "Note" n
      WHERE ${where}
    `,
  ]);

  const totalItems = Number(countRows[0]?.count ?? 0n);

  return {
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      rank: row.rank,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
    },
  };
}
```
Design decisions baked into this code:
- **Tag AND-logic in raw SQL:** mirrors the Prisma-builder pattern from `notes.service.ts` (`AND: tagIds.map(id => ({tags: {some: {tagId: id}}}))`) but expressed as a `GROUP BY ... HAVING COUNT(DISTINCT "tagId") = N` subquery, since raw SQL can't compose N separate `EXISTS` fragments as cleanly as Prisma's builder — this is the standard SQL idiom for "note has ALL of these tags."
- **No `resolveOwnedTagIds` step:** unlike `notes.service.ts`, this does not pre-validate tag ownership before filtering. A `tagId` the user doesn't own simply matches zero `NoteTag` rows (since the `NoteTag`→`Note` join is implicitly scoped by `n."userId" = userId` in the outer WHERE), so it naturally yields no results rather than needing a short-circuit. This is intentionally simpler than AB-1005's approach since the raw query's `HAVING COUNT = N` already requires exact match against real tag associations. *(Flag in `/implement`: confirm this reasoning holds — if it doesn't fully mirror AB-1005's opacity behavior on a foreign tag id, add the short-circuit.)*
- **Secondary sort `n."id" ASC`** after `rank DESC` — mirrors the deterministic-pagination tie-breaker convention from `notes.service.ts`.
- **`ts_rank`/`ts_headline`/`plainto_tsquery` called twice** (once per column in the data query) — acceptable per spec's accepted-tradeoff on `ts_headline` cost; avoids a lateral join or CTE for a single-page query.
- Both queries always share `buildWhereFragment` output — prevents the pagination count and result set from ever disagreeing on which rows match.

## 3. Files to Modify

### `apps/backend/src/app.ts`
```diff
 import { notesRouter } from './modules/notes/notes.router.js';
 import { tagsRouter } from './modules/tags/tags.router.js';
+import { searchRouter } from './modules/search/search.router.js';

   app.use('/api/notes', notesRouter);
   app.use('/api/tags', tagsRouter);
+  app.use('/api/search', searchRouter);
-
-  // Further feature routes are mounted here by their owning tickets (AB-1007 onward).
+  // Further feature routes are mounted here by their owning tickets (AB-1008 onward).
```

## 4. Tests

### `apps/backend/tests/unit/search.service.test.ts` (new)
Mock `prisma.$queryRaw` directly (it's called as a tagged-template function, so `vi.fn()` intercepts the call and its interpolated values arg-by-arg). Cover:
- Happy path: asserts `data`/`pagination` shape mapping from raw rows (bigint `count` → `Number`, `Date` → ISO string).
- `totalItems === 0` → `totalPages: 0` (mirrors `notes.service.ts` convention).
- Tag filter present vs. absent → assert the `Prisma.Sql` fragment passed to `$queryRaw` differs (inspect `.sql`/`.values` on the `Prisma.Sql` object, or assert call count/shape rather than exact SQL text, since exact whitespace formatting is brittle to assert on).
- Two `$queryRaw` calls happen per invocation (data + count), both derived from the same `buildWhereFragment` inputs.

### `apps/backend/tests/integration/search.integration.test.ts` (new)
Follows `notes.integration.test.ts` conventions (`createApp()`, `supertest`, `registerAndLogin`, real Postgres test DB). Reuses `resetNotesTables()` from `tests/integration/setup.ts` — no new reset helper needed (`Note`/`Tag`/`NoteTag` already truncated by it).

**Critical setup detail:** unlike `notes.integration.test.ts`'s `createNoteDirect` helper (which creates via `prisma.note.create` and leaves `contentPlain: ''`), search tests need real searchable content so the DB trigger populates `searchVector` meaningfully. Two options — pick whichever keeps tests fastest/clearest per scenario:
- (a) create notes via the real `POST /api/notes` endpoint (goes through `sanitizeNoteHtml`/`extractPlainText`, guaranteeing `contentPlain` and the trigger-populated `searchVector` are realistic), or
- (b) a local `createSearchableNoteDirect` helper in the test file that sets `contentPlain` explicitly via `prisma.note.create({ data: { ..., contentPlain: 'kubernetes deployment guide' } })` — the AB-1004 trigger fires on insert/update of `title`/`contentPlain` regardless of write path, so this is valid and faster than the HTTP round-trip.

Recommend (b) for most scenarios (speed, precise control over `createdAt`/tag assignment like `notes.integration.test.ts` already does), with one test using (a) to confirm the full create→search round-trip works end-to-end (i.e., the trigger really does fire off a real `POST /api/notes` call, not just direct Prisma writes).

Map 1:1 to `spec.md`'s 16 scenarios:
- Scenarios 1–4: title match, content match, stemming (`run`/`running`), rank ordering (title-weight beats content-weight — assert array order, not just membership).
- Scenario 5: no results → `{data: [], pagination: {..., totalItems: 0, totalPages: 0}}`.
- Scenario 6: tag filter AND logic — two notes both matching `q`, only one tagged; assert only the tagged one returns.
- Scenario 7: 25 matching notes, assert page 1 (20 items) vs. page 2 (5 items), both ranked consistently.
- Scenario 8: soft-deleted note excluded.
- Scenario 9: cross-user isolation.
- Scenarios 10–14: validation table — `q` missing/empty/whitespace/too-long, bad `page`/`pageSize`, malformed `tagIds` → all `422 VALIDATION_ERROR`.
- Scenario 15: special characters (`&`, `|`, `:`, `!`) in `q` → `200`, not `500` (proves `plainto_tsquery` param binding, not string interpolation).
- Scenario 16: no `Authorization` header → `401`.

### `packages/shared/tests/unit/search.schemas.test.ts` (new, per `packages/shared/CLAUDE.md` testing convention)
Valid/invalid input table for `SearchQuerySchema`: trims and rejects whitespace-only `q`, rejects >200 chars, defaults `page`/`pageSize`, rejects `pageSize > 100`, parses comma-separated `tagIds` into a UUID array, rejects a non-UUID entry in `tagIds`.

## 5. Build / Lint / Test Checkpoints

Run in order, matching `CLAUDE.md`'s mandatory gate:
```
pnpm --filter @note-app/shared build   # search.schemas.ts / search.types.ts compile, barrel resolves
pnpm --filter @note-app/shared test    # new search.schemas.test.ts
pnpm --filter backend build             # tsc: Prisma.Sql/Prisma.join typing, no implicit any
pnpm --filter backend lint --max-warnings 0
pnpm --filter backend test              # unit (mocked $queryRaw) + integration (real Postgres test DB, requires docker compose up -d)
pnpm build && pnpm lint --max-warnings 0 && pnpm test   # full repo gate before commit, per CLAUDE.md
```
Integration tests require the Postgres test DB running (`docker compose up -d`, `DATABASE_URL` pointed at the `notetaking_test` DB per `vitest.config.ts`) and the AB-1004 search-vector migration already applied (`pnpm db:migrate`) — both pre-existing, no new migration step for this ticket.

## 6. Out of Scope (unchanged from spec.md)

- `searchVector` column/GIN index/trigger — already exists (AB-1004).
- Frontend Search Results screen (UX-SCR-009) — later ticket.
- Sharing, version history — AB-1008, AB-1009.
- Fuzzy/typo-tolerant search, synonym expansion, external search services (CON-004).

## 7. Open Items for `/implement` to Confirm

1. Verify the `HAVING COUNT(DISTINCT "tagId") = N` tag-filter subquery actually returns zero rows (not an error) when a `tagId` doesn't exist or belongs to another user — should be safe since the subquery only reads `NoteTag`, and the outer `n."userId" = userId` scope already prevents cross-user leakage regardless of which tags matched.
2. Confirm `Prisma.join([])` is never called with an empty array (guarded by the `query.tagIds.length > 0` check in `buildWhereFragment` — `Prisma.join` throws on an empty array in some Prisma versions).
3. Double check `ts_rank`'s return type maps cleanly to JS `number` via `$queryRaw` (Postgres `real`/`float4` → should deserialize fine, unlike `bigint` counts which need explicit `Number()` conversion as already handled above).
