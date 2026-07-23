# AB-1011 — Frontend Notes List Page Spec

## 1. Ticket

- **ID:** AB-1011
- **Title:** Frontend Notes List Page (Dashboard)
- **Dependencies:**
  - AB-1005 (Backend Notes List) — confirmed complete (`openspec/archive/AB-1005`, merged via PR #5 / commit `d6da308`). `GET /api/notes` with `page, pageSize, sortBy, sortOrder, tagIds, includeTrashed` is consumed as-is. Per `packages/shared/src/schemas/note.schemas.ts`, `tagIds` is a **single comma-separated query param** (`?tagIds=t1,t2`), not repeated keys — this resolves the open question flagged in `/start`.
  - AB-1006 (Backend Tags CRUD + Note Counts) — confirmed complete (`openspec/archive/AB-1006`, merged via PR #8 chain). `GET /api/tags` returning `{tags: TagWithCount[]}` (each with `noteCount`) is consumed as-is for the sidebar; no create/update/delete tag UI is built here.
  - AB-1010 (Frontend Authentication Pages) — confirmed complete (`openspec/archive/AB-1010`, merged via PR #10 / commit `8506451`). `ProtectedRoute`, `useAuthStore`, and `apiClient` (with silent refresh) already exist and are consumed as-is; `DashboardPage` is already routed at `/` behind `ProtectedRoute` (`apps/frontend/src/App.tsx`) but is currently a placeholder (`apps/frontend/src/pages/DashboardPage.tsx`).
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-NOTE-006 | The system SHALL return a paginated list of the user's notes with sorting and tag filtering options (frontend consumption: render, sort, filter, paginate). |

**Also in play (read-only, per UX-SCR-006's own Related Requirements FR-NOTE-006, FR-TAG-002):** FR-TAG-002 (`GET /api/tags` with `noteCount`) is consumed to render the sidebar tag list with per-tag note counts. This ticket does **not** implement FR-TAG-001/003/004 (tag create/update/delete) — no ticket in FRS §25.2 currently claims UX-SCR-010 (Tag Management Modal); see Open Questions.

**Business rules in scope:** BR-002 (a user only ever sees their own notes/tags — enforced server-side; the frontend never needs client-side ownership filtering). No soft-delete UI in this ticket beyond viewing/toggling into the trash list — actual delete/restore *actions* are out of scope (delete lives in AB-1012's `DeleteNoteDialog`; restore-from-trash button existing here calls the already-implemented `POST /api/notes/:id/restore`).

## 3. Scenarios

### Sidebar — Tag List & Filtering (FR-TAG-002)

**Scenario 1 — Sidebar renders tags with note counts**
- **Given** an authenticated user with tags "Work" (3 notes), "Personal" (0 notes)
- **When** the Dashboard loads
- **Then** `GET /api/tags` is called and the sidebar renders each tag as a chip showing its name and note count (e.g. "Work (3)", "Personal (0)"), alphabetically ordered per the API response.

**Scenario 2 — Selecting a tag filters the notes list**
- **Given** the sidebar tag list is rendered
- **When** the user clicks tag chip "Work"
- **Then** the chip shows a selected/active visual state and the notes list re-fetches via `GET /api/notes?tagIds=<work-id>`, resetting to page 1.

**Scenario 3 — Selecting multiple tags uses AND filtering**
- **Given** tags "Work" and "Urgent" are both selected
- **When** the notes list re-fetches
- **Then** the request is `GET /api/notes?tagIds=<work-id>,<urgent-id>` (comma-separated, matching `note.schemas.ts`), returning only notes with all selected tags.

**Scenario 4 — Deselecting a tag removes it from the filter**
- **Given** tag "Work" is selected
- **When** the user clicks the "Work" chip again
- **Then** it returns to its unselected state and the notes list re-fetches without `tagIds` for that tag (or without the param entirely if no tags remain selected).

**Scenario 5 — Tag sidebar loading state**
- **Given** the Dashboard has just mounted and `GET /api/tags` has not resolved
- **Then** the sidebar shows 4–6 shimmer lines shaped like tag chips (UX §11), not a spinner.

**Scenario 6 — Tag sidebar fetch failure**
- **Given** `GET /api/tags` fails (network error or 5xx)
- **Then** the sidebar shows a retry affordance in place of the tag list (UX §8.6 "Error States: Retry banner if note list or tag fetch fails"); the notes list itself still attempts to load independently.

**Scenario 7 — No tags exist**
- **Given** an authenticated user with zero tags
- **Then** the sidebar shows "No tags yet" / "Create tags to organize your notes" (UX §10) in place of the tag chip list.

### Notes List — Rendering (FR-NOTE-006)

**Scenario 8 — Note cards render required fields**
- **Given** the notes list has loaded with at least one note
- **Then** each `NoteCard` shows the note's title, a plain-text preview (HTML stripped) truncated to a fixed length, its tag chips, and a relative/formatted `updatedAt` timestamp.

**Scenario 9 — Notes list initial loading state**
- **Given** the Dashboard has just mounted and `GET /api/notes` has not resolved
- **Then** 3–5 shimmer skeleton cards matching `NoteCard` dimensions are shown (UX-NOTE-05, UX §11), sized to prevent layout shift.

**Scenario 10 — Notes list fetch failure**
- **Given** `GET /api/notes` fails
- **Then** a retry banner is shown in the main content area with a "Try Again" action that re-triggers the query.

**Scenario 11 — Clicking a note card navigates to the editor**
- **Given** the notes list is rendered
- **When** the user clicks a note card (or presses `Enter` on a focused/selected card)
- **Then** the app navigates to `/notes/:id` without a full page reload.

**Scenario 12 — "+ New Note" navigates to the create route**
- **Given** the Dashboard
- **When** the user clicks "+ New Note" (or presses `Ctrl+N`)
- **Then** the app navigates to `/notes/new`.

### Sorting (FR-NOTE-006)

**Scenario 13 — Default sort**
- **Given** the Dashboard loads with no prior sort selection
- **Then** `GET /api/notes` is called with no explicit `sortBy`/`sortOrder` (or explicitly `updatedAt`/`desc`, matching the API default) and the `SortDropdown` displays "Last updated" as the active option.

**Scenario 14 — Changing sort field/direction re-fetches**
- **Given** the `SortDropdown`
- **When** the user selects any of the six `sortBy` × `sortOrder` combinations (`createdAt`/`updatedAt`/`title` × `asc`/`desc`)
- **Then** the notes list re-fetches with the corresponding query params and resets to page 1.

**Scenario 15 — Sort selection persists across tag-filter changes**
- **Given** the user has selected a non-default sort (e.g. `title asc`)
- **When** the user then toggles a tag filter
- **Then** the previously selected sort is retained on the re-fetch (only the tag filter and page reset change).

### Pagination (FR-NOTE-006)

**Scenario 16 — Pagination controls reflect API metadata**
- **Given** `GET /api/notes` returns `pagination: {page: 1, pageSize: 20, totalItems: 45, totalPages: 3}`
- **Then** `PaginationControls` shows the current page, total pages, and disables "Previous" on page 1 (and would disable "Next" on the last page).

**Scenario 17 — Navigating pages re-fetches**
- **Given** the user is on page 1 of 3
- **When** the user clicks "Next"
- **Then** the notes list re-fetches `GET /api/notes?page=2` (preserving the active sort/filter/trash-view state) and the page indicator updates.

**Scenario 18 — Single page of results**
- **Given** `pagination.totalPages` is `1`
- **Then** `PaginationControls` either hides itself or renders both "Previous"/"Next" disabled (implementation choice — confirm in `/plan`).

### Trash View Toggle (FR-NOTE-006, AF-2)

**Scenario 19 — Toggling trash view**
- **Given** the Dashboard's default (active) notes view
- **When** the user activates the "Trash" toggle
- **Then** the notes list re-fetches `GET /api/notes?includeTrashed=true`, resets to page 1, and the view is visually distinguished (e.g. header label "Trash") from the active-notes view; tag filter and sort controls are not shown or are disabled in trash view (trash is not tag-filterable per AB-1005's contract — confirm in `/plan`).

**Scenario 20 — Empty trash**
- **Given** trash view is active and the user has no soft-deleted notes
- **Then** the empty state "Trash is empty" / "Deleted notes appear here for 30 days" is shown (UX §10).

**Scenario 21 — Restoring a note from trash**
- **Given** trash view is active with at least one trashed note
- **When** the user clicks a note's "Restore" action
- **Then** the app calls `POST /api/notes/:id/restore`; on success the note disappears from the trash list, a toast "Note restored" is shown (UX §13), and the `['notes','list']` query cache is invalidated/refetched.

**Scenario 22 — Switching back to active view**
- **Given** trash view is active
- **When** the user toggles back to the active-notes view
- **Then** the notes list re-fetches without `includeTrashed` (default `false`) and sort/tag-filter controls reappear.

### Empty States (UX §10, UX-NOTE-07)

**Scenario 23 — No notes exist at all**
- **Given** an authenticated user with zero notes and no active tag filter
- **Then** the notes list area shows the 📝 "No notes yet" / "Create your first note to get started" empty state with a CTA button that navigates to `/notes/new` (UX-NOTE-07).

**Scenario 24 — Tag filter matches no notes**
- **Given** a tag filter is active and the filtered result set is empty (but the user does have notes overall)
- **Then** the notes list area shows the 🏷️ "No notes with this tag" / "Try selecting a different tag" empty state (distinct from Scenario 23 — no "create note" CTA).

### Navigation, Keyboard & Accessibility (UX §8.6, §15.1, §15.3, §17)

**Scenario 25 — Global keyboard shortcuts**
- **Given** focus is anywhere on the Dashboard (not inside an input)
- **Then** `Ctrl+N` navigates to `/notes/new` and `Ctrl+K` focuses the (stubbed, since search ships in AB-1013) search input if present, or is a no-op if the search bar isn't part of this ticket's scope (confirm in `/plan`).

**Scenario 26 — Notes list arrow-key navigation**
- **Given** the notes list has focus (or a note card is focused)
- **Then** `↑`/`↓` move focus between note cards, `Enter` opens the focused note (Scenario 11), matching UX §15.3.

**Scenario 27 — Responsive sidebar**
- **Given** viewport width ≥1024px
- **Then** the sidebar is persistent (280px, always visible); **given** 768–1023px, the sidebar is a collapsible overlay triggered by a hamburger button (reusing `useUIStore.sidebarOpen`/`toggleSidebar`, already scaffolded in `apps/frontend/src/stores/ui.store.ts`); **given** <768px, the sidebar is a full-screen overlay and note cards render single-column.

**Scenario 28 — Skip link and landmarks**
- **Given** the Dashboard renders
- **Then** a "Skip to main content" link targeting `#main-content` is present as the first focusable element, and the page exposes `<nav>` (sidebar) and `<main id="main-content">` landmarks.

### Cross-Cutting — Auth & Errors

**Scenario 29 — Unauthenticated access**
- **Given** no valid session
- **When** a user navigates to `/`
- **Then** `ProtectedRoute` (already implemented, AB-1010) redirects to `/login` before any notes/tags fetch is attempted.

**Scenario 30 — Silent token refresh mid-session**
- **Given** the access token expires while the Dashboard is mounted
- **When** `GET /api/notes` or `GET /api/tags` returns `401 TOKEN_EXPIRED`
- **Then** the existing `apiClient` single-flight refresh (AB-1010) transparently retries the request; no ticket-specific handling is needed here beyond using `apiClient`/TanStack Query as designed.

## 4. API / Interface Contract

Both endpoints already exist and are unchanged by this ticket (read-only consumption):

| Method | Path | Auth | Query Params | Success Response |
| ------ | ---- | ---- | ------------- | ----------------- |
| GET | `/api/notes` | Yes | `page?, pageSize?, sortBy?, sortOrder?, tagIds?, includeTrashed?` | `200 {data: NoteResponse[], pagination: PaginationMeta}` |
| GET | `/api/tags` | Yes | — | `200 {tags: TagWithCount[]}` |
| POST | `/api/notes/:id/restore` | Yes | — | `200 {note: NoteResponse}` |

All request/response types come from `@note-app/shared` (`ListNotesQuery`, `ListNotesResponse`, `NoteResponse`, `ListTagsResponse`, `TagWithCount`, `RestoreNoteResponse`, `NOTE_SORT_FIELDS`, `SORT_ORDERS`) — no new schemas are added to `packages/shared` by this ticket.

## 5. State & Data Impact

- **New feature module `apps/frontend/src/features/notes/`:** `notes.api.ts` (thin wrapper over `apiClient` for `GET /api/notes` and `POST /api/notes/:id/restore`), plus components `NotesList`, `NoteCard`, `SortDropdown`, `PaginationControls`, `TrashToggle` (or equivalent naming decided in `/plan`).
- **New/extended `apps/frontend/src/features/tags/`:** `tags.api.ts` (`GET /api/tags`), `SidebarTagList`, `TagChip`.
- **`apps/frontend/src/pages/DashboardPage.tsx`:** replaces the current placeholder (`<main><h1>Notes</h1></main>`) with the composed layout (sidebar + notes list + header), per SDS §8.1.1.
- **TanStack Query:** `['notes', 'list', {page, pageSize, sortBy, sortOrder, tagIds, includeTrashed}]` and `['tags', 'list']` query keys, matching SDS §22.3's existing cache-invalidation table (`restore note` invalidates `['notes','list']`, and by extension `['tags','list']` since note counts can shift — confirm exact invalidation set in `/plan`).
- **Zustand:** no new store fields required — `useUIStore.sidebarOpen`/`toggleSidebar` (already scaffolded) is reused for the responsive sidebar; selected tag filter(s), sort, page, and trash-view-toggle are local/URL state (not global client state), per `apps/frontend/CLAUDE.md`'s "React state for form inputs" convention extended to list-control state — exact mechanism (component state vs. URL search params for deep-linking/back-button support) to be decided in `/plan`.
- **No new Prisma models, no backend changes** — this ticket is frontend-only.

## 6. Out of Scope

- Note creation, editing, TipTap editor, autosave, delete confirmation dialog — AB-1012.
- Search bar functionality and results (UX-SCR-009) — AB-1013; this ticket does not wire up a functional search input even though the Dashboard header/sidebar has a slot for one per UX §8.6's component list.
- Tag creation, editing, deleting (UX-SCR-010, FR-TAG-001/003/004) — the sidebar here is **read-only** (list + filter only); no ticket in FRS §25.2 currently claims the Tag Management Modal — flagged below.
- Sharing, version history UI — AB-1014, AB-1015.
- Backend changes of any kind — AB-1005/1006 already implement and merge the consumed endpoints.

## 7. Open Questions for `/plan`

1. **List-control state mechanism:** whether selected tag(s), sort, page, and trash-view-toggle live in component state, a small dedicated store, or URL search params (the latter enabling back-button/deep-link support — not explicitly required by any scenario above, but worth deciding deliberately).
2. **Trash view + tag filtering interaction (Scenario 19):** AB-1005's `GET /api/notes` accepts `tagIds` and `includeTrashed` simultaneously (no mutual exclusion in the backend contract), but UX §8.6 doesn't specify whether the UI should allow combining them. Decide whether to hide/disable tag filtering while in trash view or support both together.
3. **`Ctrl+K` behavior before AB-1013 ships (Scenario 25):** UX §15.1 lists it as a global Dashboard shortcut ("Focus search bar"), but the functional search bar doesn't exist until AB-1013. Decide whether to render a disabled/placeholder search input now (so the shortcut has a target) or make `Ctrl+K` a no-op until AB-1013.
4. **Tag Management Modal (UX-SCR-010) ownership gap:** no ticket in FRS §25.2's traceability table (AB-1010–AB-1016) explicitly claims UX-SCR-010, yet UX §8.6 doesn't list it as part of UX-SCR-006 either. This ticket's sidebar renders tags read-only; flag to the user whether tag CRUD is missing from the ticket sequence entirely or intentionally deferred beyond AB-1016.
5. **Note preview truncation:** exact character/line limit for the plain-text content preview on `NoteCard` (Scenario 8) is not specified in FRS/SDS/UX — pick a reasonable default (e.g. 150 chars) in `/plan`.
