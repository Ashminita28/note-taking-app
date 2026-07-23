# AB-1005 — Backend Notes List (Pagination, Sorting, Filtering) Spec

## 1. Ticket

- **ID:** AB-1005
- **Title:** Backend Notes List (Pagination, Sorting, Filtering)
- **Dependencies:** AB-1004 (Backend Notes CRUD + Soft Delete) — confirmed complete (`openspec/archive/AB-1004`, merged via PR #4 / commit `7da3755`). `Note`, `Tag`, `NoteTag` Prisma models and the `requireAuth` middleware are consumed as-is; no changes to either in this ticket. AB-1006 (Backend Tags CRUD) may proceed in parallel — this ticket only reads existing `Tag`/`NoteTag` rows for filtering, it does not depend on AB-1006's endpoints.
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-NOTE-006 | The system SHALL return a paginated list of the authenticated user's notes with sorting and tag filtering options. |

**Business rules in scope:** BR-002 (users only see their own notes; results are always scoped to `userId` from the verified access token), BR-004 (a note may have zero or more tags — filtering must respect this).

`POST/GET(single)/PATCH/DELETE/restore /api/notes(/:id)` are already implemented (AB-1004) and are **not** touched by this ticket except that the same `Note` rows are read here.

## 3. Scenarios

### FR-NOTE-006 — List Notes (`GET /api/notes`)

**Scenario 1 — Default pagination**
- **Given** an authenticated user with 25 non-deleted notes
- **When** the client calls `GET /api/notes` with no query parameters
- **Then** the system responds `200` with `data` containing the first 20 notes (page 1, default sort `updatedAt desc`) and `pagination: {page: 1, pageSize: 20, totalItems: 25, totalPages: 2}`.

**Scenario 2 — Explicit page and pageSize**
- **Given** an authenticated user with 25 non-deleted notes
- **When** the client calls `GET /api/notes?page=2&pageSize=10`
- **Then** the system responds `200` with the 10 notes at offset 10–19 (sorted by default) and `pagination: {page: 2, pageSize: 10, totalItems: 25, totalPages: 3}`.

**Scenario 3 — Page beyond available results**
- **Given** an authenticated user with 5 non-deleted notes
- **When** the client calls `GET /api/notes?page=3&pageSize=20`
- **Then** the system responds `200` with `data: []` and `pagination: {page: 3, pageSize: 20, totalItems: 5, totalPages: 1}` (not an error — SDS §18.2 shape is always returned).

**Scenario 4 — Sort by each allowed field, both directions**
- **Given** an authenticated user with several notes of differing `title`, `createdAt`, `updatedAt`
- **When** the client calls `GET /api/notes?sortBy=title&sortOrder=asc` (and equivalently for `createdAt`/`updatedAt`, `asc`/`desc`)
- **Then** the system responds `200` with `data` ordered by the requested field/direction; all six `sortBy`×`sortOrder` combinations behave correctly.

**Scenario 5 — Deterministic ordering on tied sort values**
- **Given** an authenticated user with two or more notes sharing the same value for the active `sortBy` field (e.g. identical `updatedAt` timestamps)
- **When** the client requests any page of the list
- **Then** the system applies a secondary sort by `id asc` so that relative ordering is stable and identical across repeated requests and across pages (prevents duplicate/skipped rows when paginating).

**Scenario 6 — Tag filtering, single tag**
- **Given** an authenticated user who owns tag `t1`, with 3 notes tagged `t1` and 2 notes without it
- **When** the client calls `GET /api/notes?tagIds=t1`
- **Then** the system responds `200` with only the 3 notes tagged `t1`, and correct `pagination.totalItems: 3`.

**Scenario 7 — Tag filtering, multiple tags use AND logic**
- **Given** an authenticated user who owns tags `t1` and `t2`, with note `n1` tagged `[t1, t2]`, note `n2` tagged `[t1]` only, and note `n3` tagged `[t2]` only
- **When** the client calls `GET /api/notes?tagIds=t1,t2`
- **Then** the system responds `200` with only `n1` in `data` (must have **all** specified tags — AND, not OR).

**Scenario 8 — Tag filter matches no notes**
- **Given** an authenticated user who owns tags `t1` and `t2`, with no note tagged with both
- **When** the client calls `GET /api/notes?tagIds=t1,t2`
- **Then** the system responds `200` with `data: []` and `pagination.totalItems: 0` (empty result, not an error).

**Scenario 9 — Tag filter references a well-formed but non-existent or foreign-owned tag ID**
- **Given** an authenticated user and a syntactically valid UUID that does not correspond to any tag owned by that user (either it doesn't exist, or it belongs to another user)
- **When** the client calls `GET /api/notes?tagIds=<that-uuid>`
- **Then** the system responds `200` with `data: []` (the filter simply matches zero notes — no notes can be associated with a tag the user doesn't own, consistent with BR-002's opacity principle; this is **not** treated as a validation error since the UUID itself is well-formed). *(Assumption — flag for confirmation in `/plan` if a different behavior is desired.)*

**Scenario 10 — Soft-deleted notes excluded by default**
- **Given** an authenticated user with 5 non-deleted notes and 2 soft-deleted notes (`deletedAt` set)
- **When** the client calls `GET /api/notes` (no `includeTrashed`)
- **Then** the system responds `200` with `data` containing only the 5 non-deleted notes and `pagination.totalItems: 5`.

**Scenario 11 — Trash view via `includeTrashed=true`**
- **Given** an authenticated user with 5 non-deleted notes and 2 soft-deleted notes
- **When** the client calls `GET /api/notes?includeTrashed=true`
- **Then** the system responds `200` with `data` containing only the 2 soft-deleted notes (trash view — mirrors UX-SCR-006's "toggle trash view" and FRS AF-2, which filters to trashed notes only, not a mixed active+trashed list) and `pagination.totalItems: 2`.

**Scenario 12 — No notes exist**
- **Given** an authenticated user with zero notes
- **When** the client calls `GET /api/notes`
- **Then** the system responds `200` with `data: []` and `pagination: {page: 1, pageSize: 20, totalItems: 0, totalPages: 0}`.

**Scenario 13 — Results scoped to the authenticated user only**
- **Given** two users, each owning notes
- **When** user A calls `GET /api/notes`
- **Then** the response `data` contains only user A's notes — user B's notes never appear, regardless of sort/filter/pagination parameters (BR-002; all queries include `WHERE userId = <authUserId>` per `CLAUDE.md`).

**Scenario 14 — Invalid `page` or `pageSize`**
- **Given** an authenticated user
- **When** the client calls `GET /api/notes` with `page=0`, `page=-1`, a non-integer `page`, `pageSize=0`, or `pageSize=101` (exceeds max 100 per FRS §13.6)
- **Then** the system responds `422` with `VALIDATION_ERROR` and a field-level detail identifying the offending parameter.

**Scenario 15 — Invalid `sortBy`**
- **Given** an authenticated user
- **When** the client calls `GET /api/notes?sortBy=invalidField` (anything other than `createdAt`, `updatedAt`, `title`)
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 16 — Invalid `sortOrder`**
- **Given** an authenticated user
- **When** the client calls `GET /api/notes?sortOrder=upwards` (anything other than `asc`, `desc`)
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 17 — Malformed `tagIds`**
- **Given** an authenticated user
- **When** the client calls `GET /api/notes?tagIds=not-a-uuid`
- **Then** the system responds `422` with `VALIDATION_ERROR` (malformed UUID, distinct from Scenario 9's well-formed-but-unowned case).

**Scenario 18 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `GET /api/notes`
- **Then** the `requireAuth` middleware responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate (existing AB-1002 behavior; not re-implemented here).

## 4. API / Interface Contract

| Method | Path | Auth | Query Params | Success Response | Error Responses |
| ------ | ---- | ---- | ------------- | ----------------- | ---------------- |
| GET | `/api/notes` | Yes | `page?, pageSize?, sortBy?, sortOrder?, tagIds?, includeTrashed?` | `200 {data, pagination}` | `422 VALIDATION_ERROR`, `401 TOKEN_*` |

**Query parameter rules (FRS §13.6, enforced via a Zod schema in `packages/shared/src/schemas/note.schemas.ts`):**
- `page`: optional, positive integer ≥ 1, default `1`.
- `pageSize`: optional, integer 1–100, default `20`.
- `sortBy`: optional, one of `createdAt` | `updatedAt` | `title`, default `updatedAt`.
- `sortOrder`: optional, one of `asc` | `desc`, default `desc`.
- `tagIds`: optional, comma-separated list of UUIDs (or repeated query param — decide exact wire format in `/plan`); each must be a syntactically valid UUID or the request is rejected with `422` (Scenario 17). A well-formed UUID that isn't an owned tag simply yields no matches (Scenario 9), it is not a validation error.
- `includeTrashed`: optional boolean (`"true"`/`"false"`), default `false`. When `true`, the response is a trash view (soft-deleted notes only), not a merged active+trashed list.

**Secondary sort:** every query applies `id asc` as a tie-breaker after the requested `sortBy`/`sortOrder`, for stable pagination (Scenario 5).

**Response shape (SDS §18.2):**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string",
      "tags": [{ "id": "uuid", "name": "string", "color": "#RRGGBB" }],
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8
  }
}
```
Each note object in `data` matches the single-resource shape from SDS §18.1 (minus wrapping in `{note: ...}`).

**Error format (SDS §19.1):** `{error: {code, message, details: []}}`, unchanged from prior tickets.

## 5. Data Model Impact

- **No new Prisma models or migrations.** `Note`, `Tag`, `NoteTag` already exist (SDS §15, delivered by AB-1001). Existing indexes `@@index([userId, deletedAt])` and `@@index([userId, updatedAt(sort: Desc)])` on `Note` support the default list query; sorting by `title`/`createdAt` or filtering by tags may rely on these existing indexes without a new migration — confirm query plan in `/plan` if performance work is needed.
- **No new Zod schemas beyond query validation.** Extends `packages/shared/src/schemas/note.schemas.ts` (created in AB-1004) with a `listNotesQuerySchema` (or equivalent) and corresponding `z.infer` type in `packages/shared/src/types/note.types.ts`.
- **Open questions for `/plan`:**
  1. **`tagIds` wire format:** comma-separated single query param (`?tagIds=t1,t2`) vs. repeated param (`?tagIds=t1&tagIds=t2`) vs. both accepted. Neither FRS nor SDS pins this down explicitly.
  2. **`includeTrashed` semantics confirmed as trash-only** (Scenario 11) based on UX-SCR-006's "toggle trash view" control and FRS AF-2 wording — confirm this reading is correct before implementation, since the AB-1005 scope bullet text ("support `includeTrashed` param") is ambiguous in isolation.
  3. **Tie-breaker field** (`id asc`, Scenario 5) is an implementation decision not explicitly stated in FRS/SDS — confirm no alternative (e.g. `createdAt` as secondary key) is preferred.
  4. **AND-logic query strategy:** Prisma implementation approach for "note must have all N specified tags" (e.g. `every`/`some` combinations vs. a raw `HAVING COUNT(DISTINCT tagId) = N` query) — pick an approach in `/plan` that performs acceptably as tag counts grow.

## 6. Out of Scope

- All note CRUD (`POST /api/notes`, `GET /api/notes/:id`, `PATCH /api/notes/:id`, `DELETE /api/notes/:id`, `POST /api/notes/:id/restore`) — AB-1004, already implemented.
- Tags CRUD, tag validation, and per-tag note counts — AB-1006.
- `GET /api/search` — AB-1007.
- Sharing endpoints — AB-1008.
- Version history endpoints — AB-1009.
- Frontend Dashboard / Notes List UI (UX-SCR-006) — AB-1011.
