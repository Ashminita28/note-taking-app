# AB-1007 — Backend Full-Text Search Spec

## 1. Ticket

- **ID:** AB-1007
- **Title:** Backend Full-Text Search
- **Dependencies:** AB-1004 (Backend Notes CRUD + Soft Delete) — confirmed complete (`openspec/archive/AB-1004`, merged via PR #4). AB-1004 already delivered the `searchVector` column, `idx_note_search_vector` GIN index, and the `note_search_vector_update` trigger (SDS §24.3) via migration `apps/backend/prisma/migrations/20260722081152_search_vector/`. This ticket consumes that column as-is and does not modify the trigger or migration. AB-1006 (Backend Tags CRUD, `openspec/archive/AB-1006`) is also complete and its `Tag`/`NoteTag` models are read (not modified) for the optional tag filter.
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-SRCH-001 | The system SHALL provide full-text search across note titles and content for the authenticated user, with keyword highlighting in results. |

**Business rules in scope:**
- BR-001 (implicit, mirrors all prior tickets) — a user can only search their own notes; all queries include `WHERE userId = <authUserId>` per `CLAUDE.md`.
- CON-004 — full-text search MUST use PostgreSQL's built-in capabilities (`tsvector`/`tsquery`/`ts_rank`/`ts_headline`) — no external search service (e.g. Elasticsearch, Algolia) may be substituted.
- Soft-deleted notes (`deletedAt IS NOT NULL`) are always excluded from search results (FRS Main Flow step 3).

## 3. Scenarios

### FR-SRCH-001 — Full-Text Search (`GET /api/search`)

**Scenario 1 — Basic search by title match**
- **Given** an authenticated user owns a note titled "Weekly Standup Notes"
- **When** the client calls `GET /api/search?q=standup`
- **Then** the system responds `200` with the note included in `data`, its `snippet` containing `<mark>Standup</mark>` (or the matched form), and `rank > 0`.

**Scenario 2 — Basic search by content match**
- **Given** an authenticated user owns a note whose `contentPlain` contains the word "kubernetes" but whose title does not
- **When** the client calls `GET /api/search?q=kubernetes`
- **Then** the system responds `200` with the note included in `data` and the snippet highlighting the matched term from the content.

**Scenario 3 — Stemming support**
- **Given** an authenticated user owns a note containing the word "running" in its content
- **When** the client calls `GET /api/search?q=run`
- **Then** the system responds `200` with the note included in `data` (PostgreSQL `english` dictionary stems "running" and "run" to the same lexeme, per FRS AC-5 / SDS §24.5).

**Scenario 4 — Relevance ranking: title match outranks content-only match**
- **Given** an authenticated user owns Note A with "budget" in its title and Note B with "budget" only in its content (not title)
- **When** the client calls `GET /api/search?q=budget`
- **Then** the system responds `200` with both notes in `data`, Note A ranked ahead of Note B (title weight `A` > content weight `B`, SDS §24.2/§24.4), and each result's `rank` reflecting `ts_rank`.

**Scenario 5 — No results found**
- **Given** an authenticated user owns notes, none of which contain the search term
- **When** the client calls `GET /api/search?q=nonexistentterm12345`
- **Then** the system responds `200` with `{data: [], pagination: {page: 1, pageSize: 20, totalItems: 0, totalPages: 0}}` (FRS AF-1; not an error).

**Scenario 6 — Search combined with tag filter (AND logic)**
- **Given** an authenticated user owns Note A (tagged "Work", contains "budget") and Note B (tagged "Personal", contains "budget")
- **When** the client calls `GET /api/search?q=budget&tagIds=<Work-tag-id>`
- **Then** the system responds `200` with only Note A in `data` (FRS AF-2 — search match AND tag membership, both must hold).

**Scenario 7 — Search results are paginated**
- **Given** an authenticated user owns 25 notes all matching a common search term
- **When** the client calls `GET /api/search?q=<term>&page=1&pageSize=20`, then `GET /api/search?q=<term>&page=2&pageSize=20`
- **Then** page 1 responds `200` with 20 results and `pagination: {page: 1, pageSize: 20, totalItems: 25, totalPages: 2}`, and page 2 responds with the remaining 5 results, both pages ordered by descending `rank`.

**Scenario 8 — Soft-deleted notes excluded from results**
- **Given** an authenticated user owns a soft-deleted note (`deletedAt` set) containing the search term
- **When** the client calls `GET /api/search?q=<term>`
- **Then** the system responds `200` and the soft-deleted note does not appear in `data`.

**Scenario 9 — Results scoped to the authenticated user only**
- **Given** user A and user B each own a note containing the word "roadmap"
- **When** user A calls `GET /api/search?q=roadmap`
- **Then** the response contains only user A's matching note — user B's note never appears (all queries include `WHERE userId = <authUserId>` per `CLAUDE.md`).

**Scenario 10 — Empty search query**
- **Given** an authenticated user
- **When** the client calls `GET /api/search?q=` or omits `q` entirely
- **Then** the system responds `422` with error code `VALIDATION_ERROR` (FRS EC-1).

**Scenario 11 — Search query exceeds maximum length**
- **Given** an authenticated user
- **When** the client calls `GET /api/search` with a `q` value longer than 200 characters
- **Then** the system responds `422` with error code `VALIDATION_ERROR` (FRS EC-2).

**Scenario 12 — Whitespace-only query treated as empty**
- **Given** an authenticated user
- **When** the client calls `GET /api/search?q=%20%20%20` (whitespace only)
- **Then** the system responds `422` with error code `VALIDATION_ERROR` (mirrors Scenario 10 — no meaningful search term after trimming).

**Scenario 13 — Invalid `page` or `pageSize`**
- **Given** an authenticated user
- **When** the client calls `GET /api/search?q=<term>` with `page=0`, `page=-1`, a non-integer `page`, `pageSize=0`, or `pageSize=101` (exceeds max 100, mirrors FRS §13.6 pagination limits used in AB-1005)
- **Then** the system responds `422` with error code `VALIDATION_ERROR`.

**Scenario 14 — Malformed `tagIds`**
- **Given** an authenticated user
- **When** the client calls `GET /api/search?q=<term>&tagIds=not-a-uuid`
- **Then** the system responds `422` with error code `VALIDATION_ERROR` (mirrors AB-1005 Scenario 17).

**Scenario 15 — Special characters / query syntax do not break the search**
- **Given** an authenticated user
- **When** the client calls `GET /api/search?q=hello%20%26%20world` (query containing characters with special meaning in `tsquery` syntax, e.g. `&`, `|`, `:`, `!`)
- **Then** the system responds `200` (not `500`) — `plainto_tsquery` (SDS §24.4) treats the input as plain text and safely escapes/tokenizes special characters rather than interpreting them as `tsquery` operators.

**Scenario 16 — Unauthenticated request**
- **Given** no `Authorization` header (or an invalid/expired access token)
- **When** the client calls `GET /api/search?q=<term>`
- **Then** the `requireAuth` middleware responds `401` with `TOKEN_MISSING`, `TOKEN_INVALID`, or `TOKEN_EXPIRED` as appropriate (existing AB-1002 behavior; not re-implemented here) (FRS EC-3).

## 4. API / Interface Contract

| Method | Path | Auth | Query Params | Success Response | Error Responses |
| ------ | ---- | ---- | ------------- | ----------------- | ---------------- |
| GET | `/api/search` | Yes | `q, page?, pageSize?, tagIds?` | `200 {data, pagination}` | `422 VALIDATION_ERROR`, `401 TOKEN_*` |

**Query parameter rules (FRS FR-SRCH-001, enforced via a Zod schema in `packages/shared`):**
- `q`: required; 1–200 characters after trimming; rejected as `VALIDATION_ERROR` if missing, empty, or whitespace-only (Scenarios 10, 12) or over 200 characters (Scenario 11).
- `page`: optional, positive integer ≥ 1, default `1`.
- `pageSize`: optional, integer 1–100, default `20` (SDS §18.2, mirrors AB-1005).
- `tagIds`: optional, comma-separated list of UUIDs (same wire format decision as AB-1005 — confirm final format in `/plan`); each must be a syntactically valid UUID or the request is rejected with `422` (Scenario 14).

**Response shape (SDS §18.2, adapted for search):**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "snippet": "string with <mark>highlighted</mark> terms",
      "rank": 0.607927,
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 3,
    "totalPages": 1
  }
}
```
Fields per FRS AC-7: note ID, title, highlighted snippet, relevance score (`rank`), and timestamps. Unlike the full note list/detail shapes (SDS §18.1), search results do NOT include `content`, `tags`, or other full-note fields — only the fields needed to render UX-SCR-009's result list and navigate to `/notes/:id`.

**Error format (SDS §19.1):** `{error: {code, message, details: []}}`, unchanged from prior tickets.

## 5. Data Model Impact

- **No new Prisma models or migrations.** `searchVector`, the GIN index, and the update trigger already exist from AB-1004 (SDS §24.3). This ticket is read-only against `Note` (and `NoteTag`/`Tag` for the optional filter).
- **No new Zod schemas beyond query validation.** New `searchQuerySchema` (or equivalent) in `packages/shared`, plus a `SearchResult`/`SearchResponse` type reflecting the response shape in Section 4.
- **Raw SQL requirement:** `ts_rank`, `ts_headline`, and `plainto_tsquery` (SDS §24.4) are not expressible via Prisma's query builder — the query layer will need `$queryRaw`/`$queryRawParameterized` (Prisma's tagged-template raw query API, which parameterizes inputs) for the search query itself, while pagination `COUNT` and tag-membership joins may or may not need the same raw approach — decide in `/plan`.
- **Open questions for `/plan`:**
  1. **`tagIds` wire format:** same open question as AB-1005 (comma-separated vs. repeated param) — should be resolved consistently with whatever AB-1005 ultimately implemented, for API consistency.
  2. **Combining raw SQL (`ts_rank`/`ts_headline`) with tag-filter joins and pagination:** SDS §24.4's example query doesn't show tag filtering or `LIMIT`/`OFFSET` combined with a `COUNT` for `totalItems` — decide the exact raw query structure (e.g. CTE, or two queries: one for `COUNT`, one for paginated results).
  3. **`ts_headline` performance:** `ts_headline` re-parses `contentPlain` at query time (not precomputed like `searchVector`) — confirm this is acceptable for expected note sizes, or whether a content length cap is needed before highlighting.
  4. **Raw SQL injection safety:** must use parameterized raw queries (Prisma `$queryRaw` tagged template, not string concatenation) for `q`, `userId`, and any `tagIds` values passed into the SQL.

## 6. Out of Scope

- The `searchVector` column, GIN index, and update trigger — already delivered in AB-1004.
- Frontend Search Results screen (UX-SCR-009) and Dashboard search input (UX-SCR-006 sidebar) — later frontend ticket (AB-1011/1012 range).
- Sharing, version history — AB-1008, AB-1009.
- Any search ranking/highlighting customization beyond SDS §24 defaults (e.g. fuzzy/typo-tolerant search, synonym expansion) — not in FRS scope, and CON-004 prohibits external search services that might offer it.
