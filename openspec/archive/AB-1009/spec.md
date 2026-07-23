# AB-1009 — Backend Version History Spec

## 1. Ticket

- **ID:** AB-1009
- **Title:** Backend Version History
- **Dependencies:** AB-1004 (Backend Notes CRUD + Soft Delete) — confirmed complete (`openspec/archive/AB-1004`, status: completed). AB-1004 already creates a `NoteVersion` snapshot inside the same transaction as every note create/update (FR-VER-001, `notes.service.ts` `createNote`/`updateNote`) — this ticket **consumes that behavior as-is** and does not re-implement it. The `NoteVersion` Prisma model already exists (SDS §15, delivered by AB-1001).
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-VER-001 | *(Already delivered by AB-1004 — consumed, not re-implemented.)* The system SHALL create a version snapshot every time a note is saved. |
| FR-VER-002 | The system SHALL return the version history of a note, ordered newest-to-oldest, with a content preview per entry. |
| FR-VER-003 | The system SHALL allow users to view the full content of any specific version of a note. |
| FR-VER-004 | The system SHALL allow users to restore a previous version, which creates a **new** version (not a rollback). |
| FR-VER-005 | The system SHOULD automatically purge version snapshots older than 90 days, retaining a minimum of 10 versions per note regardless of age. |

**Business rules in scope:** BR-002 (users only access their own notes; cross-user access returns 404, never 403 — `CLAUDE.md`), BR-009 (restore creates a new version, does not rewrite history), BR-017 (version records are immutable — never individually edited or deleted, except by the purge process), BR-018 (minimum 10 versions retained per note regardless of age), BR-019 (versions older than 90 days may be purged, subject to BR-018). BR-008 (every save creates exactly one version) is **consumed, not implemented**, here — see Dependencies.

## 3. Scenarios

### FR-VER-002 — List Version History (`GET /api/notes/:id/versions`)

**Scenario 1 — Successful listing, newest-first**
- **Given** an authenticated user who owns note `n1`, which has versions 1, 2, and 3
- **When** the client calls `GET /api/notes/n1/versions`
- **Then** the system responds `200` with `{versions: [...]}` ordered `[3, 2, 1]` (version number descending), each entry containing `{versionNumber, title, contentPreview, createdAt}`.

**Scenario 2 — Content preview is truncated to 200 characters**
- **Given** a version whose content is longer than 200 characters
- **When** the client lists versions for that note
- **Then** `contentPreview` contains only the first 200 characters of that version's content — the full content is not included in the list response (FRS AC-3).

**Scenario 3 — Only one version exists (new note)**
- **Given** a note that was just created and has never been updated
- **When** the client lists its versions
- **Then** the system responds `200` with a single entry, `versionNumber: 1`.

**Scenario 4 — Note not found**
- **Given** an authenticated user
- **When** the client calls `GET /api/notes/:id/versions` for a note ID that does not exist
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (FRS EC-1).

**Scenario 5 — Note belongs to another user**
- **Given** an authenticated user who does not own note `n2`
- **When** the client calls `GET /api/notes/n2/versions`
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (FRS EC-2 — existence of another user's note is never revealed, mirrors AB-1004/1005/1008 opacity pattern).

**Scenario 6 — Note is soft-deleted**
- **Given** an authenticated user whose note `n3` has `deletedAt` set
- **When** the client calls `GET /api/notes/n3/versions`
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (treated identically to "not found," consistent with `getNote`'s `deletedAt: null` scoping, SDS §27.2 — decision, see Section 4).

**Scenario 7 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `GET /api/notes/:id/versions`
- **Then** the `requireAuth` middleware responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate (existing AB-1002 behavior; not re-implemented here).

### FR-VER-003 — View Specific Version (`GET /api/notes/:id/versions/:versionNumber`)

**Scenario 8 — Successful full-content view**
- **Given** an authenticated user who owns note `n1`, which has version 2 with title `"Draft"` and content `"<p>hello</p>"`
- **When** the client calls `GET /api/notes/n1/versions/2`
- **Then** the system responds `200` with `{version: {versionNumber: 2, title: "Draft", content: "<p>hello</p>", createdAt}}` (full content, not a preview).

**Scenario 9 — Viewing a version has no side effects**
- **Given** note `n1` currently has 3 versions and current title/content `X`
- **When** the client calls `GET /api/notes/n1/versions/1` (an older version)
- **Then** the note's current title/content remain `X`, and no new version record is created (FR-VER-003 AC-3) — the version count for `n1` remains 3.

**Scenario 10 — Version number does not exist for the note**
- **Given** an authenticated user who owns note `n1`, which has versions 1–3
- **When** the client calls `GET /api/notes/n1/versions/99`
- **Then** the system responds `404` with `VERSION_NOT_FOUND` (FRS EC-2, FRS §14.6).

**Scenario 11 — Note not found / belongs to another user / soft-deleted**
- **Given** an authenticated user
- **When** the client calls `GET /api/notes/:id/versions/:versionNumber` where the note does not exist, belongs to another user, or has `deletedAt` set
- **Then** the system responds `404` with `NOTE_NOT_FOUND` in all three cases (FRS EC-1/EC-3, same opacity decision as Scenario 6).

**Scenario 12 — Non-numeric or non-positive version number**
- **Given** an authenticated user who owns note `n1`
- **When** the client calls `GET /api/notes/n1/versions/abc` or `GET /api/notes/n1/versions/0`
- **Then** the system responds `422` with `VALIDATION_ERROR` (fails param schema before reaching the service layer).

**Scenario 13 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `GET /api/notes/:id/versions/:versionNumber`
- **Then** the system responds `401`.

### FR-VER-004 — Restore Version (`POST /api/notes/:id/versions/:versionNumber/restore`)

**Scenario 14 — Successful restore creates a new version**
- **Given** an authenticated user who owns note `n1`, currently at version 3 (title `"Current"`, content `"<p>current</p>"`), with version 1 having title `"Original"` and content `"<p>original</p>"`
- **When** the client calls `POST /api/notes/n1/versions/1/restore`
- **Then** the system updates `n1`'s current title/content to `"Original"`/`"<p>original</p>"`, creates a **new** version 4 with that same title/content, and responds `200` with `{note}` reflecting the restored content (FR-VER-004 AC-1/AC-2). Version 1's own record is untouched (BR-017).

**Scenario 15 — Version history shows the restoration as the latest version; prior versions remain accessible**
- **Given** Scenario 14 has just completed
- **When** the client calls `GET /api/notes/n1/versions`
- **Then** the list includes `[4, 3, 2, 1]` — version 4 (the restoration) is newest, and versions 1–3 are all still individually viewable via `GET /api/notes/n1/versions/:versionNumber` (FR-VER-004 AC-3/AC-4).

**Scenario 16 — Restoring the current latest version is a no-op content-wise but still creates a new version**
- **Given** note `n1` is currently at version 3
- **When** the client calls `POST /api/notes/n1/versions/3/restore`
- **Then** the system creates version 4 with identical title/content to version 3, and responds `200` with `{note}` (restore does not special-case "already current" — every restore call creates a new version per BR-009).

**Scenario 17 — Restore recomputes the search-plaintext projection**
- **Given** note `n1`'s current `contentPlain` (used by full-text search, AB-1007) reflects its pre-restore content
- **When** a version is restored
- **Then** `contentPlain` is recomputed from the restored version's content (same `extractPlainText` step `updateNote` already applies), keeping the search index consistent with the visible note content.

**Scenario 18 — Version not found**
- **Given** an authenticated user who owns note `n1`, which has versions 1–3
- **When** the client calls `POST /api/notes/n1/versions/99/restore`
- **Then** the system responds `404` with `VERSION_NOT_FOUND` (FRS EC-2) and does not modify the note or create a new version.

**Scenario 19 — Note not found / belongs to another user**
- **Given** an authenticated user
- **When** the client calls `POST /api/notes/:id/versions/:versionNumber/restore` where the note does not exist or belongs to another user
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (FRS EC-1/EC-3).

**Scenario 20 — Note is soft-deleted**
- **Given** an authenticated user whose note `n3` has `deletedAt` set
- **When** the client calls `POST /api/notes/n3/versions/:versionNumber/restore`
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (FR-VER-004 EC-4 — precondition "note is not soft-deleted"; no distinct error code is defined for this case in FRS §14.6, so it resolves to the same opacity pattern as Scenario 6/11) and does not modify the note or create a new version.

**Scenario 21 — Non-numeric or non-positive version number**
- **Given** an authenticated user who owns note `n1`
- **When** the client calls `POST /api/notes/n1/versions/abc/restore`
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 22 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `POST /api/notes/:id/versions/:versionNumber/restore`
- **Then** the system responds `401`.

### FR-VER-005 — Auto-Purge Old Versions (background process, no API surface)

**Scenario 23 — Versions beyond the 90-day window and beyond the 10 most-recent are purged**
- **Given** note `n1` has 15 versions, the 8 oldest of which have `createdAt` more than 90 days in the past
- **When** the purge process runs
- **Then** it retains the 10 most recent versions (versions 6–15) regardless of age, and permanently deletes the 5 versions that are both older than 90 days AND outside the 10 most-recent (versions 1–5) (BR-018/BR-019, SDS §26.4 steps 1–3).

**Scenario 24 — Fewer than 10 versions exist**
- **Given** note `n2` has 6 versions, all older than 90 days
- **When** the purge process runs
- **Then** no versions are deleted for `n2` (BR-018 — minimum 10 retained overrides the 90-day age rule).

**Scenario 25 — No versions older than 90 days**
- **Given** note `n3` has 12 versions, all created within the last 90 days
- **When** the purge process runs
- **Then** no versions are deleted for `n3`.

**Scenario 26 — Purge is scoped per note, not globally**
- **Given** note `n1` (per Scenario 23) and note `n4` with only 3 versions, all older than 90 days
- **When** the purge process runs
- **Then** `n1` loses its 5 eligible versions while `n4` keeps all 3 (BR-018 evaluated independently per note, SDS §26.4 step 1 "for each note").

## 4. API / Interface Contract

| Method | Path | Auth | Request Body / Params | Success Response | Error Responses |
| ------ | ---- | ---- | ---------------------- | ----------------- | ---------------- |
| GET | `/api/notes/:id/versions` | Yes | — | `200 {versions}` | `404 NOTE_NOT_FOUND`, `401 TOKEN_*` |
| GET | `/api/notes/:id/versions/:versionNumber` | Yes | — | `200 {version}` | `404 NOTE_NOT_FOUND`, `404 VERSION_NOT_FOUND`, `422 VALIDATION_ERROR`, `401 TOKEN_*` |
| POST | `/api/notes/:id/versions/:versionNumber/restore` | Yes | — | `200 {note}` | `404 NOTE_NOT_FOUND`, `404 VERSION_NOT_FOUND`, `422 VALIDATION_ERROR`, `401 TOKEN_*` |

**Validation rules (enforced via Zod schema in `packages/shared/src/schemas/version.schemas.ts`, currently a stub `export {}`):**
- `id` (note ID path param): reuses `NoteIdParamSchema` (`z.string().uuid()`), already defined in `note.schemas.ts`.
- `versionNumber` (path param): coerced to a positive integer (`z.coerce.number().int().min(1)`); non-numeric or `< 1` values fail validation before reaching the service layer (Scenarios 12, 21).

**Error code resolution (decision, since FRS §14.6 only defines `VERSION_NOT_FOUND` without disambiguating every EC by exact code):**
- All three endpoints: note doesn't exist / isn't owned / is soft-deleted → `NOTE_NOT_FOUND` (consistent with every other authenticated note-scoped endpoint's opacity pattern, AB-1004/1005/1006/1007/1008).
- `GET .../versions/:versionNumber` and restore: note exists and is owned (and not soft-deleted), but the requested `versionNumber` has no matching `NoteVersion` row → `VERSION_NOT_FOUND`.

**Response shapes:**
```json
// GET /api/notes/:id/versions — 200
{
  "versions": [
    {
      "versionNumber": 3,
      "title": "string",
      "contentPreview": "string (max 200 chars)",
      "createdAt": "ISO 8601"
    }
  ]
}
```
```json
// GET /api/notes/:id/versions/:versionNumber — 200
{
  "version": {
    "versionNumber": 2,
    "title": "string",
    "content": "string (full)",
    "createdAt": "ISO 8601"
  }
}
```
```json
// POST /api/notes/:id/versions/:versionNumber/restore — 200
{
  "note": {
    "id": "uuid",
    "title": "string",
    "content": "string",
    "tags": [ { "id": "uuid", "name": "string", "color": "#RRGGBB" } ],
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
}
```

**Error format (SDS §19.1):** `{error: {code, message, details: []}}`, unchanged from prior tickets.

## 5. Data Model Impact

- **No new Prisma models or migrations.** `NoteVersion` already exists in `schema.prisma` (SDS §15, delivered by AB-1001): `id`, `noteId`, `versionNumber` (unique per `noteId`), `title`, `content`, `createdAt`. This ticket implements the read/restore/purge logic that queries and writes it — creation itself is already wired into `createNote`/`updateNote` (AB-1004).
- **New Zod schemas/types** in `packages/shared` (currently stub `export {}` files): `packages/shared/src/schemas/version.schemas.ts` (list-item, full-version, and restore-response schemas; `versionNumber` param schema) and `packages/shared/src/types/version.types.ts` (`z.infer` exports).
- **New constants needed** in `packages/shared/src/constants/limits.ts` (none currently exist for versions): `VERSION_PREVIEW_LENGTH` (200, FR-VER-002 AC-3) and `VERSION_RETENTION_DAYS` (90) / `VERSION_MIN_RETAINED` (10, FR-VER-005).
- **`ERROR_CODES.VERSION_NOT_FOUND`** already exists in `packages/shared/src/constants/errors.ts` (mapped to `404`) — no change needed there.
- **Restore must recompute `contentPlain`** (the plaintext projection consumed by AB-1007's full-text search trigger) from the restored version's content, mirroring `updateNote`'s `extractPlainText` step (Scenario 17). The restored content is reused as-is (already sanitized when the version was originally captured) — no re-`sanitizeNoteHtml` pass is needed.
- **Open questions for `/plan`:**
  1. **Module boundary:** whether version endpoints live in a new `versions` module (router/controller/service/errors, mirroring `share`'s pattern of mounting nested paths under a sibling module) or are added directly to the existing `notes` module. AB-1008 (`share`) set the precedent of a separate module for a note-nested sub-resource.
  2. **Auto-purge trigger mechanism:** FRS/SDS specify *what* to purge (SDS §26.4) but not *how* it's scheduled — no scheduler dependency (e.g., `node-cron`) currently exists in `apps/backend/package.json`, and CON-001 fixes the tech stack. Candidates: a periodic `setInterval` started at server bootstrap, or a standalone script invoked by an external OS-level cron — needs a decision before implementation, plus a way to unit-test the purge query logic independently of *when* it fires.
  3. **Purge query shape:** confirm whether the "keep 10 most recent, delete rest if >90 days" logic is expressible as a single Prisma query per note (e.g. `skip: 10` on a descending order) or requires raw SQL similar to AB-1007's search implementation.

## 6. Out of Scope

- Frontend Version History Drawer (UX-SCR-012) — later frontend ticket (AB-1015).
- Version snapshot creation on note create/update (FR-VER-001) — already implemented in AB-1004.
- Editing or individually deleting a specific version record (BR-017 — versions are immutable outside of the bulk auto-purge process).
- Diffing between versions or highlighting changes — not present anywhere in FRS/SDS for this ticket.
