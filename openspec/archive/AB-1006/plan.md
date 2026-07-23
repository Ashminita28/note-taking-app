# Technical Plan — AB-1006 (Backend Tags CRUD + Note Counts)

Traces every file to a scenario in `openspec/tickets/AB-1006/spec.md`. Follows the layered
architecture (Router → Validation → Controller → Service → Prisma) and module structure
(`<name>.router/controller/service/errors.ts`) defined in `apps/backend/CLAUDE.md`. Creates a new
`tags` module — unlike AB-1005, this ticket does not extend an existing module.

## 0. Architecture Decisions

Resolves the three open questions raised in `spec.md` §5, plus decisions discovered while reading
the current codebase state:

1. **No DB migration needed.** `Tag` and `NoteTag` already exist in `prisma/schema.prisma` (delivered
   by AB-1001's initial migration) with `@@unique([userId, name])`, `@@index([userId])`, and
   `onDelete: Cascade` on both `NoteTag` foreign keys. This ticket adds zero new Prisma models or
   migrations.
2. **Case-insensitive uniqueness (spec open question 1, resolved): application-level pre-check with
   Prisma's `mode: 'insensitive'`, not `citext` or a functional index migration.** `apps/backend/
   CLAUDE.md` prohibits raw SQL except full-text search, which rules out a `lower(name)` functional
   unique index (Postgres doesn't support `mode: 'insensitive'` as a DB constraint, only as a Prisma
   query filter — enforcing it at the DB layer would need a raw-SQL migration). The codebase's existing
   precedent for case-insensitive uniqueness (`BR-001`, email) instead normalizes case at the Zod
   schema layer (`auth.schemas.ts`'s `emailSchema.toLowerCase()`) — but that approach doesn't transfer
   to tags, because tag names must preserve the user's chosen display casing (UX-SCR-010 lets a user
   type "Work", "WORK", etc., and expects that casing to persist), whereas emails have no display-casing
   concern. So: `assertNameAvailable` runs `prisma.tag.findFirst({ where: { userId, name: { equals:
   name, mode: 'insensitive' }, id: excludeId ? { not: excludeId } : undefined } })` before every
   create/update, throwing `TagNameExistsError` on a hit (Scenarios 3, 8, 20, 23). The underlying
   `@@unique([userId, name])` constraint (case-sensitive) is additionally caught via Prisma error code
   `P2002` on `create`/`update` as a defense-in-depth safety net for exact-case concurrent duplicates.
   **Accepted limitation:** a narrow race window remains for concurrent creates with *different*-case
   names (e.g. "Work" and "work" submitted in the same instant) — the DB constraint won't catch that
   case, only the pre-check does, and pre-checks aren't atomic with the following insert. This mirrors
   the same trade-off spec.md's open question already flagged as acceptable (option (c)); a `citext`
   migration would close it but is unjustified extra scope for a P1 CRUD ticket with no reported
   concurrency requirement.
   **Implementation deviation (post-review):** the `P2002` catch described above and in the
   `tags.service.ts` sketch in §2 was intentionally dropped from the shipped code — `createTag` and
   `updateTag` perform a bare `prisma.tag.create`/`prisma.tag.update` with no surrounding try/catch,
   matching `auth.service.ts`'s `registerUser` precedent elsewhere in this codebase. This was a
   deliberate call (recorded in `tasks.md`), not an oversight; it means the exact-case concurrent-duplicate
   window is *not* closed by a DB-level safety net either, only by the pre-check — slightly widening the
   already-accepted race-window limitation above. Flagged during the AB-1006 code review (2026-07-23);
   no code change was made as a result, only this doc reconciliation.
3. **Self-exclusion on update (spec open question 2, confirmed):** `assertNameAvailable` takes an
   optional `excludeId` parameter, passed as the tag's own id on update, so renaming to a case-variant
   of the tag's current name is never flagged as a conflict (Scenario 20).
4. **Note count via Prisma's filtered relation count, not raw SQL or in-memory counting (spec open
   question 3, resolved):** Prisma 6.6.0 (this repo's pinned version) supports filtered `_count`:
   `include: { _count: { select: { notes: { where: { note: { deletedAt: null } } } } } }`. This computes
   the non-deleted note count per tag in the same query as the tag list, with no raw SQL and no
   additional round trip (Scenario 10).
5. **`GET /api/tags` has no query params** — FR-TAG-002 doesn't require pagination/sorting options
   (always full list, alphabetical by name), so no `validateQuery` middleware or query schema needed
   for this endpoint, unlike `GET /api/notes`.
6. **`DELETE /api/tags/:id` uses a real hard delete (`prisma.tag.delete`), not the soft-delete pattern
   used for notes.** FR-TAG-004 and the `Tag` Prisma model (no `deletedAt` column) both confirm tags are
   never soft-deleted — `CON-007`/`CLAUDE.md`'s soft-delete rule governs *notes* only. Deleting the
   `Tag` row cascades to `NoteTag` automatically via the existing `onDelete: Cascade` FK — no explicit
   `noteTag.deleteMany` call needed (Scenario 26).
7. **`registerAndLogin` test helper is relocated from `notes.integration.test.ts` to `tests/
   integration/setup.ts`** so the new tags integration suite can reuse it instead of duplicating it.
   `notes.integration.test.ts` is updated to import it from `setup.ts` instead of defining it locally.
   `resetNotesTables` already truncates `tag` and `noteTag` (plus everything FK-dependent) — reused
   as-is for the tags suite's `beforeEach`, no new reset helper needed.

## 1. `packages/shared` — Contracts

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| S1 | `packages/shared/src/schemas/tag.schemas.ts` | Mod (replace `export {}` stub) | `trimmedTagName = z.string().trim().min(TAG_NAME_MIN_LENGTH, 'Tag name is required.').max(TAG_NAME_MAX_LENGTH, ...)` (Scenarios 4, 5, 7); `HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/` and `hexColorSchema = z.string().regex(HEX_COLOR_PATTERN, 'Color must be a 7-character hex code (e.g. #RRGGBB).')` (Scenario 6); `CreateTagRequestSchema = z.object({ name: trimmedTagName, color: hexColorSchema.optional().default(DEFAULT_TAG_COLOR) })` (Scenario 2 — default applied at schema layer, same pattern as `note.schemas.ts`'s title default); `UpdateTagRequestSchema = z.object({ name: trimmedTagName.optional(), color: hexColorSchema.optional() })`; `TagResponseSchema = z.object({ id: z.string().uuid(), name: z.string(), color: z.string(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() })`; `TagWithCountSchema = z.object({ id: z.string().uuid(), name: z.string(), color: z.string(), noteCount: z.number().int() })`; `ListTagsResponseSchema = z.object({ tags: z.array(TagWithCountSchema) })`; `DeleteTagResponseSchema = z.object({ message: z.string() })`; `TagIdParamSchema = z.object({ id: z.string().uuid() })`. |
| S2 | `packages/shared/src/types/tag.types.ts` | Mod (replace `export {}` stub) | `CreateTagRequest`, `UpdateTagRequest`, `TagResponse`, `TagWithCount`, `ListTagsResponse`, `DeleteTagResponse`, `TagIdParam` — all `z.infer<typeof ...>` from the schemas above, per `packages/shared/CLAUDE.md`'s "types derived from schemas" rule. |
| S3 | `packages/shared/tests/unit/tag.schemas.test.ts` | New | `CreateTagRequestSchema`: accepts `{name, color}`; accepts `{name}` alone and defaults `color` to `#6B7280`; trims leading/trailing whitespace from `name` (Scenario 7); rejects empty/whitespace-only `name`; rejects `name` over 50 chars; rejects malformed `color` (not 7-char hex, missing `#`, invalid chars). `UpdateTagRequestSchema`: accepts an empty object (all fields optional); accepts `name` only, `color` only, both; still rejects an out-of-range `name`/`color` when provided. `TagIdParamSchema`: accepts a valid UUID, rejects a non-UUID string. |

`index.ts` barrel already re-exports `./schemas/tag.schemas.js` and `./types/tag.types.js` — no
barrel changes needed. `TAG_NAME_MIN_LENGTH`/`TAG_NAME_MAX_LENGTH` (`constants/limits.ts`) and
`DEFAULT_TAG_COLOR` (`constants/defaults.ts`) already exist — no changes needed there either.

## 2. `apps/backend/src/modules/tags` — New Feature Module

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| B1 | `apps/backend/src/modules/tags/tags.errors.ts` | New | `TagNameExistsError extends AppError` → `ERROR_CODES.TAG_NAME_EXISTS`, `'A tag with this name already exists.'`. `TagNotFoundError extends AppError` → `ERROR_CODES.TAG_NOT_FOUND`, `'Tag not found.'`. Mirrors `notes.errors.ts`'s structure. |
| B2 | `apps/backend/src/modules/tags/tags.service.ts` | New | See implementation detail below. Exports `listTags`, `createTag`, `updateTag`, `deleteTag`, all `(prisma: PrismaClient, userId: string, ...)` per the existing notes-module convention (Prisma client passed in, not imported inside the service — keeps it testable with a mocked client, matching `notes.service.test.ts`'s pattern). |
| B3 | `apps/backend/src/modules/tags/tags.controller.ts` | New | `listTagsHandler`, `createTagHandler`, `updateTagHandler`, `deleteTagHandler` — thin handlers that pull `req.userId`/`req.params.id`/`req.body` and call the matching service function, mirroring `notes.controller.ts` exactly (no business logic in controllers, per `apps/backend/CLAUDE.md`). |
| B4 | `apps/backend/src/modules/tags/tags.router.ts` | New | `router.get('/', requireAuth, listTagsHandler)`; `router.post('/', requireAuth, validateBody(CreateTagRequestSchema), createTagHandler)`; `router.patch('/:id', requireAuth, validateParams(TagIdParamSchema), validateBody(UpdateTagRequestSchema), updateTagHandler)`; `router.delete('/:id', requireAuth, validateParams(TagIdParamSchema), deleteTagHandler)`. Exports `tagsRouter`. |
| B5 | `apps/backend/src/app.ts` | Mod | Import `tagsRouter` from `./modules/tags/tags.router.js`; add `app.use('/api/tags', tagsRouter);` after the existing `app.use('/api/notes', notesRouter);` line; remove the now-stale "Further feature routes are mounted here" comment or leave it pointing at AB-1007 onward. |

**`tags.service.ts` implementation detail:**

```
function toTagResponse(tag: Tag): TagResponse {
  return {
    id: tag.id, name: tag.name, color: tag.color,
    createdAt: tag.createdAt.toISOString(), updatedAt: tag.updatedAt.toISOString(),
  };
}

async function assertNameAvailable(prisma, userId, name, excludeId?): Promise<void> {
  const existing = await prisma.tag.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new TagNameExistsError();
}

export async function createTag(prisma, userId, input: CreateTagRequest): Promise<TagResponse> {
  await assertNameAvailable(prisma, userId, input.name);                      // Scenario 3
  try {
    const tag = await prisma.tag.create({ data: { userId, name: input.name, color: input.color } });
    return toTagResponse(tag);                                                // Scenarios 1, 2, 7, 8
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new TagNameExistsError();         // race-condition safety net
    throw err;
  }
}
// NOT SHIPPED AS WRITTEN: the try/catch + isUniqueConstraintError safety net sketched above was
// dropped in the actual implementation — see Architecture Decision 2's "Implementation deviation" note.
// The shipped `createTag`/`updateTag` call `prisma.tag.create`/`prisma.tag.update` directly, uncaught.

export async function listTags(prisma, userId): Promise<ListTagsResponse> {
  const tags = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },                                                 // Scenario 12
    include: { _count: { select: { notes: { where: { note: { deletedAt: null } } } } } },
  });
  return { tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, noteCount: t._count.notes })) };
  // Scenarios 10 (accurate non-deleted count), 11 (zero-note tags included), 13 (empty list), 14 (userId-scoped)
}

export async function updateTag(prisma, userId, tagId, input: UpdateTagRequest): Promise<TagResponse> {
  const existing = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!existing) throw new TagNotFoundError();                                // Scenarios 21, 22
  if (input.name !== undefined) {
    await assertNameAvailable(prisma, userId, input.name, tagId);             // Scenarios 20, 23
  }
  try {
    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    return toTagResponse(tag);                                                // Scenarios 16, 17, 18, 19
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new TagNameExistsError();
    throw err;
  }
}

export async function deleteTag(prisma, userId, tagId): Promise<DeleteTagResponse> {
  const existing = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!existing) throw new TagNotFoundError();                                // Scenarios 27, 28
  await prisma.tag.delete({ where: { id: tagId } });                          // cascades NoteTag rows — Scenario 26
  return { message: 'Tag deleted successfully.' };
}
```

`isUniqueConstraintError(err)` — small local helper checking `err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'` (imported from `@prisma/client`), used by both `createTag` and `updateTag`.

Scenarios 9, 15, 25, 29 (unauthenticated `401`) are fully handled by `requireAuth` before any handler
runs. Scenarios covering `422 VALIDATION_ERROR` (4, 5, 6, 24) are fully handled by `validateBody`
before the service ever runs — no additional error classes needed for those.

## 3. Tests — `apps/backend`

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| T1 | `apps/backend/tests/integration/setup.ts` | Mod | Move `registerAndLogin` here (Architecture Decision 7) — same implementation currently in `notes.integration.test.ts`, exported for reuse. |
| T2 | `apps/backend/tests/integration/notes.integration.test.ts` | Mod | Remove the local `registerAndLogin` definition; import it from `./setup.js` instead. No behavioral change. |
| T3 | `apps/backend/tests/unit/tags.service.test.ts` | New | Mocked-Prisma unit tests per function: `createTag` — happy path with/without color, calls `findFirst` with `mode: 'insensitive'` before `create`, throws `TagNameExistsError` when the pre-check finds a match, throws `TagNameExistsError` when `create` rejects with a mocked `P2002` error. `listTags` — `orderBy: {name: 'asc'}` and the `_count.select.notes.where` shape are passed to `findMany`; maps `_count.notes` to `noteCount`; empty array in → empty `tags` out. `updateTag` — not-found throws `TagNotFoundError`; name-only/color-only/both updates only send the changed fields to `prisma.tag.update`; duplicate-name check passes `excludeId` as the tag's own id; `P2002` on update maps to `TagNameExistsError`. `deleteTag` — not-found throws `TagNotFoundError`; success calls `prisma.tag.delete` and returns the success message. |
| T4 | `apps/backend/tests/integration/tags.integration.test.ts` | New | End-to-end coverage of all 29 spec scenarios against the real test DB, using `registerAndLogin` (from `setup.ts`) and `resetNotesTables` in `beforeEach`/`afterAll` (mirroring `notes.integration.test.ts`'s structure): `POST /api/tags` (create with/without color, duplicate name case-insensitive → `409`, name too long/blank → `422`, invalid color → `422`, whitespace trimmed, per-user scoping, `401` unauthenticated); `GET /api/tags` (note counts exclude soft-deleted notes — create a note, soft-delete it via `prisma.note.update({data: {deletedAt: ...}})`, confirm count drops; zero-note tags included; alphabetical order; empty list; cross-user isolation; `401`); `PATCH /api/tags/:id` (name only, color only, both, renaming preserves note associations, self-rename to a case-variant doesn't 409, `404` not-found, `404` foreign-owned, `409` name conflict against a different tag, `422` validation, `401`); `DELETE /api/tags/:id` (cascades `NoteTag` rows and leaves the note itself intact — assert via `prisma.note.findUnique` after delete, `404` not-found, `404` foreign-owned, `401`). |

## 4. Build / Lint / Test Checkpoints

Run after `packages/shared` changes (S-block), before touching backend:
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
```

Run after backend module + test changes (B/T blocks):
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

## 5. Out of Scope (unchanged from spec.md)

- Note-side tag assignment/removal (`PATCH /api/notes/:id` body's `tags` field) — AB-1004, already
  implemented, untouched by this plan.
- Tag-based note filtering on `GET /api/notes` — AB-1005, already implemented.
- Tag-based filtering on `GET /api/search` — AB-1007.
- Frontend Tag Management Modal (UX-SCR-010) and Dashboard sidebar tag list (UX-SCR-006) — later
  frontend tickets (AB-1011/1012 range).
- Sharing, version history — AB-1008, AB-1009.
