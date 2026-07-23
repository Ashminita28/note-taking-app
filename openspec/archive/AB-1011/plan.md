# AB-1011 — Frontend Notes List Page: Implementation Plan

## 1. Resolved Decisions (spec Open Questions 1–3, 5)

| # | Question (from spec.md) | Decision |
| - | ------------------------ | -------- |
| 1 | List-control state mechanism | **URL search params** on `/`, via a `useNotesListParams` hook wrapping `useSearchParams` (react-router-dom, already a dependency). Params: `page`, `sortBy`, `sortOrder`, `tagIds` (comma-separated), `trash` (`"1"` or absent). Every setter calls `setSearchParams(..., { replace: true })` so filter/sort/page changes don't spam browser history. Rationale: keeps list-control state out of Zustand (per `apps/frontend/CLAUDE.md` — Zustand is for auth/UI state only), gives free back-button/refresh resilience, and needs no new store. |
| 2 | Trash + tag-filter interaction | While `trash=1` is active, the query builder **omits `tagIds` from the request entirely** (trash is not tag-filterable) and `SidebarTagList` renders its chips `disabled` (dimmed, `pointer-events-none`, `aria-disabled="true"`). Any previously selected `tagIds` remain in the URL untouched, so switching back to the active view restores the prior filter without the user having to reselect. |
| 3 | `Ctrl+K` before AB-1013 | **Not wired up in this ticket.** No search input is rendered and no `Ctrl+K` listener is registered — avoids building a placeholder that AB-1013 immediately replaces. Only `Ctrl+N` (new note) is implemented now. Scenario 25 in spec.md is satisfied partially; the `Ctrl+K` half is explicitly deferred to AB-1013. |
| 5 | Note preview truncation length | **150 characters**, defined as `NOTE_PREVIEW_LENGTH` in a new local `apps/frontend/src/features/notes/notes.constants.ts` — **not** added to `packages/shared`, since it's a display-only formatting concern, not a data contract (`packages/shared/CLAUDE.md` scopes that package to contracts shared between frontend and backend). |

**Question 4 (Tag Management Modal / UX-SCR-010 ownership gap) is not resolved here** — it doesn't block AB-1011 (this ticket's sidebar is read-only) but is flagged to the user again below since no ticket in FRS §25.2 claims it.

## 2. Architecture Overview

```
DashboardPage (apps/frontend/src/pages/DashboardPage.tsx)
├── SkipLink (#main-content)
├── Sidebar (components/layout/Sidebar.tsx)          — responsive shell, reads/writes useUIStore.sidebarOpen
│   └── SidebarTagList (features/tags/components/)   — useTagsQuery + tag-chip toggle → useNotesListParams
├── DashboardHeader (components/layout/DashboardHeader.tsx)
│   ├── "+ New Note" Button → navigate('/notes/new')
│   └── UserMenu (features/auth/components/UserMenu.tsx) — useAuthStore.user + useLogout
└── <main id="main-content">
    ├── TrashToggle (features/notes/components/)
    ├── SortDropdown (features/notes/components/)     — disabled/hidden while trash active
    ├── NotesList (features/notes/components/)         — useNotesQuery(params)
    │   ├── NoteCardSkeleton × 3–5 (loading)
    │   ├── EmptyNotesState (no notes / no tag match / empty trash variants)
    │   └── NoteCard × N → navigate(`/notes/${id}`); trash view adds a "Restore" action
    └── PaginationControls (features/notes/components/)
```

State flow: `useNotesListParams()` is the single source of truth for `{page, sortBy, sortOrder, tagIds, trash}`, read from the URL. `NotesList`/`SortDropdown`/`PaginationControls`/`TrashToggle`/`SidebarTagList` all consume it via the same hook instance (called once in `DashboardPage`, passed down as props — no context needed for a single-page tree this shallow).

## 3. Files to Create

### `packages/shared`
**None.** All required schemas/types (`ListNotesQuery`, `ListNotesResponse`, `NoteResponse`, `NOTE_SORT_FIELDS`, `SORT_ORDERS`, `ListTagsResponse`, `TagWithCount`, `RestoreNoteResponse`) already exist from AB-1005/AB-1006.

### `apps/frontend/src/components/ui/` (new shared primitives, shadcn-style — none of these exist yet)
| File | Purpose |
| ---- | ------- |
| `skeleton.tsx` | `<Skeleton className>` — pulsing `bg-[var(--surface)]` div for shimmer states (UX §11 pattern rules: 1.5s linear pulse, dimensions match real content). |
| `badge.tsx` | Small pill for tag chips / note counts, using `--radius-sm` per UX §21.4. |
| `dropdown-menu.tsx` | Thin wrapper over the already-installed `@radix-ui/react-dropdown-menu`, shadcn-style (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`) — reused by both `SortDropdown` and `UserMenu`. |

### `apps/frontend/src/components/layout/` (new — page chrome, not feature-specific)
| File | Purpose |
| ---- | ------- |
| `Sidebar.tsx` | Renders `<nav>` landmark; desktop persistent (≥1024px), tablet/mobile overlay driven by `useUIStore.sidebarOpen`/`toggleSidebar` (UX §8.6 responsive rules, §16). Renders `SidebarTagList` + hamburger trigger (tablet/mobile only). |
| `DashboardHeader.tsx` | App header: "+ New Note" button, `UserMenu`. |
| `SkipLink.tsx` | `<a href="#main-content">Skip to main content</a>`, first focusable element (UX §17). |

### `apps/frontend/src/features/notes/`
| File | Purpose |
| ---- | ------- |
| `notes.constants.ts` | `NOTE_PREVIEW_LENGTH = 150`. |
| `notes.utils.ts` | `stripHtmlToPlainText(html: string): string` (DOM-based strip using `DOMParser`, safe since content already server-sanitized per SDS §23.4), `truncate(text: string, max: number): string`, `buildNotesQuery(params: NotesListParams): string` (URLSearchParams builder — comma-joins `tagIds`, omits `tagIds` when `trash` is true per Decision 2). |
| `notes.types.ts` | Local `NotesListParams` interface (`{page: number; sortBy: NoteSortField; sortOrder: SortOrder; tagIds: string[]; trash: boolean}`) — UI-only shape, not a shared contract. |
| `useNotesListParams.ts` | Wraps `useSearchParams`; returns `{params: NotesListParams; setPage; setSort; toggleTag; setTrash}`. Defaults: `page=DEFAULT_PAGE`, `sortBy=DEFAULT_SORT_BY`, `sortOrder=DEFAULT_SORT_ORDER`, `tagIds=[]`, `trash=false` (constants imported from `@note-app/shared`). |
| `notes.api.ts` | `getNotes(params: NotesListParams): Promise<ListNotesResponse>`, `restoreNote(id: string): Promise<RestoreNoteResponse>` — both thin `apiClient.request` wrappers. |
| `notes.hooks.ts` | `useNotesQuery(params)` → `useQuery({queryKey: ['notes','list', params], queryFn: () => getNotes(params)})`; `useRestoreNoteMutation()` → `useMutation`, `onSuccess` invalidates `['notes','list']` and `['tags','list']` (note counts shift), shows toast "Note restored" (UX §13). |
| `components/NoteCard.tsx` | Title, `stripHtmlToPlainText` + `truncate`d preview, tag `Badge`s, formatted `updatedAt`; clickable (`role="button"`/`<Link>`) → `/notes/:id`; trash view renders a "Restore" button instead of navigating. |
| `components/NoteCardSkeleton.tsx` | Shimmer skeleton matching `NoteCard` dimensions. |
| `components/NotesList.tsx` | Consumes `useNotesQuery`; renders 3–5 `NoteCardSkeleton` while loading, retry banner on error, `EmptyNotesState` variant when `data.length === 0`, else a `<ul>` of `NoteCard`s with roving `↑`/`↓`/`Enter` keyboard nav (UX §15.3). |
| `components/EmptyNotesState.tsx` | Three variants driven by props: `no-notes` (UX-NOTE-07 CTA → `/notes/new`), `no-tag-match`, `empty-trash` (UX §10 copy table). |
| `components/SortDropdown.tsx` | `DropdownMenu` of the 6 `sortBy`×`sortOrder` combinations; disabled/hidden when `trash` is active (sort still technically supported server-side in trash view per AB-1005, but UX doesn't call for it — kept simple/hidden). |
| `components/PaginationControls.tsx` | Prev/Next + "Page X of Y" from `pagination` metadata; hides itself when `totalPages <= 1` (resolves spec Q18 — simplest option, no dead controls). |
| `components/TrashToggle.tsx` | Toggle button/switch; flips `trash` param, resets `page` to 1. |

### `apps/frontend/src/features/tags/`
| File | Purpose |
| ---- | ------- |
| `tags.api.ts` | `getTags(): Promise<ListTagsResponse>`. |
| `tags.hooks.ts` | `useTagsQuery()` → `useQuery({queryKey: ['tags','list'], queryFn: getTags})`. |
| `components/TagChip.tsx` | `Badge`-based chip: name + `noteCount`, selected/disabled visual states. |
| `components/TagListSkeleton.tsx` | 4–6 shimmer lines (UX §11). |
| `components/SidebarTagList.tsx` | Consumes `useTagsQuery`; loading → `TagListSkeleton`; error → retry affordance; empty → "No tags yet" (UX §10); else renders `TagChip` list, wires clicks to `toggleTag` from `useNotesListParams`, disables all chips when `trash` is active (Decision 2). |

### `apps/frontend/src/features/auth/components/`
| File | Purpose |
| ---- | ------- |
| `UserMenu.tsx` | `DropdownMenu` trigger showing `useAuthStore.user.name`; single item "Sign out" calling the existing `useLogout()` hook (already implemented in AB-1010, unused until now per its own code comment). |

## 4. Files to Modify

| File | Change |
| ---- | ------ |
| `apps/frontend/src/pages/DashboardPage.tsx` | Replace placeholder with the composed layout from Section 2: `SkipLink`, `Sidebar`, `DashboardHeader`, `<main id="main-content">` containing `TrashToggle` + `SortDropdown` + `NotesList` + `PaginationControls`. Owns the single `useNotesListParams()` instance and a `useEffect` keydown listener for `Ctrl+N` → `navigate('/notes/new')`. |

No changes to `App.tsx` (route already wired to `ProtectedRoute` + `DashboardPage`), no changes to `packages/shared`, no changes to `apps/backend`, no new Prisma migrations.

## 5. TypeScript Interfaces (local, non-shared)

```typescript
// features/notes/notes.types.ts
import type { NoteSortField } from '@note-app/shared';

export type SortOrder = 'asc' | 'desc'; // mirrors shared SORT_ORDERS union

export interface NotesListParams {
  page: number;
  sortBy: NoteSortField;
  sortOrder: SortOrder;
  tagIds: string[];
  trash: boolean;
}
```

All request/response shapes reuse `@note-app/shared` types directly (`ListNotesQuery`, `ListNotesResponse`, `NoteResponse`, `ListTagsResponse`, `TagWithCount`, `RestoreNoteResponse`) — no duplication, per CON-003.

## 6. Data Fetching / Cache Keys (SDS §22)

| Hook | Query Key | Invalidated By |
| ---- | --------- | --------------- |
| `useNotesQuery(params)` | `['notes', 'list', params]` | `useRestoreNoteMutation` success |
| `useTagsQuery()` | `['tags', 'list']` | `useRestoreNoteMutation` success (note counts can shift) |

## 7. DB / Backend Impact

**None.** Read-only consumption of `GET /api/notes`, `GET /api/tags`, `POST /api/notes/:id/restore` — all already implemented and merged (AB-1004/1005/1006). No Prisma schema changes, no migrations.

## 8. Accessibility & Keyboard Checklist (to verify during implementation)

- Skip link is the first focusable element; targets `#main-content`.
- `<nav>` (Sidebar) and `<main id="main-content">` landmarks present.
- `Ctrl+N` → `/notes/new` (global keydown, ignored when focus is inside an input/textarea/contenteditable).
- `↑`/`↓`/`Enter` roving navigation within the note card list.
- Tag chips and sort/trash toggle controls are real `<button>`s with `aria-pressed`/`aria-disabled` as appropriate — never `<div onClick>`.
- Disabled tag chips (trash view) still expose `aria-disabled="true"`, not just visual dimming.

## 9. Test Plan

Mirrors `apps/frontend/tests/` structure (Vitest + React Testing Library for unit, Playwright for e2e), matching existing AB-1010 test coverage patterns.

**Unit (`tests/unit/...`):**
- `features/notes/notes.utils.test.ts` — `stripHtmlToPlainText`, `truncate`, `buildNotesQuery` (incl. `tagIds` omitted when `trash=true`).
- `features/notes/useNotesListParams.test.ts` — default params, each setter, `replace: true` behavior.
- `features/notes/notes.api.test.ts` — `getNotes`/`restoreNote` call `apiClient.request` with expected path/query.
- `features/notes/components/NoteCard.test.tsx`, `NotesList.test.tsx` (loading/error/empty/populated states), `SortDropdown.test.tsx`, `PaginationControls.test.tsx` (boundary: page 1, last page, single page), `TrashToggle.test.tsx`.
- `features/tags/tags.api.test.ts`, `features/tags/components/SidebarTagList.test.tsx` (loading/error/empty/populated, disabled-in-trash state), `TagChip.test.tsx`.
- `features/auth/components/UserMenu.test.tsx` — renders user name, "Sign out" invokes `useLogout`.
- `components/layout/Sidebar.test.tsx` — responsive overlay toggling via `useUIStore`.
- `pages/DashboardPage.test.tsx` — composition smoke test + `Ctrl+N` keyboard shortcut.

**E2E (`tests/e2e/`):** extend beyond the current `placeholder.spec.ts` with `dashboard.spec.ts` covering the golden path — log in, see notes list, filter by tag, change sort, paginate, toggle trash view, restore a note, hit the empty state with a fresh account.

**Coverage target:** ≥80% on all new code per `CLAUDE.md` quality gates.

## 10. Checkpoints (run after implementation, before commit)

```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test:coverage
pnpm --filter @note-app/frontend test:e2e   # requires backend + DB running (docker compose up -d, pnpm dev:backend)
```

Then the full monorepo gate before commit, per root `CLAUDE.md`:

```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

## 11. Open Item Still Flagged to User

**UX-SCR-010 (Tag Management Modal — create/edit/delete tags) has no owning ticket** in FRS §25.2 (AB-1010 through AB-1016). This plan builds the sidebar as **read-only** (list + filter), consistent with AB-1011's spec scope. If tag CRUD is expected somewhere in the AB-10XX sequence, that gap should be resolved (e.g. added to AB-1011's scope, or a new ticket) before AB-1016's end-to-end journey ticket, since it will otherwise have no screen to exercise FR-TAG-001/003/004 client-side.

---

Not proceeding to implementation — awaiting approval.
