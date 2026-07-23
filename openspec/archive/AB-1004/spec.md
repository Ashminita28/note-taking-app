# AB-1004 — Backend Notes CRUD + Soft Delete Spec

## 1. Ticket

- **ID:** AB-1004
- **Title:** Backend Notes CRUD + Soft Delete
- **Dependencies:** AB-1002 (Backend Authentication) — confirmed complete (`openspec/archive/AB-1002`, status: completed). Auth middleware (`requireAuth`) is consumed as-is; no changes to it in this ticket.
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-NOTE-001 | The system SHALL allow authenticated users to create a new note with a title and rich-text content. |
| FR-NOTE-002 | The system SHALL allow authenticated users to read their own notes by ID. |
| FR-NOTE-003 | The system SHALL allow authenticated users to update the title, content, and tags of their own notes. |
| FR-NOTE-004 | The system SHALL soft-delete notes by setting a `deletedAt` timestamp. Notes SHALL remain recoverable for 30 days. |
| FR-NOTE-005 | The system SHALL allow users to restore a soft-deleted note within the 30-day recovery window. |

**Business rules in scope:** BR-002 (users only access/modify/delete their own notes; cross-user access returns 404, never 403 — CLAUDE.md), BR-003 (recovery window is exactly 30 calendar days from `deletedAt`), BR-004 (a note may have zero or more tags), BR-014 (soft-deleting a note revokes — hard-deletes — its active `ShareLink`), CON-007 (soft delete only; no physical delete of notes within 30 days).

`GET /api/notes` (list/pagination/filtering, FR-NOTE-006) is explicitly **not** covered — that is AB-1005.

## 3. Scenarios

### FR-NOTE-001 — Create Note (`POST /api/notes`)

**Scenario 1 — Successful creation with title and content**
- **Given** an authenticated user with `userId` from a verified access token
- **When** the client submits `{title: "Groceries", content: "<p>Milk, eggs</p>"}`
- **Then** the system sanitizes `content` against the SDS §23.4 tag/attribute whitelist, extracts `contentPlain` from the sanitized HTML, creates the `Note` row with `userId` from the token (never from the request body), creates a `NoteVersion` snapshot with `versionNumber: 1` capturing the saved `title`/`content`, and responds `201` with `{note: {id, title, content, tags: [], createdAt, updatedAt}}`.

**Scenario 2 — Title defaults to "Untitled"**
- **Given** an authenticated user
- **When** the client submits a create request with no `title` field (or `title: ""`)
- **Then** the system stores `title` as `"Untitled"` (`DEFAULT_NOTE_TITLE`) and the initial version snapshot uses that same default.

**Scenario 3 — Title is trimmed**
- **Given** an authenticated user
- **When** the client submits `{title: "  My Note  "}`
- **Then** the stored `title` is `"My Note"` (leading/trailing whitespace removed).

**Scenario 4 — Empty content allowed**
- **Given** an authenticated user
- **When** the client submits a create request with no `content` field
- **Then** the system stores `content: ""` and `contentPlain: ""`, and creation still succeeds.

**Scenario 5 — Tags assigned at creation**
- **Given** an authenticated user who owns tags `t1` and `t2`
- **When** the client submits `{title: "Note", tagIds: ["t1", "t2"]}`
- **Then** the system creates the note and `NoteTag` rows associating it with `t1` and `t2` in the same operation, and the response `note.tags` includes both.

**Scenario 6 — Title exceeds maximum length**
- **Given** an authenticated user
- **When** the client submits a `title` longer than 255 characters
- **Then** the system responds `422` with `VALIDATION_ERROR` and a field-level detail for `title`.

**Scenario 7 — Content exceeds maximum size**
- **Given** an authenticated user
- **When** the client submits `content` whose size exceeds 500 KB (`NOTE_CONTENT_MAX_SIZE_BYTES`)
- **Then** the system responds `413` with error code `CONTENT_TOO_LARGE`.

**Scenario 8 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `POST /api/notes`
- **Then** the `requireAuth` middleware responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate (existing AB-1002 behavior; not re-implemented here).

**Scenario 9 — Disallowed HTML is stripped, not rejected**
- **Given** an authenticated user
- **When** the client submits `content` containing a tag or attribute outside the SDS §23.4 whitelist (e.g. `<script>`, `onclick`)
- **Then** the system silently strips the disallowed markup/attributes before storage and still returns `201` — no validation error is raised solely for disallowed HTML.

### FR-NOTE-002 — Read Note (`GET /api/notes/:id`)

**Scenario 10 — Successful read of own note**
- **Given** an authenticated user who owns note `n1` (not soft-deleted)
- **When** the client calls `GET /api/notes/n1`
- **Then** the system responds `200` with `{note: {id, title, content, tags, createdAt, updatedAt}}` per SDS §18.1.

**Scenario 11 — Note not found**
- **Given** an authenticated user
- **When** the client calls `GET /api/notes/:id` with an ID that does not exist
- **Then** the system responds `404` with `NOTE_NOT_FOUND`.

**Scenario 12 — Note belongs to another user**
- **Given** an authenticated user and a note `n2` owned by a different user
- **When** the client calls `GET /api/notes/n2`
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (identical to Scenario 11 — existence of another user's note is never revealed, per BR-002).

**Scenario 13 — Soft-deleted note excluded from standard read**
- **Given** an authenticated user who owns note `n1`, which has `deletedAt` set
- **When** the client calls `GET /api/notes/n1`
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (standard read scopes on `deletedAt IS NULL` per SDS §27.2; a separate trash view is out of scope for this ticket).

**Scenario 14 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `GET /api/notes/:id`
- **Then** the system responds `401` (`TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED`).

### FR-NOTE-003 — Update Note (`PATCH /api/notes/:id`)

**Scenario 15 — Successful full update**
- **Given** an authenticated user who owns note `n1` (not soft-deleted)
- **When** the client submits `{title: "New title", content: "<p>New</p>", tagIds: ["t1"]}`
- **Then** the system sanitizes and re-extracts `contentPlain`, updates the `Note` row, replaces its `NoteTag` associations atomically to exactly `["t1"]`, creates a new `NoteVersion` snapshot with the next `versionNumber`, bumps `updatedAt`, and responds `200` with the updated note.

**Scenario 16 — Partial update creates a version snapshot too**
- **Given** an authenticated user who owns note `n1` with existing content `C`
- **When** the client submits only `{title: "Renamed"}`
- **Then** the system updates only `title`, leaves `content`/`tagIds` unchanged, and still creates a new `NoteVersion` snapshot capturing the current `title` ("Renamed") and unchanged content `C` (AF-1: a snapshot is created for consistency even on title-only edits).

**Scenario 17 — Tag associations updated atomically**
- **Given** note `n1` currently tagged `["t1", "t2"]`
- **When** the client submits `{tagIds: ["t2", "t3"]}`
- **Then** the system removes the `t1` association, keeps `t2`, adds `t3`, and all changes commit as a single transaction (either fully applied or fully rolled back).

**Scenario 18 — Note not found / belongs to another user / soft-deleted**
- **Given** an authenticated user
- **When** the client calls `PATCH /api/notes/:id` where the note does not exist, belongs to another user, or has `deletedAt` set
- **Then** the system responds `404` with `NOTE_NOT_FOUND` in all three cases (no distinguishing information leaked).

**Scenario 19 — Title exceeds maximum length**
- **Given** an authenticated user who owns note `n1`
- **When** the client submits a `title` longer than 255 characters
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 20 — Content exceeds maximum size**
- **Given** an authenticated user who owns note `n1`
- **When** the client submits `content` exceeding 500 KB
- **Then** the system responds `413` with `CONTENT_TOO_LARGE`.

**Scenario 21 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `PATCH /api/notes/:id`
- **Then** the system responds `401`.

### FR-NOTE-004 — Soft Delete Note (`DELETE /api/notes/:id`)

**Scenario 22 — Successful soft delete**
- **Given** an authenticated user who owns note `n1` (not already soft-deleted), which has an active `ShareLink`
- **When** the client calls `DELETE /api/notes/n1`
- **Then** the system sets `n1.deletedAt` to the current timestamp, hard-deletes the associated `ShareLink` row (BR-014), leaves `NoteTag` and `NoteVersion` rows untouched (SDS §27.3), and responds `200` with `{message}`.

**Scenario 23 — Note without an active share link**
- **Given** an authenticated user who owns note `n1` with no `ShareLink`
- **When** the client calls `DELETE /api/notes/n1`
- **Then** the system sets `deletedAt` and responds `200` with `{message}` — absence of a share link is not an error.

**Scenario 24 — Note not found / belongs to another user**
- **Given** an authenticated user
- **When** the client calls `DELETE /api/notes/:id` where the note does not exist or belongs to another user
- **Then** the system responds `404` with `NOTE_NOT_FOUND`.

**Scenario 25 — Note already soft-deleted**
- **Given** an authenticated user who owns note `n1` with `deletedAt` already set
- **When** the client calls `DELETE /api/notes/n1` again
- **Then** the system responds `409` with `ALREADY_DELETED`.

**Scenario 26 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `DELETE /api/notes/:id`
- **Then** the system responds `401`.

### FR-NOTE-005 — Restore Soft-Deleted Note (`POST /api/notes/:id/restore`)

**Scenario 27 — Successful restore within the 30-day window**
- **Given** an authenticated user who owns note `n1` with `deletedAt` set 10 days ago
- **When** the client calls `POST /api/notes/n1/restore`
- **Then** the system sets `n1.deletedAt` to `null`, does not create a new `ShareLink` (SDS §27.4 — user must regenerate if needed), and responds `200` with the restored note. The note is immediately visible again to standard reads (Scenario 10).

**Scenario 28 — Note not found / belongs to another user**
- **Given** an authenticated user
- **When** the client calls `POST /api/notes/:id/restore` where the note does not exist or belongs to another user
- **Then** the system responds `404` with `NOTE_NOT_FOUND`.

**Scenario 29 — Note is not soft-deleted**
- **Given** an authenticated user who owns note `n1` with `deletedAt: null`
- **When** the client calls `POST /api/notes/n1/restore`
- **Then** the system responds `409` with `NOT_DELETED`.

**Scenario 30 — Recovery window expired**
- **Given** an authenticated user who owns note `n1` with `deletedAt` set more than 30 calendar days ago (BR-003), regardless of whether a background purge has physically removed the row yet
- **When** the client calls `POST /api/notes/n1/restore`
- **Then** the system responds `410` with `RECOVERY_EXPIRED`.

**Scenario 31 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `POST /api/notes/:id/restore`
- **Then** the system responds `401`.

## 4. API / Interface Contract

| Method | Path | Auth | Request Body | Success Response | Error Responses |
| ------ | ---- | ---- | ------------- | ----------------- | ---------------- |
| POST | `/api/notes` | Yes | `{title?, content?, tagIds?}` | `201 {note}` | `413 CONTENT_TOO_LARGE`, `422 VALIDATION_ERROR`, `401 TOKEN_*` |
| GET | `/api/notes/:id` | Yes | — | `200 {note}` | `404 NOTE_NOT_FOUND`, `401 TOKEN_*` |
| PATCH | `/api/notes/:id` | Yes | `{title?, content?, tagIds?}` | `200 {note}` | `404 NOTE_NOT_FOUND`, `413 CONTENT_TOO_LARGE`, `422 VALIDATION_ERROR`, `401 TOKEN_*` |
| DELETE | `/api/notes/:id` | Yes | — | `200 {message}` | `404 NOTE_NOT_FOUND`, `409 ALREADY_DELETED`, `401 TOKEN_*` |
| POST | `/api/notes/:id/restore` | Yes | — | `200 {note}` | `404 NOTE_NOT_FOUND`, `409 NOT_DELETED`, `410 RECOVERY_EXPIRED`, `401 TOKEN_*` |

**Validation rules (FRS §13.2, enforced via Zod schemas in `packages/shared/src/schemas/note.schemas.ts`):**
- `title`: optional, defaults to `"Untitled"`, 0–255 chars after trim.
- `content`: optional, defaults to `""`, max 500 KB (`NOTE_CONTENT_MAX_SIZE_BYTES`).
- `tagIds`: optional array of UUIDs.

**Error format (SDS §19.1/19.2):** `{error: {code, message, details: []}}`, unchanged from AB-1002/AB-1003.

**Response shape (SDS §18.1/18.3):** single-resource `{note: {...}}` on create/read/update/restore; `{message}` on delete.

**Content pipeline (SDS §23.2, §23.4):**
1. Sanitize incoming `content` HTML against the whitelist (tags: `p, h1–h6, ul, ol, li, blockquote, pre, code, em, strong, u, s, a, br, mark, span, div, input[checkbox], label`; attributes: `href, class, data-type, data-checked, style[text-align only]`).
2. Extract `contentPlain` from the sanitized HTML via a server-side HTML-to-text utility.
3. Persist both `content` (sanitized HTML) and `contentPlain`. The `searchVector` column/GIN index/trigger themselves are **not** created by this ticket (AB-1007) — this ticket only needs `contentPlain` populated correctly so that trigger, once added, works retroactively.

**Version snapshot behavior (FR-VER-001 prep):** every successful create or update inserts one `NoteVersion` row with an incrementing `versionNumber` (starting at 1), capturing `title` and `content` at save time. No version-read/restore endpoints are implemented here (AB-1009).

## 5. Data Model Impact

- **No new Prisma models or migrations.** `Note`, `NoteTag`, `NoteVersion`, and `ShareLink` already exist in `schema.prisma` (SDS §15, delivered by AB-1001). This ticket implements the service/controller logic that reads and writes them.
- **New Zod schemas/types** in `packages/shared` (currently stub `export {}` files, per `packages/shared/CLAUDE.md`): `packages/shared/src/schemas/note.schemas.ts` (create/update request schemas, note response schema) and `packages/shared/src/types/note.types.ts` (`z.infer` exports only).
- **Open questions for `/plan`:**
  1. **Sanitizer library:** no HTML sanitizer or HTML-to-text utility is currently installed in `apps/backend`. Need to pick both (e.g. `sanitize-html` covers both use cases) — CON-001/CON-008 require pinned versions, no `@latest`.
  2. **Tag ownership on `tagIds`:** FRS/SDS do not specify the error behavior when `tagIds` references a tag that doesn't exist or belongs to another user. Recommend treating it the same as any other cross-user resource access — silently ignore unknown/foreign tag IDs, or reject with `404 NOTE_NOT_FOUND`-style opacity? Needs a decision before implementation (no error code is reserved for this in FRS §14.3/14.4).
  3. **"Sharing status" in read response:** FR-NOTE-002 AC2 mentions the note response should include "sharing status," but the SDS §18.1 example response shape has no such field, and share endpoints are AB-1008. Recommend deferring this field to AB-1008 and keeping this ticket's response shape exactly as SDS §18.1 shows — flagging for confirmation.
  4. **Recovery-window boundary:** BR-003 says "exactly 30 calendar days." Confirm the check is `now > deletedAt + 30 days` (strict) rather than `>=`, and that it's calendar days (24h × 30) not business days.

## 6. Out of Scope

- `GET /api/notes` list/pagination/sorting/tag-filtering — AB-1005.
- Tags CRUD, tag validation, and note counts — AB-1006.
- `GET /api/search`, the `searchVector` column, GIN index, and update trigger migration — AB-1007 (this ticket only populates `contentPlain`).
- Share link generation/regeneration (`POST /api/notes/:id/share`, `DELETE /api/notes/:id/share`, `GET /api/shares`, `GET /api/shared/:token`) — AB-1008. Only the soft-delete side effect (hard-deleting an existing `ShareLink`, BR-014) is implemented here.
- Version history read/restore endpoints (`GET /api/notes/:id/versions`, etc.) — AB-1009. Only snapshot *creation* is implemented here.
- Frontend note editor (UX-SCR-007) and delete confirmation dialog (UX-SCR-008) — AB-1012.
- Permanent purge of notes soft-deleted beyond 30 days (SDS §27.5 background job) — not assigned to any ticket in scope yet.
