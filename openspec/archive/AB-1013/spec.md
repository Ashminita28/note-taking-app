# AB-1013 — Frontend Search UI Spec

## 1. Ticket

- **ID:** AB-1013
- **Title:** Frontend Search UI
- **Dependencies:**
  - AB-1007 (Backend Full-Text Search) — confirmed complete (`openspec/archive/AB-1007`). `GET /api/search` (query params `q, page, pageSize, tagIds`) is consumed as-is: response is `{data: SearchResult[], pagination: PaginationMeta}` where each `SearchResult` has `id, title, snippet, rank, createdAt, updatedAt` (`packages/shared/src/schemas/search.schemas.ts`). Confirmed via `apps/backend/src/modules/search/search.service.ts`: the `snippet` field comes straight from PostgreSQL `ts_headline` and is **not** HTML-escaped beyond inserting literal `<mark>`/`</mark>` around matched terms — see Scenario 7 / Open Question 4 for the resulting frontend rendering constraint.
  - AB-1011 (Frontend Notes List / Dashboard) — confirmed complete (`openspec/archive/AB-1011`, merged via PR #11). `DashboardPage`, `DashboardHeader`, `Sidebar`, `useUIStore` (sidebar open/toggle), and the URL-search-params-as-state pattern (`useNotesListParams`) already exist and are extended/reused here. Per AB-1011 Open Question 3, `Ctrl+K` is currently unhandled anywhere in the app — this ticket is what gives it a real target.
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-SRCH-001 | The system SHALL provide full-text search across note titles and content for the authenticated user, with keyword highlighting in results (frontend consumption: search bar, debounce, results rendering, highlighting, pagination, empty/error/loading states, keyboard access). |

**Business rules in scope:** BR-002 (a user only ever sees their own notes — enforced server-side by AB-1007; the frontend never needs client-side ownership filtering). No new backend or database work — this ticket is frontend-only, read-only consumption of `GET /api/search`.

**Explicitly not re-litigated (already covered by AB-1007):** relevance ranking, stemming/prefix matching, soft-delete exclusion, per-user scoping, and the `422`/`401` validation contract — all proven server-side; this ticket only needs to render what the API already guarantees.

## 3. Scenarios

### Search Bar Entry & Debounce (UX-SRCH-01, FR-SRCH-001 Main Flow 1)

**Scenario 1 — Ctrl+K focuses the search bar**
- **Given** the user is on an authenticated screen where the search bar is mounted (Dashboard, per UX §15.1)
- **When** the user presses `Ctrl+K` (and focus is not already inside a text input, mirroring the existing `isTypingTarget` guard used for `Ctrl+N` in `DashboardPage.tsx`)
- **Then** the search input receives focus and its content is selected, ready to type over.

**Scenario 2 — Typing debounces at 300ms before firing a request**
- **Given** the search input is focused and empty
- **When** the user types "meet" character by character with less than 300ms between keystrokes
- **Then** no `GET /api/search` request fires until 300ms have elapsed since the last keystroke, and only one request fires for the final value "meet" (UX-SRCH-01).

**Scenario 3 — Debounced query updates the URL and results**
- **Given** the user has typed a query and the 300ms debounce has elapsed
- **When** the debounce fires
- **Then** the app navigates to `/search?q=<query>` (URL-as-state, matching AB-1011's `useNotesListParams` convention) and `GET /api/search?q=<query>&page=1&pageSize=20` is called.

**Scenario 4 — Sub-minimum-length input does not fire a request**
- **Given** the search input is focused
- **When** the user clears it to an empty or whitespace-only string
- **Then** no `GET /api/search` request fires (avoids the guaranteed `422` for an empty/whitespace query per FRS EC-1) and the view returns to/stays at the Dashboard notes list rather than showing a search-results shell.

**Scenario 5 — Query exceeding 200 characters is capped client-side**
- **Given** the search input
- **When** the user types or pastes a value longer than 200 characters
- **Then** the input enforces a 200-character max (mirrors FRS EC-2 / UX §8.9 "Validation Rules: Query max 200 characters") so the client never sends a request guaranteed to `422`.

### Results Rendering & Highlighting (UX-SRCH-02)

**Scenario 6 — Results render with title, snippet, and relevance order**
- **Given** `GET /api/search?q=standup` returns two matching notes
- **Then** `SearchResultsList` renders one `SearchResultItem` per result, in the order returned by the API (already relevance-sorted server-side), each showing the note's `title` and highlighted `snippet`.

**Scenario 7 — Snippet highlighting renders `<mark>` safely, not as raw HTML**
- **Given** a search result's `snippet` is `"...the <mark>budget</mark> review..."`, and note content may contain literal `<`/`>`/`&` characters typed by the user (e.g. "cost < revenue") that `ts_headline` does **not** HTML-escape (confirmed in `search.service.ts` — only `<mark>`/`</mark>` are inserted, nothing else is escaped)
- **Then** `SnippetHighlight` parses the string, renders text matched between `<mark>`/`</mark>` delimiters inside a real `<mark>` element for visual highlighting, and renders every other character as literal escaped text (React's default text-node escaping) — it MUST NOT pass the raw `snippet` string to `dangerouslySetInnerHTML`, since that would let literal note content containing `<`/`>`/script-like sequences execute as HTML/script (XSS) rather than display as plain highlighted text.

**Scenario 8 — Clicking a result navigates to the note**
- **Given** search results are rendered
- **When** the user clicks a `SearchResultItem` (or presses `Enter` on a focused one)
- **Then** the app navigates to `/notes/:id` for that result's `id`, without a full page reload.

### Loading & Error States

**Scenario 9 — Search loading state**
- **Given** `GET /api/search` has been triggered and has not resolved
- **Then** 3 shimmer skeleton result cards are shown (UX §11 "Search results: 3 shimmer skeleton cards"), sized to prevent layout shift.

**Scenario 10 — Search request fails**
- **Given** `GET /api/search` fails (network error or 5xx)
- **Then** the results area shows the inline error "Search unavailable. Please try again." with a "Retry" button (UX §8.9 Error States) that re-triggers the same query.

**Scenario 11 — Rate limit exceeded**
- **Given** the user issues searches fast enough to exceed the search endpoint's rate limit (SDS §19.2: 30 requests / 1 min)
- **When** `GET /api/search` responds `429 RATE_LIMIT_EXCEEDED`
- **Then** the same inline error + Retry treatment from Scenario 10 is shown (no ticket-specific rate-limit UI is required — the generic error state covers it per FRS §14.4 "Rate limit exceeded ... All").

**Scenario 12 — Token expiry mid-search**
- **Given** the access token expires while the search results view is mounted
- **When** `GET /api/search` returns `401 TOKEN_EXPIRED`
- **Then** the existing `apiClient` single-flight refresh (AB-1010) transparently retries the request — no ticket-specific handling needed, matching AB-1011 Scenario 30.

### Empty State (UX §10, FRS AF-1)

**Scenario 13 — No results found**
- **Given** `GET /api/search?q=<query>` returns `{data: [], pagination: {totalItems: 0, ...}}`
- **Then** the results area shows the 🔍 "No notes found for '{query}'" / "Try different keywords or check spelling" empty state (UX §10, UX §8.9), with the literal user-typed query interpolated into the message (also HTML-escaped/rendered as text, not injected as markup).

### Pagination

**Scenario 14 — Paginated results reuse existing controls**
- **Given** `GET /api/search` returns `pagination: {page: 1, pageSize: 20, totalItems: 45, totalPages: 3}`
- **Then** the existing `PaginationControls` component (from `features/notes`) renders the same way it does on the Dashboard, and clicking "Next" re-fetches `GET /api/search?q=<query>&page=2` preserving the current query.

### Keyboard & Accessibility (UX-SRCH-03, UX-SRCH-04, UX §8.9, §15.1)

**Scenario 15 — Result count announced for screen readers**
- **Given** a search request resolves (with results or empty)
- **Then** an `aria-live="polite"` region announces "{N} results found" (UX-SRCH-03), updating each time a new result set loads (including 0).

**Scenario 16 — Escape clears the query and returns to the Dashboard**
- **Given** the user is viewing search results (or has focus in the search input) with a non-empty query
- **When** the user presses `Escape`
- **Then** the query is cleared, the search input (if visible) is emptied, and the app navigates back to the Dashboard notes list (`/`) (UX-SRCH-04 / UX §8.9 Navigation).

**Scenario 17 — Down Arrow from the search input moves to the first result**
- **Given** the search input has focus and results are rendered
- **When** the user presses `Down Arrow`
- **Then** focus moves to the first `SearchResultItem` (UX §8.9 Keyboard Navigation), from which the existing roving arrow-key pattern (reused from `NotesList.tsx`'s `handleKeyDown`) continues moving focus between results.

### Cross-Cutting — Auth

**Scenario 18 — Unauthenticated access**
- **Given** no valid session
- **When** a user navigates directly to `/search?q=...`
- **Then** `ProtectedRoute` (AB-1010, already implemented) redirects to `/login` before any search request is attempted, matching AB-1011 Scenario 29's pattern for `/`.

## 4. API / Interface Contract

Consumed as-is (read-only), unchanged by this ticket:

| Method | Path | Auth | Query Params | Success Response | Error Responses |
| ------ | ---- | ---- | ------------- | ----------------- | ---------------- |
| GET | `/api/search` | Yes | `q, page?, pageSize?, tagIds?` | `200 {data: SearchResult[], pagination: PaginationMeta}` | `422 VALIDATION_ERROR`, `401 TOKEN_*`, `429 RATE_LIMIT_EXCEEDED` |

All request/response types come from `@note-app/shared` (`SearchQuery`, `SearchResult`, `SearchResponse`) — no new schemas are added to `packages/shared` by this ticket. `tagIds` exists in the contract (FRS AF-2) but is **not** exposed in this ticket's UI — see Section 6.

## 5. State & Data Impact

- **New feature module `apps/frontend/src/features/search/`:** `search.api.ts` (thin wrapper over `apiClient` for `GET /api/search`), `search.hooks.ts` (`useSearchQuery`), components `SearchBar`, `SearchResultsList`, `SearchResultItem`, `SnippetHighlight`, `EmptySearchState`, plus a new generic `useDebouncedValue` hook (distinct from the autosave feature's inline debounce timer in `useAutosave.ts`, which is purpose-built for dirty-draft saving, not reusable here).
- **New page `apps/frontend/src/pages/SearchResultsPage.tsx`** routed at `/search` in `App.tsx`, wrapped in `ProtectedRoute` like `DashboardPage`.
- **TanStack Query:** `['search', {q, page, pageSize}]` query key, `enabled` gated on a non-empty trimmed `q` (Scenario 4).
- **URL as state:** `q` and `page` live in the URL (`useSearchParams`), matching the `useNotesListParams` convention already established in AB-1011 — no new Zustand fields.
- **No new Prisma models, no backend changes, no new `packages/shared` schemas** — frontend-only.

## 6. Out of Scope

- Tag-filter UI on the Search Results screen — the backend contract supports `tagIds` (FRS AF-2, AB-1007 Scenario 6), but UX-SCR-009's component list (`SearchBar`, `SearchResultsList`, `SearchResultItem`, `SnippetHighlight`) and this ticket's FRS scope bullets do not include a tag-filter control here. `tagIds` is simply never sent by this ticket's UI.
- Note creation, editing, the TipTap editor — AB-1012 (done).
- Sharing, version history UI — AB-1014, AB-1015.
- Any backend changes to `GET /api/search`, ranking, or highlighting — AB-1007 (done); this ticket only renders what it already returns.
- Global command palette / multi-purpose `Ctrl+K` beyond focusing the search input — UX §15.1 scopes `Ctrl+K` strictly to "Focus search bar."

## 7. Open Questions for `/plan`

1. **Shared header/layout between `/` and `/search`:** UX-SCR-009 is a distinct route (`/search`, per UX.md's screen inventory) but its "Related APIs"/component list has no `Sidebar`, while UX-SCR-006 (Dashboard) is where the search bar visually lives per its component list and §15.1's "Dashboard" scoping for `Ctrl+K`. `DashboardHeader` is currently only rendered inside `DashboardPage`. Decide whether to extract a shared layout (e.g. an `AppShell` wrapping both `DashboardPage` and `SearchResultsPage` with one `DashboardHeader` instance) or duplicate a header with the search bar in `SearchResultsPage` — this also determines whether `Ctrl+K` needs to be a shell-level listener rather than a `DashboardPage`-local one.
2. **Live-navigate vs. explicit submit:** UX §7.7's flow (type → debounce → API → results) implies the debounced value drives navigation to `/search?q=...` automatically (no explicit "press Enter to search" step) — confirm this, and confirm whether the URL updates via `replace: true` on every debounce tick (to avoid flooding browser history), mirroring `useNotesListParams`.
3. **Snippet-highlighting implementation detail (Scenario 7):** confirm the exact parsing approach (e.g. `snippet.split(/(<mark>|<\/mark>)/)` and track an "inside mark" boolean while mapping segments to text vs. `<mark>` nodes) and that it has unit test coverage for a snippet containing literal `<`/`>` characters outside the highlight markers, since this is a genuine XSS-prevention requirement, not just a rendering nicety.
4. **Minimum characters before firing a request:** the backend accepts `q` as short as 1 trimmed character; decide whether the frontend fires at 1 character (matching the backend contract exactly) or imposes a slightly higher client-side floor (e.g. 2) purely for request-volume/UX reasons — not specified in FRS/UX.
5. **Empty-state message escaping:** confirm the "{query}" interpolated into "No notes found for '{query}'" (Scenario 13) is rendered as a text child (React's default), never built via string concatenation into `dangerouslySetInnerHTML` or `innerHTML`.
