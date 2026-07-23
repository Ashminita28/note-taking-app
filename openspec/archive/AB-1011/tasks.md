# AB-1011 — Frontend Notes List Page: Task Checklist

Source: `openspec/tickets/AB-1011/spec.md`, `openspec/tickets/AB-1011/plan.md`.
No backend/DB/shared-package work is required — all consumed endpoints and types
already exist (AB-1004/1005/1006). Phase 1 below is therefore UI-primitive/scaffolding
setup rather than shared-types/migrations.

---

## Phase 1 — Foundation (shared UI primitives, local types/constants, scaffolding)

- [ ] 1.1 Create `apps/frontend/src/components/ui/skeleton.tsx` (shimmer primitive, 1.5s pulse, per UX §11).
- [ ] 1.2 Create `apps/frontend/src/components/ui/badge.tsx` (tag chip / note-count pill primitive).
- [ ] 1.3 Create `apps/frontend/src/components/ui/dropdown-menu.tsx` (shadcn-style wrapper over existing `@radix-ui/react-dropdown-menu` dependency).
- [ ] 1.4 Create `apps/frontend/src/features/notes/notes.constants.ts` (`NOTE_PREVIEW_LENGTH = 150`).
- [ ] 1.5 Create `apps/frontend/src/features/notes/notes.types.ts` (`NotesListParams`, local `SortOrder`).
- [ ] 1.6 Create `apps/frontend/src/features/notes/notes.utils.ts` (`stripHtmlToPlainText`, `truncate`, `buildNotesQuery` — `tagIds` omitted when `trash=true` per plan Decision 2).
- [ ] 1.7 Create `apps/frontend/src/features/notes/useNotesListParams.ts` (URL-search-params-backed hook; defaults from `@note-app/shared` constants; setters use `{ replace: true }`).
- [ ] 1.8 Create empty directories/barrel-less scaffolds for `apps/frontend/src/features/tags/components/` and `apps/frontend/src/components/layout/` (no barrel files needed — direct imports).

**Checkpoint 1:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 2 — Core Implementation (data layer: API wrappers + query hooks)

- [ ] 2.1 Create `apps/frontend/src/features/notes/notes.api.ts` — `getNotes(params)`, `restoreNote(id)` via `apiClient`.
- [ ] 2.2 Create `apps/frontend/src/features/notes/notes.hooks.ts` — `useNotesQuery(params)` (`['notes','list',params]`), `useRestoreNoteMutation()` (invalidates `['notes','list']` + `['tags','list']`, fires "Note restored" toast per UX §13).
- [ ] 2.3 Create `apps/frontend/src/features/tags/tags.api.ts` — `getTags()`.
- [ ] 2.4 Create `apps/frontend/src/features/tags/tags.hooks.ts` — `useTagsQuery()` (`['tags','list']`).

**Checkpoint 2:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 3 — Integration & UI Components

### Notes feature components
- [ ] 3.1 `features/notes/components/NoteCardSkeleton.tsx`
- [ ] 3.2 `features/notes/components/NoteCard.tsx` (title, stripped+truncated preview, tag `Badge`s, formatted `updatedAt`, click → `/notes/:id`; trash-view "Restore" action calls `useRestoreNoteMutation`)
- [ ] 3.3 `features/notes/components/EmptyNotesState.tsx` (`no-notes` / `no-tag-match` / `empty-trash` variants, UX §10 copy)
- [ ] 3.4 `features/notes/components/NotesList.tsx` (loading skeletons, retry-on-error, empty-state routing, populated list with `↑`/`↓`/`Enter` roving keyboard nav)
- [ ] 3.5 `features/notes/components/SortDropdown.tsx` (6 `sortBy`×`sortOrder` combos; hidden when `trash` active)
- [ ] 3.6 `features/notes/components/PaginationControls.tsx` (hides when `totalPages <= 1`)
- [ ] 3.7 `features/notes/components/TrashToggle.tsx` (flips `trash` param, resets `page` to 1)

### Tags feature components
- [ ] 3.8 `features/tags/components/TagListSkeleton.tsx`
- [ ] 3.9 `features/tags/components/TagChip.tsx` (selected / disabled visual + `aria-pressed`/`aria-disabled`)
- [ ] 3.10 `features/tags/components/SidebarTagList.tsx` (loading/error/empty/populated; disables all chips when `trash` active per Decision 2)

### Layout & auth
- [ ] 3.11 `components/layout/SkipLink.tsx`
- [ ] 3.12 `components/layout/Sidebar.tsx` (desktop persistent / tablet+mobile overlay via `useUIStore.sidebarOpen`/`toggleSidebar`; renders `SidebarTagList`)
- [ ] 3.13 `components/layout/DashboardHeader.tsx` ("+ New Note" button, `UserMenu`)
- [ ] 3.14 `features/auth/components/UserMenu.tsx` (wires the existing `useLogout()` hook from AB-1010 to a visible "Sign out" action for the first time)

### Page composition
- [ ] 3.15 Rewrite `apps/frontend/src/pages/DashboardPage.tsx`: single `useNotesListParams()` instance; compose `SkipLink` + `Sidebar` + `DashboardHeader` + `<main id="main-content">` (`TrashToggle`, `SortDropdown`, `NotesList`, `PaginationControls`); global `Ctrl+N` → `/notes/new` keydown handler (ignored while focus is in an input/textarea/contenteditable).

**Checkpoint 3:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```
Manual smoke check: `pnpm dev` (backend + frontend), log in, confirm Dashboard renders notes/tags, sort, paginate, tag-filter, trash-toggle, and restore all work end-to-end against the real API.

---

## Phase 4 — Tests (unit, integration, E2E)

### Unit — data layer
- [ ] 4.1 `tests/unit/features/notes/notes.utils.test.ts`
- [ ] 4.2 `tests/unit/features/notes/useNotesListParams.test.ts`
- [ ] 4.3 `tests/unit/features/notes/notes.api.test.ts`
- [ ] 4.4 `tests/unit/features/tags/tags.api.test.ts`

### Unit — components
- [ ] 4.5 `tests/unit/features/notes/components/NoteCard.test.tsx`
- [ ] 4.6 `tests/unit/features/notes/components/NotesList.test.tsx` (loading/error/empty variants/populated)
- [ ] 4.7 `tests/unit/features/notes/components/SortDropdown.test.tsx`
- [ ] 4.8 `tests/unit/features/notes/components/PaginationControls.test.tsx` (page 1 / last page / single-page-hides)
- [ ] 4.9 `tests/unit/features/notes/components/TrashToggle.test.tsx`
- [ ] 4.10 `tests/unit/features/tags/components/SidebarTagList.test.tsx` (loading/error/empty/populated/disabled-in-trash)
- [ ] 4.11 `tests/unit/features/tags/components/TagChip.test.tsx`
- [ ] 4.12 `tests/unit/features/auth/components/UserMenu.test.tsx`
- [ ] 4.13 `tests/unit/components/layout/Sidebar.test.tsx` (responsive overlay toggling)
- [ ] 4.14 `tests/unit/pages/DashboardPage.test.tsx` (composition smoke test + `Ctrl+N` shortcut)

### E2E
- [ ] 4.15 `tests/e2e/dashboard.spec.ts` — golden path: login → notes list renders → filter by tag → change sort → paginate → toggle trash view → restore a note → fresh-account empty state.

**Checkpoint 4 (final gate before PR, per root `CLAUDE.md`):**
```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/frontend test:coverage   # confirm ≥80% coverage on new code
pnpm --filter @note-app/frontend test:e2e        # requires docker compose up -d + pnpm dev:backend
```

---

Not proceeding to implementation — awaiting approval.
