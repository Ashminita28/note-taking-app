# AB-1006 — Backend Tags CRUD + Note Counts Spec

## 1. Ticket

- **ID:** AB-1006
- **Title:** Backend Tags CRUD + Note Counts
- **Dependencies:** AB-1004 (Backend Notes CRUD + Soft Delete) — confirmed complete (`openspec/archive/AB-1004`, merged via PR #4 / commit `7da3755`). The `Note`, `Tag`, `NoteTag` Prisma models and `requireAuth` middleware already exist and are consumed as-is. AB-1005 (Backend Notes List) is also complete (`openspec/archive/AB-1005`, merged via PR #5 / commit `d6da308`) and already reads `Tag`/`NoteTag` rows for filtering — this ticket does not modify that read path, only adds the tag-owning endpoints.
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-TAG-001 | The system SHALL allow authenticated users to create user-scoped tags with a name and optional color. |
| FR-TAG-002 | The system SHALL return all tags belonging to the authenticated user, each with a count of associated non-deleted notes. |
| FR-TAG-003 | The system SHALL allow users to update a tag's name and/or color. |
| FR-TAG-004 | The system SHALL allow users to delete a tag. The tag is removed from all associated notes. |

**Business rules in scope:**
- BR-002 — a user can only access, modify, or delete their own tags (mirrors note ownership rule; foreign-owned tag access returns 404, not 403, per `CLAUDE.md`).
- BR-004 — a note can have zero or more tags; a tag can be associated with zero or more notes (`NoteTag` join table).
- BR-005 — tag names are unique within a user's scope, compared case-insensitively.

## 3. Scenarios

### FR-TAG-001 — Create Tag (`POST /api/tags`)

**Scenario 1 — Create with name and color**
- **Given** an authenticated user with no tag named "Work"
- **When** the client calls `POST /api/tags` with `{name: "Work", color: "#FF5733"}`
- **Then** the system responds `201` with the created tag `{id, name: "Work", color: "#FF5733", createdAt, updatedAt}`.

**Scenario 2 — Create with name only, default color applied**
- **Given** an authenticated user with no tag named "Personal"
- **When** the client calls `POST /api/tags` with `{name: "Personal"}` (no `color`)
- **Then** the system responds `201` with the created tag using the default color `#6B7280` (SDS §15).

**Scenario 3 — Duplicate tag name, case-insensitive**
- **Given** an authenticated user who already owns a tag named "Work"
- **When** the client calls `POST /api/tags` with `{name: "WORK"}` or `{name: "work"}`
- **Then** the system responds `409` with error code `TAG_NAME_EXISTS` (BR-005).

**Scenario 4 — Tag name exceeds maximum length**
- **Given** an authenticated user
- **When** the client calls `POST /api/tags` with a `name` longer than 50 characters
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 5 — Tag name empty or whitespace-only**
- **Given** an authenticated user
- **When** the client calls `POST /api/tags` with `{name: ""}` or `{name: "   "}`
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 6 — Invalid color format**
- **Given** an authenticated user
- **When** the client calls `POST /api/tags` with `{name: "Work", color: "red"}` or any value that is not a 7-character `#RRGGBB` hex string
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 7 — Tag name trimmed before storage and uniqueness check**
- **Given** an authenticated user with no tag named "Work"
- **When** the client calls `POST /api/tags` with `{name: "  Work  "}`
- **Then** the system responds `201` with the stored tag `name` equal to `"Work"` (leading/trailing whitespace removed), and a subsequent create of `{name: "Work"}` is rejected as a duplicate.

**Scenario 8 — Tag names are scoped per user**
- **Given** user A already owns a tag named "Work"
- **When** user B calls `POST /api/tags` with `{name: "Work"}`
- **Then** the system responds `201` — the uniqueness check only considers the requesting user's own tags (BR-002, BR-005).

**Scenario 9 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `POST /api/tags`
- **Then** the `requireAuth` middleware responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate (existing AB-1002 behavior; not re-implemented here).

### FR-TAG-002 — List Tags with Note Counts (`GET /api/tags`)

**Scenario 10 — Tags returned with accurate, non-deleted note counts**
- **Given** an authenticated user who owns tag "Work" associated with 3 non-deleted notes and 1 soft-deleted note
- **When** the client calls `GET /api/tags`
- **Then** the system responds `200` with `Work` showing a note count of `3` (the soft-deleted note is excluded).

**Scenario 11 — Tags with zero notes are still returned**
- **Given** an authenticated user who owns a tag "Ideas" with no associated notes
- **When** the client calls `GET /api/tags`
- **Then** the system responds `200` with `Ideas` present in the list, note count `0`.

**Scenario 12 — Alphabetical sort by default**
- **Given** an authenticated user who owns tags "Work", "Archive", "Personal"
- **When** the client calls `GET /api/tags`
- **Then** the system responds `200` with tags ordered `["Archive", "Personal", "Work"]`.

**Scenario 13 — No tags exist**
- **Given** an authenticated user with zero tags
- **When** the client calls `GET /api/tags`
- **Then** the system responds `200` with `{tags: []}`.

**Scenario 14 — Results scoped to the authenticated user only**
- **Given** two users, each owning distinctly named tags
- **When** user A calls `GET /api/tags`
- **Then** the response contains only user A's tags — user B's tags never appear (BR-002; all queries include `WHERE userId = <authUserId>` per `CLAUDE.md`).

**Scenario 15 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `GET /api/tags`
- **Then** the system responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate.

### FR-TAG-003 — Update Tag (`PATCH /api/tags/:id`)

**Scenario 16 — Update name only**
- **Given** an authenticated user owns tag "Work" (id `t1`)
- **When** the client calls `PATCH /api/tags/t1` with `{name: "Office"}`
- **Then** the system responds `200` with the updated tag `name: "Office"`, `color` unchanged.

**Scenario 17 — Update color only**
- **Given** an authenticated user owns tag "Work" (id `t1`)
- **When** the client calls `PATCH /api/tags/t1` with `{color: "#00FF00"}`
- **Then** the system responds `200` with the updated tag `color: "#00FF00"`, `name` unchanged.

**Scenario 18 — Update both name and color**
- **Given** an authenticated user owns tag "Work" (id `t1`)
- **When** the client calls `PATCH /api/tags/t1` with `{name: "Office", color: "#00FF00"}`
- **Then** the system responds `200` with both fields updated.

**Scenario 19 — Updating name does not affect note associations**
- **Given** an authenticated user owns tag "Work" (id `t1`) associated with 2 notes
- **When** the client calls `PATCH /api/tags/t1` with `{name: "Office"}`
- **Then** the system responds `200` and the same 2 notes remain associated with the tag (only `NoteTag.tagId` reference is unaffected by a rename).

**Scenario 20 — Re-saving a tag's own unchanged name (case variant) does not self-conflict**
- **Given** an authenticated user owns tag "Work" (id `t1`)
- **When** the client calls `PATCH /api/tags/t1` with `{name: "WORK", color: "#00FF00"}`
- **Then** the system responds `200` — the uniqueness check excludes the tag being updated itself, so renaming to a case-variant of its own current name is not treated as a conflict.

**Scenario 21 — Tag not found**
- **Given** an authenticated user
- **When** the client calls `PATCH /api/tags/:id` with an `id` that does not exist
- **Then** the system responds `404` with error code `TAG_NOT_FOUND`.

**Scenario 22 — Tag belongs to another user**
- **Given** user A owns tag `t1`; user B is authenticated
- **When** user B calls `PATCH /api/tags/t1` with any valid body
- **Then** the system responds `404` with error code `TAG_NOT_FOUND` (BR-002; never `403` — ownership is not disclosed, per `CLAUDE.md`).

**Scenario 23 — New name already exists for this user**
- **Given** an authenticated user owns tags "Work" (id `t1`) and "Personal" (id `t2`)
- **When** the client calls `PATCH /api/tags/t2` with `{name: "Work"}` (or `"WORK"`, case-insensitive)
- **Then** the system responds `409` with error code `TAG_NAME_EXISTS`.

**Scenario 24 — Validation errors**
- **Given** an authenticated user owns tag `t1`
- **When** the client calls `PATCH /api/tags/t1` with an empty/whitespace-only name, a name over 50 characters, or a malformed color
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 25 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `PATCH /api/tags/:id`
- **Then** the system responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate.

### FR-TAG-004 — Delete Tag (`DELETE /api/tags/:id`)

**Scenario 26 — Delete removes tag and its note associations**
- **Given** an authenticated user owns tag "Work" (id `t1`) associated with 2 notes
- **When** the client calls `DELETE /api/tags/t1`
- **Then** the system responds `200` with a success message (SDS §18.3), the `Tag` row for `t1` is hard-deleted, both `NoteTag` rows referencing `t1` are removed (cascade), and the 2 notes themselves remain untouched (not soft-deleted, not affected — CON-007 governs *notes*, not tags, which are explicitly hard-deleted per FR-TAG-004).

**Scenario 27 — Tag not found**
- **Given** an authenticated user
- **When** the client calls `DELETE /api/tags/:id` with an `id` that does not exist
- **Then** the system responds `404` with error code `TAG_NOT_FOUND`.

**Scenario 28 — Tag belongs to another user**
- **Given** user A owns tag `t1`; user B is authenticated
- **When** user B calls `DELETE /api/tags/t1`
- **Then** the system responds `404` with error code `TAG_NOT_FOUND` (never `403`, per `CLAUDE.md`).

**Scenario 29 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `DELETE /api/tags/:id`
- **Then** the system responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate.

## 4. API / Interface Contract

| Method | Path | Auth | Request Body | Success Response | Error Responses |
| ------ | ---- | ---- | ------------- | ----------------- | ---------------- |
| GET | `/api/tags` | Yes | — | `200 {tags}` | `401 TOKEN_*` |
| POST | `/api/tags` | Yes | `{name, color?}` | `201 {tag}` | `422 VALIDATION_ERROR`, `409 TAG_NAME_EXISTS`, `401 TOKEN_*` |
| PATCH | `/api/tags/:id` | Yes | `{name?, color?}` | `200 {tag}` | `422 VALIDATION_ERROR`, `404 TAG_NOT_FOUND`, `409 TAG_NAME_EXISTS`, `401 TOKEN_*` |
| DELETE | `/api/tags/:id` | Yes | — | `200 {message}` | `404 TAG_NOT_FOUND`, `401 TOKEN_*` |

**Field validation rules (FRS §14.4, enforced via a Zod schema in `packages/shared`):**
- `name`: required on create, optional on update; 1–50 characters after trimming; rejected if empty/whitespace-only.
- `color`: optional; must match `^#[0-9A-Fa-f]{6}$` (7-character hex); defaults to `#6B7280` on create if omitted.

**Response shapes:**
```json
// GET /api/tags — 200
{
  "tags": [
    { "id": "uuid", "name": "Archive", "color": "#6B7280", "noteCount": 0 },
    { "id": "uuid", "name": "Work", "color": "#FF5733", "noteCount": 3 }
  ]
}
```
```json
// POST /api/tags — 201, PATCH /api/tags/:id — 200
{
  "tag": {
    "id": "uuid",
    "name": "Work",
    "color": "#FF5733",
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
}
```
```json
// DELETE /api/tags/:id — 200 (SDS §18.3)
{ "message": "Tag deleted successfully." }
```

**Error format (SDS §19.1):** `{error: {code, message, details: []}}`, unchanged from prior tickets.

## 5. Data Model Impact

- **No new Prisma models.** `Tag` and `NoteTag` already exist (SDS §15, delivered in AB-1001's initial migration). `Tag.@@unique([userId, name])` and `NoteTag`'s cascading FKs (`onDelete: Cascade` on both `noteId` and `tagId`) are already in place and satisfy Scenario 26's cascade behavior without further migration work for the delete path.
- **New Zod schemas** in `packages/shared` for `createTagSchema`, `updateTagSchema`, and the `Tag`/`TagWithCount` response types.
- **Open questions for `/plan`:**
  1. **Case-insensitive uniqueness enforcement (BR-005, Scenarios 3, 8, 20, 23):** the existing `@@unique([userId, name])` Prisma constraint is case-sensitive under default Postgres collation. Options to evaluate in `/plan`: (a) a Postgres `citext` column type for `Tag.name`, (b) a functional unique index on `lower(name)` added via a new migration, or (c) an application-level case-insensitive pre-check (`findFirst` with `mode: 'insensitive'`) relied upon as the sole guard, accepting a narrow race-condition window. Given AB-1004/1005 didn't touch this constraint, a migration is likely needed — decide the exact approach and whether it changes the Prisma schema before writing code.
  2. **Self-exclusion on update uniqueness check (Scenario 20):** the update path's duplicate check must exclude the tag's own current row (`where: {id: {not: id}}`) when checking for name collisions.
  3. **Note count query strategy (Scenario 10, FR-TAG-002):** decide between Prisma's `_count` with a `notes: {some: {note: {deletedAt: null}}}` filter vs. a relation load + in-memory count vs. a raw aggregate query — pick based on what filters correctly on the join table's nested `deletedAt`.

## 6. Out of Scope

- Note-side tag assignment/removal on individual notes (`PATCH /api/notes/:id` body already supports a `tags` field per AB-1004; this ticket does not change that).
- Tag-based note filtering on `GET /api/notes` — already implemented in AB-1005.
- Tag-based filtering on `GET /api/search` — AB-1007.
- Frontend Tag Management Modal (UX-SCR-010) and Dashboard sidebar tag list (UX-SCR-006) — later frontend tickets (AB-1011/1012 range).
- Sharing, version history — AB-1008, AB-1009.
