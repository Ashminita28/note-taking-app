# Technical Plan — AB-1004 (Backend Notes CRUD + Soft Delete)

Traces every file to a scenario in `openspec/tickets/AB-1004/spec.md`. Follows the layered
architecture (Router → Validation → Controller → Service → Prisma) and module structure
(`<name>.router/controller/service/errors.ts`) defined in `apps/backend/CLAUDE.md`.

## 0. Architecture Decisions

Resolves the four open questions raised in `spec.md` §5, plus two implementation-driven decisions
discovered while reading the current codebase state:

1. **`searchVector` is already fully wired — nothing to do here.** Migration
   `20260722081152_search_vector` (already applied, from AB-1001) added the `searchVector` column,
   the GIN index, and a `BEFORE INSERT OR UPDATE OF title, contentPlain` trigger that recomputes it
   automatically (SDS §24.3). This ticket's only obligation is to persist `contentPlain` correctly
   on every create/update — the trigger does the rest. No migration work, no manual
   `searchVector` writes.
2. **Sanitizer/plain-text libraries** (spec open question 1, resolved): add `sanitize-html`
   (whitelist HTML sanitization per SDS §23.4) and `html-to-text` (block-aware HTML→plain-text
   conversion per SDS §23.2 — preserves paragraph/line breaks as spacing, unlike naively
   regex-stripping tags) as pinned `apps/backend` dependencies (CON-001/CON-008: no `@latest`).
3. **`CONTENT_TOO_LARGE` is enforced entirely by the existing global body-parser limit**, not by
   Zod. `app.ts` already sets `express.json({ limit: '500kb' })`, which is numerically identical to
   `NOTE_CONTENT_MAX_SIZE_BYTES` (500 × 1024). Rather than duplicate a size check in the note Zod
   schemas (which would only run *after* the body already parsed, and can't fire before the parser
   itself rejects an oversized payload), `error-handler.ts` gets one new branch: an Express
   `PayloadTooLargeError` (raised by `express.json()`, detected via `err.type ===
   'entity.too.large'`) maps to `413 CONTENT_TOO_LARGE`. This is a generic middleware enhancement,
   not notes-specific, but only the notes endpoints currently exercise a body large enough to hit
   it.
4. **Unknown/foreign `tagIds` are silently filtered, not rejected** (spec open question 2,
   resolved): `createNote`/`updateNote` look up `tagIds` scoped to `WHERE userId = <authUserId>`
   and only associate the subset that resolves. This keeps with BR-002's opacity principle (never
   reveal or error on another user's resource) and avoids inventing an error code FRS doesn't
   define. Flagging once more before implementation: if you'd rather this reject with a validation
   error, tell me now.
5. **No "sharing status" field on the note response** (spec open question 3, resolved): the
   response shape follows SDS §18.1 exactly (`id, title, content, tags, createdAt, updatedAt`).
   FR-NOTE-002 AC2's "sharing status" is deferred to AB-1008, which owns the `ShareLink` read path.
6. **Recovery-window boundary** (spec open question 4, resolved): strict, calendar-day (24h × 30),
   exclusive comparison — `now.getTime() - note.deletedAt.getTime() > RECOVERY_WINDOW_DAYS * 86_400_000`
   throws `RecoveryExpiredError`. Exactly 30 days elapsed is still restorable; 30 days + 1ms is not.
7. **Ownership checks return 404 via query shape, not a separate check** (BR-002 / CLAUDE.md "404
   not 403"): every read/update/delete/restore query filters `WHERE id = :id AND userId =
   <authUserId>` (read/update additionally filter `deletedAt: null`). A `null` result is
   indistinguishable from "doesn't exist" and "belongs to someone else" — both produce
   `NoteNotFoundError` — so there's no separate ownership-check branch to get wrong.
8. **New generic `validateParams` middleware.** `:id` route params aren't validated anywhere yet;
   an malformed (non-UUID) `:id` would currently reach Prisma and surface as an unhandled 500. Adds
   `validateParams(schema)` to `middleware/validate.ts` (sibling to the existing `validateBody`),
   applied with a small `NoteIdParamSchema = z.object({ id: z.string().uuid() })`. Reusable by every
   future `:id`-taking ticket (tags, share, versions).
9. **Transactions around multi-write operations**: create (note + tags + version 1), update (note +
   tag replace + version N), and delete (note.deletedAt + share-link revoke) each run inside
   `prisma.$transaction(...)` so partial writes can't occur. Restore is a single `update()` call —
   no transaction needed.
10. **No DB schema changes.** `Note`, `NoteTag`, `NoteVersion`, `ShareLink` already exist (SDS §15,
    delivered by AB-1001).

## 1. `packages/shared` — Contracts

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| S1 | `packages/shared/src/constants/limits.ts` | Mod | Add `RECOVERY_WINDOW_DAYS = 30` (BR-003) — reused later by the (currently unassigned) permanent-purge job. |
| S2 | `packages/shared/src/schemas/note.schemas.ts` | Mod | Replace `export {}` stub with: `NoteTagRefSchema` (`{id, name, color}` — the embedded tag shape a note response needs; distinct from AB-1006's future full `Tag` entity schema, which will carry `userId`/timestamps/note-count that a note response doesn't), `CreateNoteRequestSchema` (`{title?, content?, tagIds?}`, title trimmed/defaulted to `DEFAULT_NOTE_TITLE`/max `NOTE_TITLE_MAX_LENGTH`, content optional string defaulting to `""` — no size assertion here, see Architecture Decision 3), `UpdateNoteRequestSchema` (same three fields, all optional, no default — omitted vs. `undefined` means "don't touch"), `NoteResponseSchema` (`{id, title, content, tags: NoteTagRefSchema[], createdAt, updatedAt}`, datetimes as `z.string().datetime()`), `DeleteNoteResponseSchema`/`RestoreNoteResponseSchema` wrappers (`{message: z.string()}` for delete, reuses `NoteResponseSchema` for restore's `{note}`), `NoteIdParamSchema` (`{id: z.string().uuid()}`). |
| S3 | `packages/shared/src/types/note.types.ts` | Mod | Replace stub with `z.infer` exports for every schema in S2 (`NoteTagRef`, `CreateNoteRequest`, `UpdateNoteRequest`, `NoteResponse`, `DeleteNoteResponse`, `NoteIdParam`) — no hand-written interfaces, per `packages/shared/CLAUDE.md`. |
| S4 | `packages/shared/tests/unit/note.schemas.test.ts` | New | Valid/invalid cases per FRS §13.2: title trim/default/max-length, empty content allowed, `tagIds` must be UUIDs, `NoteIdParamSchema` rejects non-UUID. |

`index.ts` barrel already re-exports `./schemas/note.schemas.js` and `./types/note.types.js` — no
barrel changes needed.

## 2. `apps/backend` — Cross-Cutting Additions

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| B1 | `apps/backend/package.json` | Mod | Add pinned deps: `sanitize-html` (2.13.1), `html-to-text` (9.0.5); dev deps `@types/sanitize-html` (2.13.0) (`html-to-text` ships its own types). |
| B2 | `apps/backend/src/middleware/validate.ts` | Mod | Add `validateParams(schema: ZodType)` alongside existing `validateBody` — same shape, parses `req.params`, forwards a `ValidationError` on failure, otherwise overwrites `req.params` and calls `next()`. |
| B3 | `apps/backend/src/middleware/error-handler.ts` | Mod | Add a branch before the generic 500 fallback: if `err` has `type === 'entity.too.large'` (Express body-parser payload overflow), respond `413` with `{error: {code: 'CONTENT_TOO_LARGE', message: 'Note content exceeds the maximum allowed size.', details: []}}`. Existing `AppError`/fallback branches unchanged. |
| B4 | `apps/backend/tests/unit/validate.middleware.test.ts` | Mod | Add cases for the new `validateParams`: valid UUID param passes through; invalid UUID calls `next` with a `ValidationError`. |
| B5 | `apps/backend/tests/unit/error-handler.test.ts` | Mod | Add a case: an error shaped like Express's `PayloadTooLargeError` (`{type: 'entity.too.large'}`) produces the `413 CONTENT_TOO_LARGE` envelope; existing cases stay green. |

## 3. `apps/backend/src/modules/notes` — Feature Module

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| M1 | `apps/backend/src/modules/notes/notes.errors.ts` | New | `NoteNotFoundError` (404 `NOTE_NOT_FOUND`), `AlreadyDeletedError` (409 `ALREADY_DELETED`), `NotDeletedError` (409 `NOT_DELETED`), `RecoveryExpiredError` (410 `RECOVERY_EXPIRED`) — all extend `AppError`. (`CONTENT_TOO_LARGE` has no domain class — see B3, it's raised generically by the error handler, not thrown from the service.) |
| M2 | `apps/backend/src/modules/notes/notes.content.ts` | New | `sanitizeNoteHtml(html: string): string` — `sanitize-html` configured with the exact SDS §23.4 whitelist (tags: `p, h1-h6, ul, ol, li, blockquote, pre, code, em, strong, u, s, a, br, mark, span, div, input, label`; attributes: `href` on `a` (validated URL scheme), `class`, `data-type`, `data-checked`, `style` restricted to `text-align`; `input` restricted to `type="checkbox"`). `extractPlainText(html: string): string` — `html-to-text` with block tags mapped to produce single-space-separated text (no markdown-style bullets/numbering artifacts), trimmed. |
| M3 | `apps/backend/src/modules/notes/notes.service.ts` | New | `createNote(prisma, userId, input)`, `getNote(prisma, userId, noteId)`, `updateNote(prisma, userId, noteId, input)`, `softDeleteNote(prisma, userId, noteId)`, `restoreNote(prisma, userId, noteId)`. Details per function below. Prisma injected as first arg (dependency injection, per `auth.service.ts` precedent) so unit tests mock it. No `req`/`res` access. |
| M4 | `apps/backend/src/modules/notes/notes.controller.ts` | New | Thin async handlers: `createNoteHandler`, `getNoteHandler`, `updateNoteHandler`, `deleteNoteHandler`, `restoreNoteHandler` — call the matching service function with `prisma`, `req.userId`, `req.params.id`, `req.body`, then `res.status(...).json(...)`. No manual try/catch (Express 5 auto-forwards). |
| M5 | `apps/backend/src/modules/notes/notes.router.ts` | New | `POST /` → `requireAuth` + `validateBody(CreateNoteRequestSchema)` + `createNoteHandler`; `GET /:id` → `requireAuth` + `validateParams(NoteIdParamSchema)` + `getNoteHandler`; `PATCH /:id` → `requireAuth` + `validateParams(NoteIdParamSchema)` + `validateBody(UpdateNoteRequestSchema)` + `updateNoteHandler`; `DELETE /:id` → `requireAuth` + `validateParams(NoteIdParamSchema)` + `deleteNoteHandler`; `POST /:id/restore` → `requireAuth` + `validateParams(NoteIdParamSchema)` + `restoreNoteHandler`. Exports `notesRouter`. |
| M6 | `apps/backend/src/app.ts` | Mod | Replace the "Further feature routes are mounted here" comment with `app.use('/api/notes', notesRouter)`. |

**`notes.service.ts` function details:**

- `createNote(prisma, userId, input)`: sanitize `input.content` (M2), extract `contentPlain`,
  resolve `tagIds` → `prisma.tag.findMany({ where: { id: { in: tagIds ?? [] }, userId } })`
  (Architecture Decision 4), then in one `$transaction`: `note.create({ data: { userId, title,
  content, contentPlain } })`, `noteTag.createMany` for the resolved tag ids, `noteVersion.create({
  data: { noteId, versionNumber: 1, title, content } })`. Returns the mapped `NoteResponse`
  (Scenarios 1–5, 9).
- `getNote(prisma, userId, noteId)`: `note.findFirst({ where: { id: noteId, userId, deletedAt: null
  }, include: { tags: { include: { tag: true } } } })`; `null` → `NoteNotFoundError` (Scenarios
  11–13).
- `updateNote(prisma, userId, noteId, input)`: fetch the existing note the same way as `getNote`
  (404 if missing/foreign/soft-deleted — Scenario 18); merge `title`/`content` (only overwrite
  fields present in `input`, per partial-update semantics); if `content` is present, re-sanitize and
  re-extract `contentPlain`; in one `$transaction`: `note.update(...)` with merged fields, if
  `input.tagIds` is present (`!== undefined`) atomically replace via `noteTag.deleteMany({
  where: { noteId } })` + `noteTag.createMany` for the resolved (owned) tag ids, compute the next
  `versionNumber` via `noteVersion.aggregate({ where: { noteId }, _max: { versionNumber: true } })`
  and insert a new `NoteVersion` with the **merged** title/content (Scenario 16 — a title-only edit
  still snapshots the unchanged content). Covers Scenarios 15–17, 19.
- `softDeleteNote(prisma, userId, noteId)`: `note.findFirst({ where: { id: noteId, userId } })`
  (no `deletedAt` filter — need to see already-deleted notes to distinguish 404 vs. 409); `null` →
  `NoteNotFoundError`; `deletedAt !== null` → `AlreadyDeletedError`; else one `$transaction`:
  `note.update({ data: { deletedAt: new Date() } })` + `shareLink.deleteMany({ where: { noteId } })`
  (Scenarios 22–25).
- `restoreNote(prisma, userId, noteId)`: `note.findFirst({ where: { id: noteId, userId } })`; `null`
  → `NoteNotFoundError`; `deletedAt === null` → `NotDeletedError`; else compute elapsed time — if
  `Date.now() - deletedAt.getTime() > RECOVERY_WINDOW_DAYS * 86_400_000` → `RecoveryExpiredError`;
  else `note.update({ data: { deletedAt: null } })` (Scenarios 27–30).

## 4. Tests — `apps/backend`

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| T1 | `apps/backend/tests/unit/notes.content.test.ts` | New | `sanitizeNoteHtml`: strips `<script>`/`onclick`/disallowed tags, keeps whitelisted tags/attrs, restricts `input` to checkboxes. `extractPlainText`: multi-paragraph HTML produces space-separated (not concatenated) text; empty content → `""`. |
| T2 | `apps/backend/tests/unit/notes.service.test.ts` | New | Each service function with a mocked Prisma client (`vi.fn()` per model/`$transaction`), covering every scenario in `spec.md` §3: create with/without title/content/tags, tag-default-untitled, tag-trim, foreign/unknown `tagIds` silently dropped, read not-found/foreign/soft-deleted, update partial-still-versions, update tag-replace-atomicity, delete already-deleted, restore not-deleted/expired/within-window (freeze `Date.now()` via `vi.setSystemTime` for the 30-day boundary case). |
| T3 | `apps/backend/tests/integration/notes.integration.test.ts` | New | Supertest end-to-end coverage of all 5 endpoints against the real test DB — one case per spec scenario, plus a genuine >500 KB `content` payload asserting `413 CONTENT_TOO_LARGE` end-to-end (validates Architecture Decision 3 through the real `express.json` limit, not a mock). Reuses `tests/integration/setup.ts`'s truncate pattern, extended to also truncate `Note`/`NoteTag`/`NoteVersion`/`ShareLink`/`Tag` between tests. |
| T4 | `apps/backend/tests/integration/setup.ts` | Mod | Extend the existing truncate helper to include the new tables (order matters for FK constraints: `ShareLink`, `NoteVersion`, `NoteTag`, `Note`, `Tag`, then existing `RefreshToken`/`User`). |

## 5. Build / Lint / Test Checkpoints

Run after `packages/shared` changes (S-block), before touching backend:
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
```

Run after backend cross-cutting + module changes (B/M blocks):
```
docker compose up -d
pnpm db:generate
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
Confirm ≥80% coverage on all new files (`pnpm --filter @note-app/backend test:coverage`,
`pnpm --filter @note-app/shared test`).

## 6. Out of Scope (unchanged from spec.md)

- `GET /api/notes` list/pagination/sorting/tag-filtering — AB-1005.
- Tags CRUD, tag validation, note counts — AB-1006.
- `GET /api/search` endpoint — AB-1007 (the `searchVector` column/index/trigger already exist from
  AB-1001; this ticket only needs to keep populating `contentPlain` correctly, per Architecture
  Decision 1).
- Share link generation/regeneration endpoints — AB-1008 (only the soft-delete revoke side effect
  is implemented here).
- Version history read/restore endpoints — AB-1009 (only snapshot creation is implemented here).
- Frontend note editor / delete confirmation dialog — AB-1012.
- Permanent purge background job (SDS §27.5).
