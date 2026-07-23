# AB-1008 — Backend Sharing Spec

## 1. Ticket

- **ID:** AB-1008
- **Title:** Backend Sharing
- **Dependencies:** AB-1004 (Backend Notes CRUD + Soft Delete) — confirmed complete (`openspec/archive/AB-1004`, status: completed). AB-1004 already implements the soft-delete side effect of hard-deleting an active `ShareLink` (BR-014, SDS §27.3) — this ticket consumes that behavior as-is and does not re-implement it. `ShareLink` Prisma model already exists (SDS §15/§13.2.6, delivered by AB-1001).
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-SHARE-001 | The system SHALL allow authenticated users to generate a public read-only share link for a note, with a configurable expiry period. |
| FR-SHARE-002 | The system SHALL allow anyone with a valid share link to view the note in read-only mode, and SHALL atomically increment the view count. |
| FR-SHARE-003 | The system SHALL allow the note owner to revoke an active share link. |
| FR-SHARE-004 | The system SHALL allow authenticated users to list all their active (non-expired) share links with metadata. |

**Business rules in scope:** BR-002 (users only access/modify their own notes; cross-user access returns 404, never 403 — `CLAUDE.md`), BR-006 (a note may have at most one active share link at any time), BR-007 (expiry configurable 1h–720h, default 168h/7d), BR-020 (view count increments atomically). BR-014 (soft delete revokes share link) is **consumed, not implemented**, here — see Dependencies.

## 3. Scenarios

### FR-SHARE-001 — Generate Share Link (`POST /api/notes/:id/share`)

**Scenario 1 — Successful generation with default expiry**
- **Given** an authenticated user who owns note `n1` (not soft-deleted, no existing share link)
- **When** the client calls `POST /api/notes/n1/share` with an empty body
- **Then** the system generates a UUID v4 token, creates a `ShareLink` row with `expiresAt` = now + 168 hours (`DEFAULT_SHARE_EXPIRY_HOURS`) and `viewCount: 0`, and responds `201` with `{shareLink: {token, url, expiresAt, viewCount: 0, createdAt}}` where `url` is `{FRONTEND_URL}/shared/{token}` (SDS §25.1).

**Scenario 2 — Successful generation with custom expiry**
- **Given** an authenticated user who owns note `n1` with no existing share link
- **When** the client calls `POST /api/notes/n1/share` with `{expiresInHours: 24}`
- **Then** the system creates a `ShareLink` with `expiresAt` = now + 24 hours and responds `201` with the share link metadata.

**Scenario 3 — Existing active link is returned, not duplicated**
- **Given** an authenticated user who owns note `n1`, which already has an active (non-expired) `ShareLink`
- **When** the client calls `POST /api/notes/n1/share` again (regardless of requested `expiresInHours`)
- **Then** the system does **not** create a new row, and responds `201` with the existing share link's `{token, url, expiresAt, viewCount, createdAt}` unchanged (FRS AF-1, BR-006).

**Scenario 4 — Expired existing link is replaced**
- **Given** an authenticated user who owns note `n1`, which has a `ShareLink` whose `expiresAt` is in the past
- **When** the client calls `POST /api/notes/n1/share`
- **Then** the system replaces the expired row (delete + recreate, or update in place) with a new token and new `expiresAt`, and responds `201` with the new share link (an expired link is not "active" per BR-006, so this is not a duplicate).

**Scenario 5 — Note not found / belongs to another user / soft-deleted**
- **Given** an authenticated user
- **When** the client calls `POST /api/notes/:id/share` where the note does not exist, belongs to another user, or has `deletedAt` set
- **Then** the system responds `404` with `NOTE_NOT_FOUND` in all three cases (no distinguishing information leaked, mirrors AB-1004 Scenario 18).

**Scenario 6 — Invalid expiry (too low)**
- **Given** an authenticated user who owns note `n1`
- **When** the client calls `POST /api/notes/n1/share` with `{expiresInHours: 0}`
- **Then** the system responds `422` with `VALIDATION_ERROR` (below `SHARE_EXPIRY_MIN_HOURS`, FRS EC-4).

**Scenario 7 — Invalid expiry (too high)**
- **Given** an authenticated user who owns note `n1`
- **When** the client calls `POST /api/notes/n1/share` with `{expiresInHours: 721}`
- **Then** the system responds `422` with `VALIDATION_ERROR` (above `SHARE_EXPIRY_MAX_HOURS`, FRS EC-4).

**Scenario 8 — Non-integer or non-numeric expiry**
- **Given** an authenticated user who owns note `n1`
- **When** the client calls `POST /api/notes/n1/share` with `{expiresInHours: "soon"}` or `{expiresInHours: 12.5}`
- **Then** the system responds `422` with `VALIDATION_ERROR`.

**Scenario 9 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `POST /api/notes/:id/share`
- **Then** the `requireAuth` middleware responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate (existing AB-1002 behavior; not re-implemented here) (FRS EC-5).

### FR-SHARE-002 — Access Shared Note (`GET /api/shared/:token`, public)

**Scenario 10 — Successful public access**
- **Given** a valid, non-expired `ShareLink` with token `tok1` for note `n1` (not soft-deleted), owned by user with `name: "Jane Doe"`
- **When** any client (no `Authorization` header required) calls `GET /api/shared/tok1`
- **Then** the system atomically increments `viewCount` (SDS §25.3 `UPDATE ... SET "viewCount" = "viewCount" + 1 ... RETURNING *`) and responds `200` with `{note: {title, content, authorName: "Jane Doe", createdAt}}` — no `id`, `tags`, `updatedAt`, or version data included (FRS AC-5/AC-6).

**Scenario 11 — Concurrent access increments atomically**
- **Given** a valid `ShareLink` with token `tok1` and `viewCount: 5`
- **When** 10 concurrent `GET /api/shared/tok1` requests are made
- **Then** the final `viewCount` is exactly `15` — no lost updates under concurrency (FRS AC-3, SDS §25.3, BR-020).

**Scenario 12 — Share token not found**
- **Given** no `ShareLink` row exists with the given token
- **When** the client calls `GET /api/shared/:token`
- **Then** the system responds `404` with `SHARE_LINK_NOT_FOUND` (FRS EC-1) and does **not** increment any view count.

**Scenario 13 — Share link expired**
- **Given** a `ShareLink` with token `tok1` whose `expiresAt` is in the past
- **When** the client calls `GET /api/shared/tok1`
- **Then** the system responds `410` with `SHARE_LINK_EXPIRED` (FRS EC-2), and does **not** increment `viewCount` (the atomic update's `WHERE "expiresAt" > NOW()` clause naturally excludes it, SDS §25.3).

**Scenario 14 — Associated note has been soft-deleted**
- **Given** a `ShareLink` with token `tok1` whose note has `deletedAt` set (note: AB-1004's soft-delete flow hard-deletes the `ShareLink` itself, so this only occurs if soft-delete and share-link revocation were not atomic, or as a defensive check)
- **When** the client calls `GET /api/shared/tok1`
- **Then** the system responds `404` with `SHARE_LINK_NOT_FOUND` (FRS EC-3 — treated identically to token-not-found from the public caller's perspective; no internal state is leaked).

### FR-SHARE-003 — Revoke Share Link (`DELETE /api/notes/:id/share`)

**Scenario 15 — Successful revocation**
- **Given** an authenticated user who owns note `n1`, which has an active `ShareLink`
- **When** the client calls `DELETE /api/notes/n1/share`
- **Then** the system hard-deletes the `ShareLink` row and responds `200` with `{message}`.

**Scenario 16 — Revoked link is immediately inaccessible**
- **Given** a `ShareLink` with token `tok1` has just been revoked via Scenario 15
- **When** any client calls `GET /api/shared/tok1`
- **Then** the system responds `404` with `SHARE_LINK_NOT_FOUND` (FRS AC-2).

**Scenario 17 — Note not found / belongs to another user**
- **Given** an authenticated user
- **When** the client calls `DELETE /api/notes/:id/share` where the note does not exist or belongs to another user
- **Then** the system responds `404` with `NOTE_NOT_FOUND` (FRS EC-1/EC-3 — mirrors AB-1004 opacity pattern; existence of another user's note is never revealed).

**Scenario 18 — Note has no active share link**
- **Given** an authenticated user who owns note `n1` with no `ShareLink` (or only an expired one)
- **When** the client calls `DELETE /api/notes/n1/share`
- **Then** the system responds `404` with `SHARE_LINK_NOT_FOUND` (FRS EC-2 — distinct from `NOTE_NOT_FOUND` since the note itself exists and is owned by the caller; only the share resource is absent).

**Scenario 19 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `DELETE /api/notes/:id/share`
- **Then** the system responds `401` (FRS EC-4).

### FR-SHARE-004 — List Active Share Links (`GET /api/shares`)

**Scenario 20 — Successful listing**
- **Given** an authenticated user who owns notes `n1` (active share link) and `n2` (active share link)
- **When** the client calls `GET /api/shares`
- **Then** the system responds `200` with `{shares: [...]}`, each entry containing `{noteId, noteTitle, url, expiresAt, viewCount, createdAt}` for both links (FRS AC-2).

**Scenario 21 — Expired links excluded**
- **Given** an authenticated user who owns note `n1` (active share link) and note `n3` (share link with `expiresAt` in the past)
- **When** the client calls `GET /api/shares`
- **Then** the response includes only `n1`'s link — `n3`'s expired link is excluded (FRS AC-1).

**Scenario 22 — No active share links**
- **Given** an authenticated user with no notes that have active share links
- **When** the client calls `GET /api/shares`
- **Then** the system responds `200` with `{shares: []}`.

**Scenario 23 — Results scoped to the authenticated user only**
- **Given** user A owns note `n1` with an active share link, and user B owns note `n4` with an active share link
- **When** user A calls `GET /api/shares`
- **Then** the response contains only `n1`'s share link — user B's link never appears (all queries include `WHERE userId = <authUserId>` per `CLAUDE.md`).

**Scenario 24 — Unauthenticated request**
- **Given** no valid access token
- **When** the client calls `GET /api/shares`
- **Then** the system responds `401`.

## 4. API / Interface Contract

| Method | Path | Auth | Request Body / Params | Success Response | Error Responses |
| ------ | ---- | ---- | ---------------------- | ----------------- | ---------------- |
| POST | `/api/notes/:id/share` | Yes | `{expiresInHours?}` | `201 {shareLink}` | `404 NOTE_NOT_FOUND`, `422 VALIDATION_ERROR`, `401 TOKEN_*` |
| DELETE | `/api/notes/:id/share` | Yes | — | `200 {message}` | `404 NOTE_NOT_FOUND`, `404 SHARE_LINK_NOT_FOUND`, `401 TOKEN_*` |
| GET | `/api/shares` | Yes | — | `200 {shares}` | `401 TOKEN_*` |
| GET | `/api/shared/:token` | No | — | `200 {note}` | `404 SHARE_LINK_NOT_FOUND`, `410 SHARE_LINK_EXPIRED` |

**Validation rules (enforced via Zod schema in `packages/shared/src/schemas/share.schemas.ts`):**
- `expiresInHours`: optional, integer, `SHARE_EXPIRY_MIN_HOURS` (1) – `SHARE_EXPIRY_MAX_HOURS` (720), defaults to `DEFAULT_SHARE_EXPIRY_HOURS` (168) if omitted.

**Error code resolution (decision, since FRS §14.5 only lists `SHARE_LINK_EXPIRED`/`SHARE_LINK_NOT_FOUND` without disambiguating every EC by exact code):**
- `POST`/`DELETE /api/notes/:id/share`: note doesn't exist / isn't owned / is soft-deleted → `NOTE_NOT_FOUND` (consistent with every other authenticated note-scoped endpoint's opacity pattern, AB-1004/1005/1006/1007).
- `DELETE /api/notes/:id/share` only: note exists and is owned, but has no active share link → `SHARE_LINK_NOT_FOUND` (the note resource is fine; only the share sub-resource is missing).
- `GET /api/shared/:token`: token doesn't exist, or exists but its note is soft-deleted → `SHARE_LINK_NOT_FOUND` (public caller has no concept of "note"; both cases mean "this link doesn't work"). Token exists but past `expiresAt` → `SHARE_LINK_EXPIRED`.

**Response shapes:**
```json
// POST /api/notes/:id/share and existing-link path — 201
{
  "shareLink": {
    "token": "uuid-v4",
    "url": "https://.../shared/uuid-v4",
    "expiresAt": "ISO 8601",
    "viewCount": 0,
    "createdAt": "ISO 8601"
  }
}
```
```json
// GET /api/shares — 200
{
  "shares": [
    {
      "noteId": "uuid",
      "noteTitle": "string",
      "url": "https://.../shared/uuid-v4",
      "expiresAt": "ISO 8601",
      "viewCount": 0,
      "createdAt": "ISO 8601"
    }
  ]
}
```
```json
// GET /api/shared/:token — 200 (read-only public view, SDS §25.2 step 5)
{
  "note": {
    "title": "string",
    "content": "string",
    "authorName": "string",
    "createdAt": "ISO 8601"
  }
}
```
```json
// DELETE /api/notes/:id/share — 200
{ "message": "Share link revoked successfully." }
```

**Error format (SDS §19.1):** `{error: {code, message, details: []}}`, unchanged from prior tickets.

## 5. Data Model Impact

- **No new Prisma models or migrations.** `ShareLink` already exists in `schema.prisma` (SDS §15/§13.2.6, delivered by AB-1001): `id`, `noteId` (unique — enforces BR-006 at the DB level), `token` (unique), `viewCount`, `expiresAt`, `createdAt`. This ticket implements the service/controller logic that reads and writes it.
- **New Zod schemas/types** in `packages/shared` (currently stub `export {}` files): `packages/shared/src/schemas/share.schemas.ts` (`createShareSchema` for the request body) and `packages/shared/src/types/share.types.ts` (`z.infer` exports for `ShareLink`, `SharedNoteView`, etc.).
- **All relevant constants already exist** in `packages/shared/src/constants/`: `SHARE_EXPIRY_MIN_HOURS`, `SHARE_EXPIRY_MAX_HOURS` (`limits.ts`), `DEFAULT_SHARE_EXPIRY_HOURS` (`defaults.ts`), `SHARE_LINK_EXPIRED`, `SHARE_LINK_NOT_FOUND` (`errors.ts`) — no new constants needed.
- **Atomic view count:** requires a raw SQL query (Prisma `$queryRaw`/`$executeRaw` tagged template) per SDS §25.3, since Prisma's query builder has no atomic "increment + conditionally return" primitive in one round trip. Must be parameterized (no string concatenation) for injection safety.
- **Open questions for `/plan`:**
  1. **Expired-link replacement (Scenario 4):** decide whether to `delete` + `create` the `ShareLink` row or `update` the existing row in place (both satisfy BR-006's one-per-note constraint; `update` avoids a race on the unique `noteId` constraint between the delete and the create).
  2. **`FRONTEND_URL` source:** confirm the env var name/config location for constructing the public `url` field (SDS §25.1 step 3) — not specified in FRS/SDS beyond the template.
  3. **Author name field:** confirmed as `User.name` (SDS §13.2.1/§15 `model User` — no separate `displayName` field exists), surfaced as `authorName` in the public response.
  4. **`GET /api/shares` note title for a soft-deleted note's link:** not reachable in practice since soft-delete hard-deletes the `ShareLink` (BR-014), but confirm no additional filter is needed defensively.

## 6. Out of Scope

- Frontend Share Modal (UX-SCR-011) and Shared Note View page (UX-SCR-013) — later frontend ticket.
- The soft-delete side effect of hard-deleting an active `ShareLink` (BR-014) — already implemented in AB-1004.
- Version history, full-text search — AB-1009 (done, AB-1007), not applicable here.
- Rate limiting on the public `/api/shared/:token` endpoint beyond the general `RATE_LIMIT_EXCEEDED` mechanism (FRS §14.7) — no share-specific rate limit is defined in FRS/SDS.
- Analytics/detailed view-count breakdowns (e.g. unique visitors, referrers) — FRS only requires a simple atomic counter.
