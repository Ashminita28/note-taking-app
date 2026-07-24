# AB-1012 — Frontend Note Editor with TipTap + Autosave Spec

## 1. Ticket

- **ID:** AB-1012
- **Title:** Frontend Note Editor with TipTap and Autosave
- **Dependencies:**
  - AB-1004 (Backend Notes CRUD) — confirmed complete (`openspec/archive/AB-1004`). `POST /api/notes`, `GET /api/notes/:id`, `PATCH /api/notes/:id`, `DELETE /api/notes/:id`, `POST /api/notes/:id/restore` are consumed as-is (`apps/backend/src/modules/notes/notes.service.ts`). Every `PATCH` creates a new `NoteVersion` row server-side regardless of what changed — this ticket does not need to dedupe or suppress autosave calls to avoid version growth; that's an accepted backend behavior, not a frontend concern.
  - AB-1006 (Backend Tags CRUD) — confirmed complete (`openspec/archive/AB-1006`). `GET /api/tags`, `POST /api/tags` are consumed as-is for the tag bar and inline tag creation.
  - AB-1011 (Frontend Notes List) — confirmed complete (`openspec/archive/AB-1011`, merged via PR #11 / commit `4c1cd4c`). `DashboardPage`, `NoteCard` (linking to `/notes/:id`), `DashboardHeader` ("+ New Note" → `/notes/new`), `useRestoreNoteMutation`, and the `EditorPage` placeholder (`apps/frontend/src/pages/EditorPage.tsx`) already exist and are consumed/replaced as-is. `useUIStore` already scaffolds `editorDirty` / `setEditorDirty` (`apps/frontend/src/stores/ui.store.ts`) — apparently reserved for this ticket's `beforeunload` guard.
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-NOTE-001 | The system SHALL allow a user to create a note with a rich-text editor (frontend: `POST /api/notes` triggered by the first autosave tick on a new note, per UX §7.4). |
| FR-NOTE-002 | The system SHALL allow a user to read/open an existing note (frontend: `GET /api/notes/:id` on editor mount). |
| FR-NOTE-003 | The system SHALL allow a user to update a note's title, content, and tags (frontend: TipTap editing + tag bar, debounced autosave via `PATCH /api/notes/:id`). |
| FR-NOTE-004 | The system SHALL allow a user to soft-delete a note (frontend: delete confirmation dialog → `DELETE /api/notes/:id`, with Undo). |

**Also in play (read-only/write, per UX-SCR-007's Related Requirements):** FR-TAG-001 (tag creation) is exercised via inline tag creation in the tag bar (`POST /api/tags`) — this ticket does not build the full Tag Management Modal (UX-SCR-010, still unclaimed per AB-1011 §7 Q4).

**Business rules in scope:** BR-002 (a user only ever sees/edits their own notes — enforced server-side via `userId` scoping in `notes.service.ts`; a foreign note ID returns 404 `NOTE_NOT_FOUND`, never 403). BR-014 (soft-deleting a note revokes its share link) is a backend side-effect already implemented in `softDeleteNote` — no frontend handling needed. BR-004 (a note can have zero or more tags) — the tag bar must support the empty-tags case.

**Explicitly deferred to later tickets (buttons present, not wired):** The "Share" and "History" actions in `ActionHeader` (per UX §8.7's component list and AB-1014/AB-1015's stated dependency on "the editor for share/history button trigger") are rendered as disabled/stub buttons in this ticket — AB-1014 wires the Share modal, AB-1015 wires the version history drawer.

## 3. Scenarios

### Loading an Existing Note (FR-NOTE-002)

**Scenario 1 — Existing note loads successfully**
- **Given** the user navigates to `/notes/:id` for a note they own
- **When** `GET /api/notes/:id` resolves
- **Then** the title field, TipTap editor content, and tag bar are populated from the response, and the "Saved ✓" indicator is shown (not "Saving...", since nothing has changed yet).

**Scenario 2 — Note loading skeleton**
- **Given** the editor has just mounted and `GET /api/notes/:id` has not resolved
- **Then** a skeleton title bar + skeleton editor body are shown (UX §8.7 Loading States), not a spinner.

**Scenario 3 — Note not found or not owned by the user**
- **Given** `GET /api/notes/:id` returns `404 NOTE_NOT_FOUND` (note doesn't exist, is soft-deleted, or belongs to another user — BR-002's 404-not-403 rule)
- **Then** the editor area shows a "Note not found" error state (UX §7.5) with an action to return to the Dashboard; no editor chrome (toolbar/tag bar) is rendered.

### Creating a New Note (FR-NOTE-001, UX-NOTE-01)

**Scenario 4 — New note starts with cursor in title**
- **Given** the user navigates to `/notes/new`
- **Then** no `GET`/`POST` call is made yet, the title field shows placeholder "Untitled" and the body shows placeholder "Start writing...", and focus is placed in the title field (UX-NOTE-01).

**Scenario 5 — First edit on a new note creates it via POST**
- **Given** the user is on `/notes/new` with no note created yet
- **When** the user types in the title or body and 2 seconds of inactivity elapse
- **Then** `POST /api/notes` is called with the current `{title?, content?, tagIds?}`; on `201`, the app updates the URL to `/notes/:id` (via history replace, not a navigation/remount) using the returned `note.id`, and shows "Saved ✓".

**Scenario 6 — Subsequent edits on a newly created note use PATCH**
- **Given** Scenario 5 has completed and the note now has an ID
- **When** the user makes further edits and the debounce elapses again
- **Then** `PATCH /api/notes/:id` is called (not another `POST`).

### Autosave (FR-NOTE-003, UX-NOTE-02, SDS §23.3)

**Scenario 7 — Autosave debounce**
- **Given** the user is editing an existing note
- **When** the user types continuously
- **Then** no save request fires until 2 seconds of inactivity; each keystroke resets the timer (SDS §23.3 sequence).

**Scenario 8 — Dirty check prevents redundant saves**
- **Given** an existing note has loaded with no pending edits
- **When** 2+ seconds pass with no user interaction
- **Then** no `PATCH` call is made (autosave only triggers on actual content/title/tag changes).

**Scenario 9 — Saving indicator lifecycle**
- **Given** an autosave-triggering edit has occurred
- **Then** the header indicator shows "Saving..." for the duration of the API call, then "Saved ✓" on success (UX-NOTE-02).

**Scenario 10 — Autosave failure**
- **Given** an autosave `PATCH`/`POST` call fails (network error or 5xx)
- **Then** the indicator shows a red "Save failed" state (UX §8.7 Error States), the in-progress edits remain in the editor (not reverted/discarded), and the next content change re-attempts a save on its own debounce cycle (no automatic retry loop — SDS §23.3 Rule 5).

**Scenario 11 — Force save via Ctrl+S**
- **Given** the user has unsaved changes
- **When** the user presses `Ctrl+S`
- **Then** the pending debounce timer is cancelled and the save request fires immediately (SDS §15.2), showing the same Saving/Saved lifecycle.

**Scenario 12 — Content exceeds size limit**
- **Given** the TipTap content serializes to HTML exceeding `NOTE_CONTENT_MAX_SIZE_BYTES` (500 KB)
- **When** autosave fires
- **Then** the API responds `413 CONTENT_TOO_LARGE`; the "Save failed" indicator is shown with the server's message, and content is preserved in the editor for the user to trim.

**Scenario 13 — Title length**
- **Given** the user types a title beyond 255 characters
- **Then** the title input enforces (or the request schema rejects, surfacing a validation error) the `NOTE_TITLE_MAX_LENGTH` limit — exact enforcement point (client-side `maxLength` vs. server validation error surfaced in the indicator) to be decided in `/plan`.

### TipTap Formatting (SDS §23.1)

**Scenario 14 — All configured extensions are active**
- **Given** the editor is mounted
- **Then** StarterKit, Placeholder, Typography, Highlight, Link, CodeBlockLowlight, TaskList/TaskItem, Underline, TextAlign, and CharacterCount are all configured, matching SDS §23.1 exactly (no substitutions, no extra extensions — CON-001).

**Scenario 15 — Toolbar formatting actions**
- **Given** text is selected (or cursor is in an empty paragraph) in the editor
- **When** the user clicks a toolbar button (bold, italic, underline, strikethrough, highlight, link, bullet list, ordered list, task list, blockquote, inline code, code block, text align left/center/right)
- **Then** the corresponding TipTap command is executed and the toolbar button reflects active state via `aria-pressed="true"` (UX §8.7 Accessibility Notes).

**Scenario 16 — Keyboard shortcuts**
- **Given** the editor has focus
- **Then** each shortcut in SDS §15.2 (`Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+U` underline, `Ctrl+Shift+X` strikethrough, `Ctrl+Shift+H` highlight, `Ctrl+K` link, `Ctrl+Shift+8` bullet list, `Ctrl+Shift+9` ordered list, `Ctrl+Shift+B` blockquote, `Ctrl+E` inline code, `Ctrl+Shift+E` code block, `Ctrl+S` force save) triggers its mapped action.

**Scenario 17 — Link insertion**
- **Given** the user selects text and presses `Ctrl+K` (or clicks the Link toolbar button)
- **Then** a link input affordance appears (inline popover or prompt — exact UI to be decided in `/plan`) and, on confirmation, wraps the selection in an `<a href="...">` per the TipTap Link extension.

### Tag Bar (FR-NOTE-003, FR-TAG-001, UX-TAG-03)

**Scenario 18 — Adding an existing tag**
- **Given** the tag bar shows an "Add tag" affordance and `GET /api/tags` has resolved with the user's existing tags
- **When** the user selects an existing tag not already on the note
- **Then** the tag chip appears in the tag bar immediately (optimistic) and the tag's ID is included in the note's `tagIds` on the next autosave `PATCH`/`POST`.

**Scenario 19 — Removing a tag**
- **Given** the note has at least one tag
- **When** the user clicks a tag chip's remove ("×") control
- **Then** the chip is removed from the tag bar and the note's `tagIds` (without that tag) is included on the next autosave.

**Scenario 20 — Inline tag creation without a modal**
- **Given** the user types a new tag name into the tag bar's input that doesn't match any existing tag
- **When** the user confirms (e.g. presses Enter or selects "Create '<name>'")
- **Then** `POST /api/tags` is called with `{name}`; on success the new tag chip is added to the note's tag bar and its ID is included in the next autosave, and the `['tags','list']` query cache is invalidated so the Dashboard sidebar picks it up (UX-TAG-03).

**Scenario 21 — Duplicate tag name on inline creation**
- **Given** the user types a tag name that already exists for them
- **When** `POST /api/tags` returns `409 TAG_NAME_EXISTS`
- **Then** the existing tag (matched by the now-known name/id from the refreshed tags list) is added to the note instead of showing a hard error — exact UX (silently reuse vs. show inline message) to be decided in `/plan`.

**Scenario 22 — No tags on a note**
- **Given** a note has zero tags
- **Then** the tag bar shows only the "Add tag" affordance (BR-004 permits zero tags).

### Delete Confirmation (FR-NOTE-004, UX-SCR-008)

**Scenario 23 — Opening the delete confirmation**
- **Given** the editor's "More" menu (`ActionHeader`)
- **When** the user selects "Move to trash"
- **Then** a modal dialog opens (`role="dialog"`), focus traps inside it, and initial focus is on the "Cancel" button, not "Delete" (UX-NOTE-03).

**Scenario 24 — Cancel closes without action**
- **Given** the delete confirmation dialog is open
- **When** the user clicks "Cancel" or presses `Escape`
- **Then** the dialog closes, no API call is made, and focus returns to the "More" menu trigger (SDS §15.4 Rule 2).

**Scenario 25 — Confirming delete**
- **Given** the delete confirmation dialog is open
- **When** the user clicks "Move to trash" (destructive action) or presses `Enter`
- **Then** the button shows a loading spinner, `DELETE /api/notes/:id` is called, and on `200` the app navigates to `/` and shows a toast "Note moved to trash." with an "Undo" button (UX §8.8 Success States, UX §7.6).

**Scenario 26 — Undo within the toast window**
- **Given** the delete-confirmation toast with "Undo" is showing
- **When** the user clicks "Undo" within 5 seconds (UX-NOTE-04)
- **Then** `POST /api/notes/:id/restore` is called (reusing `useRestoreNoteMutation` from AB-1011), and on success a "Note restored" toast is shown and the `['notes','list']`/`['tags','list']` caches are invalidated.

**Scenario 27 — Undo window expires**
- **Given** the toast has been showing for more than 5 seconds
- **Then** the "Undo" action is no longer available (toast dismisses per normal toast duration) and the note remains in the trash.

**Scenario 28 — Delete API failure**
- **Given** the user confirms delete
- **When** `DELETE /api/notes/:id` fails (network error or unexpected 4xx/5xx)
- **Then** a toast notification shows the failure (UX §8.8 Error States) and the dialog closes without navigating away; the note remains in the editor unchanged.

### Unsaved Changes Guard (FR-NOTE-003, UX-NOTE-06)

**Scenario 29 — beforeunload warning with unsaved changes**
- **Given** the editor has pending edits not yet confirmed saved (`editorDirty` is `true` in `useUIStore`, set on change and cleared on successful autosave)
- **When** the user attempts to close the tab, refresh, or navigate to an external URL
- **Then** the browser's native `beforeunload` confirmation dialog appears (UX-NOTE-06).

**Scenario 30 — No warning once saved**
- **Given** the last edit has been successfully autosaved (indicator shows "Saved ✓", `editorDirty` is `false`)
- **When** the user closes/refreshes the tab
- **Then** no `beforeunload` confirmation appears.

### Navigation & Header (UX §8.7)

**Scenario 31 — Back button returns to Dashboard**
- **Given** the editor is open
- **When** the user clicks the top-left "←" back button
- **Then** the app navigates to `/` (Dashboard).

**Scenario 32 — Share and History actions are present but inert**
- **Given** the `ActionHeader`'s "More" menu (or header buttons)
- **Then** "Share" and "History" entries are rendered (per UX §8.7's component list) but are disabled or no-ops in this ticket — their functionality ships in AB-1014 and AB-1015 respectively.

### Responsive Behavior (UX §8.7)

**Scenario 33 — Desktop toolbar**
- **Given** viewport width is desktop-sized
- **Then** the TipTap toolbar renders full-width as a single sticky row.

**Scenario 34 — Tablet/mobile toolbar**
- **Given** viewport width is tablet or mobile-sized
- **Then** the toolbar becomes horizontally scrollable and input controls (title, tag bar) span full width.

### Cross-Cutting — Auth

**Scenario 35 — Unauthenticated access**
- **Given** no valid session
- **When** a user navigates to `/notes/:id` or `/notes/new`
- **Then** `ProtectedRoute` (AB-1010) redirects to `/login` before any note fetch/create is attempted.

## 4. API / Interface Contract

All endpoints already exist and are unchanged by this ticket:

| Method | Path | Auth | Request Body | Success Response |
| ------ | ---- | ---- | ------------- | ----------------- |
| GET | `/api/notes/:id` | Yes | — | `200 {note: NoteResponse}` |
| POST | `/api/notes` | Yes | `{title?, content?, tagIds?}` | `201 {note: NoteResponse}` |
| PATCH | `/api/notes/:id` | Yes | `{title?, content?, tagIds?}` | `200 {note: NoteResponse}` |
| DELETE | `/api/notes/:id` | Yes | — | `200 {message}` |
| POST | `/api/notes/:id/restore` | Yes | — | `200 {note: NoteResponse}` |
| GET | `/api/tags` | Yes | — | `200 {tags: TagWithCount[]}` |
| POST | `/api/tags` | Yes | `{name, color?}` | `201 {tag: TagResponse}` |

Error codes relevant to this ticket (from `@note-app/shared` `ERROR_CODES`): `NOTE_NOT_FOUND` (404), `CONTENT_TOO_LARGE` (413), `ALREADY_DELETED` (409, edge case if delete is double-submitted), `TAG_NAME_EXISTS` (409), `VALIDATION_ERROR` (422).

All request/response types come from `@note-app/shared` (`CreateNoteRequest`, `UpdateNoteRequest`, `NoteResponse`, `DeleteNoteResponse`, `RestoreNoteResponse`, `CreateTagRequest`, `TagResponse`) — no new schemas are added to `packages/shared` by this ticket.

## 5. State & Data Impact

- **Extends `apps/frontend/src/features/notes/`:** adds `notes.api.ts` functions for `getNote`, `createNote`, `updateNote`, `deleteNote` (alongside the existing `getNotes`/`restoreNote`); new hooks in `notes.hooks.ts` (`useNoteQuery`, `useCreateNoteMutation`, `useUpdateNoteMutation`, `useDeleteNoteMutation`) plus a dedicated autosave hook (e.g. `useAutosave`) encapsulating the 2s debounce + dirty check + create-then-update transition (Scenarios 5–6).
- **New components under `apps/frontend/src/features/notes/components/`:** `NoteEditor` (TipTap host), `TipTapToolbar`, `TagBar`, `AutosaveStatusIndicator`, `DeleteNoteDialog`, and an `ActionHeader` (or extension of one) with back button, title, indicator, and More menu (Share/History/Move to trash).
- **New shared UI primitive:** `apps/frontend/src/components/ui/dialog.tsx` (wrapping `@radix-ui/react-dialog`, already a pinned dependency but not yet scaffolded) — used by `DeleteNoteDialog` and reusable by AB-1014's Share modal.
- **New `apps/frontend/src/features/tags/`:** `createTag` in `tags.api.ts`, a `useCreateTagMutation` hook for inline tag creation.
- **`apps/frontend/src/pages/EditorPage.tsx`:** replaces the current placeholder with the composed editor layout; reads `:id` from the route (`useParams`) to distinguish new-note (`/notes/new`) vs. edit (`/notes/:id`) mode.
- **`apps/frontend/src/stores/ui.store.ts`:** `editorDirty`/`setEditorDirty` (already scaffolded) is consumed by the `beforeunload` guard (Scenarios 29–30); no new global state fields expected.
- **TanStack Query:** `['notes', 'detail', id]` query key for `GET /api/notes/:id`; mutations invalidate `['notes', 'list']` (title/tag changes affect Dashboard cards) and `['tags', 'list']` (inline tag creation, delete/restore affecting tag counts).
- **No new Prisma models, no backend changes** — this ticket is frontend-only.

## 6. Out of Scope

- Share modal, share link generation/copy/revoke (UX-SCR-011) — AB-1014. This ticket only renders an inert "Share" entry point.
- Version history drawer, restore-to-version (UX-SCR-013 or equivalent) — AB-1015. This ticket only renders an inert "History" entry point.
- Search (UX-SCR-009) — AB-1013.
- Full Tag Management Modal (UX-SCR-010): editing/deleting existing tags, tag color picking — only inline *creation* of new tags from the editor's tag bar is in scope here.
- Server-side HTML sanitization — already implemented in `notes.content.ts` (AB-1004); the frontend does not need to sanitize before sending, only needs to respect the 500 KB size validation for UX feedback.
- Backend changes of any kind — AB-1004/1006/1009 already implement and merge all consumed endpoints.

## 7. Open Questions for `/plan`

1. **URL transition mechanics on first save (Scenario 5):** whether `/notes/new` → `/notes/:id` uses `navigate(path, {replace: true})` after the `POST` resolves, or some other mechanism to avoid remounting the editor (which would lose in-flight TipTap state) — needs a concrete React Router approach.
2. **Title max-length enforcement point (Scenario 13):** client-side `maxLength` attribute (simplest, prevents the issue entirely) vs. relying on/surfacing the server's trim+truncate — pick one.
3. **Link insertion UI (Scenario 17):** inline popover vs. native `window.prompt` vs. a small floating form — SDS/UX don't specify the exact widget, only the `Ctrl+K` shortcut and that it edits/inserts a link.
4. **Duplicate tag name on inline creation (Scenario 21):** silently attach the existing tag (best UX, requires reading the 409's implied existing tag or refetching `['tags','list']` to resolve by name) vs. surfacing an inline "Tag already exists" message and requiring the user to pick it from the list manually.
5. **Autosave hook shape:** whether the 2s-debounce + dirty-check + create-then-patch transition logic is a single reusable `useAutosave` hook (as sketched in §5) or split across `NoteEditor` and the mutations directly — an implementation detail for `/plan`/`/tasks`.
6. **`ActionHeader` reuse across AB-1012/1014/1015:** since Share and History both attach to the same header, decide now whether `ActionHeader` takes a slot/children API (so AB-1014/1015 can inject real handlers later without modifying this ticket's component) or whether those tickets are expected to edit `ActionHeader` directly.
