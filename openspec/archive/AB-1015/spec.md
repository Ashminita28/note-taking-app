# AB-1015 — Frontend Version History Drawer + Restore Spec

## 1. Ticket

- **ID:** AB-1015
- **Title:** Frontend Version History Drawer + Restore
- **Dependencies:**
  - AB-1009 (Backend Version History) — confirmed complete (`openspec/archive/AB-1009`). All three endpoints are consumed as-is: `GET /api/notes/:id/versions`, `GET /api/notes/:id/versions/:versionNumber`, `POST /api/notes/:id/versions/:versionNumber/restore`. Types/schemas already exist in `packages/shared` (`version.schemas.ts`, `version.types.ts`) — no new shared package work. Confirmed backend behaviors this ticket relies on: the list endpoint returns versions newest-first with a server-truncated `contentPreview` (`VERSION_PREVIEW_LENGTH = 200` chars, `packages/shared/src/constants/limits.ts`), restoring creates a brand-new version rather than rewriting history (BR-009), and all three endpoints return a uniform `404` for a missing note, a missing version, or a note owned by another user (no `403` anywhere, matching CLAUDE.md's "another user's resource → 404" rule).
  - AB-1012 (Frontend Note Editor) — confirmed complete (`openspec/archive/AB-1012`, merged via PR #12). `ActionHeader` already renders a "History" menu item wired to an optional `onHistory?: () => void` prop (currently `undefined` in `EditorPage.tsx`, so the item renders disabled) — this ticket supplies that handler, mirroring the `onShare` pattern AB-1014 used for the same header. `NoteEditor.tsx` is documented as never re-keyed by note id and **intentionally ignores `initialContent` prop changes after mount** ("Later prop changes are intentionally ignored so that navigating `/notes/new` → `/notes/:id` never disturbs the live document, cursor position, or undo stack") — restoring a version must update the *live* editor content without violating that rule (see Open Question 1).
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-VER-002 | The system SHALL return the version history of a note, ordered newest to oldest, each entry showing version number, title, timestamp, and a content preview (frontend: `VersionHistoryDrawer` list, loading/error states). |
| FR-VER-003 | The system SHALL allow users to view the full content of any specific version without modifying the current note or creating a new version (frontend: click a version item → read-only preview with yellow banner). |
| FR-VER-004 | The system SHALL allow users to restore a previous version, which creates a new version rather than rewriting history (frontend: "Restore this version" button, toast confirmation, editor content update). |

**Not a primary deliverable, referenced only as already-proven backend behavior:** FR-VER-001 (automatic snapshot on every save) and FR-VER-005 (auto-purge with a 10-version/90-day floor) — both are AB-1009 backend mechanics this ticket depends on but does not implement or test.

**Business rules in scope:** BR-002 (own-resource-only access — a foreign or nonexistent note/version returns `404`, never `403`, mirrored generically in the UI). BR-009 (restoring creates a new version; it does not rewrite history — the frontend must reflect the new version appearing at the top of the list, not the old one moving or disappearing). BR-017 (version snapshots are immutable — the frontend renders no edit/delete affordance on any version item).

**Explicitly not re-litigated (already covered by AB-1009):** version numbering/sequencing, snapshot immutability enforcement, the 10-version/90-day retention floor, and the `404` contract for not-found/foreign note or version — all proven server-side; this ticket only needs to render what the API already guarantees and call it correctly.

## 3. Scenarios

### Opening the Drawer (UX-SCR-012, UX-VER-01)

**Scenario 1 — "History" menu item opens the drawer**
- **Given** the user is on the Note Editor (`/notes/:id`) for an existing (non-new) note
- **When** the user opens the "More actions" menu and selects "History"
- **Then** the Version History Drawer slides in from the right edge over the editor with a 300ms animation (UX §8.12 Navigation).

**Scenario 2 — History is unavailable for a brand-new, unsaved note**
- **Given** the user is creating a new note that has not yet been saved (`/notes/new`, no `NoteVersion` rows exist yet)
- **Then** the "History" menu item renders disabled, mirroring how "Share" and "Move to trash" are disabled for the same reason (`ActionHeader`'s existing `canDelete`/`onShare` pattern).

### Loading the Version List (FR-VER-002, UX-VER-04)

**Scenario 3 — Version list loads newest-first with preview snippets**
- **Given** the drawer has just opened for a note with 3 saved versions
- **When** `GET /api/notes/:id/versions` resolves
- **Then** the list renders 3 `VersionItem` rows ordered version 3, 2, 1 (newest first), each showing the version number, a formatted date, and the server-provided `contentPreview`.

**Scenario 4 — Loading state while the list is in flight**
- **Given** the drawer has just opened
- **When** `GET /api/notes/:id/versions` has not yet resolved
- **Then** a shimmer/skeleton list is shown inside the drawer (UX §8.12 Loading States).

**Scenario 5 — Version list fetch fails**
- **Given** the drawer is open
- **When** `GET /api/notes/:id/versions` fails (network error, 404, or 5xx)
- **Then** a toast "Unable to load version history." is shown (UX §8.12 Error States) and the drawer shows no list content; closing and reopening the drawer retries the request.

### Previewing a Version (FR-VER-003, UX-VER-02)

**Scenario 6 — Clicking a version shows the yellow preview banner**
- **Given** the version list is loaded
- **When** the user clicks a version item other than the current content
- **Then** `GET /api/notes/:id/versions/:versionNumber` is called, and on success the drawer (or editor pane, per Open Question 2) shows that version's full title and content with a yellow banner reading "Viewing version {N} from {date}" (UX §8.12 Success States).

**Scenario 7 — Previewing does not alter the note or create a version**
- **Given** a version is being previewed
- **Then** no `PATCH`/autosave request fires as a result of the preview, and no new `NoteVersion` row is created (FR-VER-003 AC-3) — the preview is purely a read of `GET /api/notes/:id/versions/:versionNumber`'s response.

**Scenario 8 — Preview loading state**
- **Given** the user has just clicked a version item
- **When** `GET /api/notes/:id/versions/:versionNumber` has not yet resolved
- **Then** a preview loading indicator is shown (UX §8.12 Loading States).

**Scenario 9 — Preview fetch fails**
- **Given** the user has clicked a version item
- **When** `GET /api/notes/:id/versions/:versionNumber` fails (404 `VERSION_NOT_FOUND` or 5xx)
- **Then** a toast "Unable to load that version." is shown and the drawer remains on the version list (no banner is shown for a version that failed to load).

**Scenario 10 — Returning to the current version**
- **Given** a version is being previewed with the yellow banner shown
- **When** the user clicks "Back to current"
- **Then** the preview banner is dismissed and the editor/drawer shows the note's actual current content again (UX §7.9 `ClickBack` branch) — unchanged from before the preview began.

### Restoring a Version (FR-VER-004, UX-VER-03)

**Scenario 11 — Restoring creates a new version and updates the editor**
- **Given** a version is being previewed (e.g. version 2 of 4)
- **When** the user clicks "Restore this version"
- **Then** `POST /api/notes/:id/versions/2/restore` is called, and on `200` the response's returned note content replaces what's shown in the live editor, a toast "Version 2 restored." is shown, and the version list (once refreshed) shows a new version 5 at the top — version 2 itself is untouched (BR-009, FR-VER-004 AC-1/AC-2/AC-3).

**Scenario 12 — Restore button shows a loading state**
- **Given** the user has clicked "Restore this version"
- **When** the request is in flight
- **Then** the button shows a spinner and is disabled to prevent duplicate submissions (matching the `isLoading` pattern used by `DeleteNoteDialog`'s confirm button and `ShareModal`'s "Generate Link" button).

**Scenario 13 — Restore fails**
- **Given** the user has clicked "Restore this version"
- **When** `POST /api/notes/:id/versions/:versionNumber/restore` fails (network error, 404, or 5xx)
- **Then** a toast "Failed to restore version. Please try again." is shown, the editor's current content is left unchanged, and the preview banner remains shown so the user can retry.

**Scenario 14 — Previous versions remain accessible after a restore**
- **Given** version 2 was just restored (creating version 5)
- **When** the user reopens the drawer (or it refreshes in place)
- **Then** versions 1 through 4 are still listed and individually viewable — restoring never removes or overwrites prior version rows (FR-VER-004 AC-4).

### Closing the Drawer & Accessibility (UX §8.12)

**Scenario 15 — Escape closes the drawer and returns focus**
- **Given** the drawer is open (in any state — list, preview, or restoring)
- **When** the user presses `Escape`
- **Then** the drawer closes and focus returns to the "More actions" trigger button in `ActionHeader` (mirroring `DeleteNoteDialog`'s and `ShareModal`'s `returnFocusRef` pattern, since the drawer is also opened from a `DropdownMenuItem`, not a native trigger element).

**Scenario 16 — Focus is trapped inside the drawer while open**
- **Given** the drawer is open
- **When** the user presses `Tab` repeatedly
- **Then** focus cycles only through the drawer's interactive elements (version items, "Restore this version", "Back to current", close button) and never escapes to the editor behind it (UX §8.12 Keyboard Navigation / Accessibility Notes).

**Scenario 17 — Drawer exposes an accessible landmark**
- **Given** the drawer is open
- **Then** it is rendered as an `<aside>` (or equivalent landmark role) with `aria-label="Version history"` (UX §8.12 Accessibility Notes).

### Responsive Behavior (UX §8.12)

**Scenario 18 — Desktop/tablet width**
- **Given** the viewport is desktop or tablet width
- **When** the drawer opens
- **Then** it renders as a 400px-wide slide-over panel anchored to the right edge.

**Scenario 19 — Mobile full-screen**
- **Given** the viewport is mobile width
- **When** the drawer opens
- **Then** it renders as a full-screen overlay instead of a fixed-width side panel.

## 4. API / Interface Contract

Consumed as-is (no backend changes), all from AB-1009:

| Method | Path | Auth | Request Body / Params | Success Response | Error Responses |
| ------ | ---- | ---- | ---------------------- | ----------------- | ---------------- |
| GET | `/api/notes/:id/versions` | Yes | — | `200 {versions: VersionListItem[]}` | `404 NOTE_NOT_FOUND`, `401 TOKEN_*` |
| GET | `/api/notes/:id/versions/:versionNumber` | Yes | — | `200 {version: VersionDetail}` | `404 NOTE_NOT_FOUND`, `404 VERSION_NOT_FOUND`, `401 TOKEN_*` |
| POST | `/api/notes/:id/versions/:versionNumber/restore` | Yes | — | `200 {note: NoteResponse}` | `404 NOTE_NOT_FOUND`, `404 VERSION_NOT_FOUND`, `401 TOKEN_*` |

All request/response types come from `@note-app/shared` (`VersionListItem`, `ListVersionsResponse`, `VersionDetail`, `GetVersionResponse`, `RestoreVersionResponse`, `VersionNumberParam`) — no new schemas are added to `packages/shared` by this ticket.

## 5. State & Data Impact

- **New feature module `apps/frontend/src/features/versions/`:** `versions.api.ts` (thin `apiClient` wrappers for the three endpoints above), `versions.hooks.ts` (`useVersionsQuery`, `useVersionQuery`, `useRestoreVersionMutation`), and components `VersionHistoryDrawer`, `VersionList`, `VersionItem`, `VersionPreviewBanner`.
- **`EditorPage.tsx` changes:** adds `historyDrawerOpen` state and passes `onHistory={isNew ? undefined : () => setHistoryDrawerOpen(true)}` to `ActionHeader` (mirroring the existing `onShare` wiring), plus renders `<VersionHistoryDrawer noteId={id} open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen} returnFocusRef={moreMenuTriggerRef} onRestored={...} />` alongside the existing `ShareModal`. The `onRestored` callback must update `draft.title`/`draft.content` (and push the new content into the live TipTap instance — Open Question 1) the same way `handleCreated` seeds state today.
- **TanStack Query keys:** `['versions', 'list', noteId]` and `['versions', 'detail', noteId, versionNumber]`. `useRestoreVersionMutation` invalidates `['versions', 'list', noteId]` (so the new version appears at the top) and updates `['notes', 'detail', noteId]` via `setQueryData` (matching `useUpdateNoteMutation`'s pattern), so the notes list's "last updated" ordering stays consistent too.
- **No new Prisma models, no backend changes, no new `packages/shared` schemas** — frontend-only, matching AB-1013/AB-1014 precedent.

## 6. Out of Scope

- Automatic version snapshot creation on save (FR-VER-001) and auto-purge of old versions (FR-VER-005) — both backend-only, AB-1009, already done; this ticket only reads and restores what already exists.
- Any change to the editor's own autosave-driven version creation — AB-1012, unaffected by this ticket.
- End-to-end journey coverage of the restore flow — AB-1016.
- Diffing or side-by-side comparison between two versions — not in the FRS scope for AB-1015 (view one version at a time, and restore; no comparison UI exists in the UX inventory).
- A cross-note "all my version history" screen — only the per-note drawer (UX-SCR-012) exists in the UX inventory.
- `ActionHeader`/`Dialog` primitive changes beyond wiring the new `onHistory` handler — those components already exist from AB-1012/AB-1010/AB-1014.

## 7. Open Questions for `/plan`

1. **Live editor content sync after restore (Scenario 11):** `NoteEditor.tsx` explicitly ignores `initialContent` prop changes after mount and is never re-keyed by note id (plan.md Decision 1 from AB-1012), to protect cursor position and undo history during normal editing. A restore is a deliberate full-content replacement, so it needs its own mechanism — e.g. an imperative ref exposing `editor.commands.setContent(...)`, or a narrow remount keyed by a restore counter (not note id) — that doesn't reopen the door to the bug Decision 1 was written to prevent. This is the single biggest technical unknown in the ticket.
2. **Where the preview renders (Scenario 6):** whether the yellow banner + read-only content preview appears *inside the drawer itself* (a self-contained scrollable preview pane, keeping the live editor untouched underneath) or *takes over the main editor pane* behind the drawer (matching UX §7.9's flow text "Preview version in editor (read-only banner)" more literally). The former is simpler and lower-risk given Open Question 1; the latter matches the flow diagram's wording exactly.
3. **Drawer behavior immediately after a successful restore (Scenario 11):** auto-close the drawer, stay open on the (refreshed) list view, or stay in preview mode now showing the newly-current version. UX §7.9's flow diagram ends at the toast + "editor updated" with no explicit close step.
4. **New reusable `Drawer` primitive vs. feature-local styling:** no `Drawer` component exists yet under `components/ui/` (only `Dialog`, built on `@radix-ui/react-dialog`). Decide whether to add a generic `components/ui/drawer.tsx` (right-anchored `Dialog` variant, reusable beyond this ticket) or style `VersionHistoryDrawer` directly against `DialogContent` the way `ShareModal` overrides positioning for its mobile bottom-sheet.
5. **Preview snippet length:** FR-VER-002's AC says "first 200 characters" and matches the backend's actual `VERSION_PREVIEW_LENGTH = 200` constant (`packages/shared/src/constants/limits.ts`), while UX-VER-04 says "first ~50 characters." Confirming the frontend renders `contentPreview` verbatim (server already truncates to 200) and, if needed, applies its own CSS single-line truncation in `VersionItem` for the list row's visual width — not a second data truncation.
