# AB-1013 — Frontend Search UI: Task Checklist

Source: `openspec/tickets/AB-1013/spec.md`, `openspec/tickets/AB-1013/plan.md`.
No backend/DB/shared-package work is required — `GET /api/search` and all its types
(`SearchQuery`, `SearchResult`, `SearchResponse`, `SEARCH_QUERY_MIN_LENGTH`/`MAX_LENGTH`,
`DEFAULT_PAGE_SIZE`) already exist and are merged (AB-1007). Phase 1 below is therefore
small shared-utility/scaffolding setup, not shared-types/migrations.

---

## Phase 1 — Foundation (shared utilities, local types/constants)

- [ ] 1.1 Create `apps/frontend/src/lib/dom.ts` — extract `isTypingTarget(target)` out of `DashboardPage.tsx` so it's shared, not duplicated.
- [ ] 1.2 Create `apps/frontend/src/hooks/useDebouncedValue.ts` — generic `useDebouncedValue<T>(value, delayMs)`.
- [ ] 1.3 Create `apps/frontend/src/features/search/search.constants.ts` — `SEARCH_DEBOUNCE_MS = 300`, `SEARCH_RESULTS_SKELETON_COUNT = 3`.
- [ ] 1.4 Create `apps/frontend/src/features/search/search.types.ts` — local `SearchListParams { q: string; page: number }`.
- [ ] 1.5 Create `apps/frontend/src/features/search/utils/parseSnippet.ts` — pure function splitting a `ts_headline` snippet on literal `<mark>`/`</mark>` delimiters into `{text, highlighted}` segments (plan Decision 3 — the XSS-safety boundary for this ticket).

**Checkpoint 1:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 2 — Core Implementation (data layer: API wrapper + query hook + URL-param hook)

- [ ] 2.1 Create `apps/frontend/src/features/search/search.api.ts` — `getSearchResults(params: SearchListParams): Promise<SearchResponse>` via `apiClient` (`GET /search?q=&page=&pageSize=DEFAULT_PAGE_SIZE`).
- [ ] 2.2 Create `apps/frontend/src/features/search/search.hooks.ts` — `useSearchQuery(params)` → `useQuery({queryKey: ['search', params], queryFn, enabled: q.trim().length >= SEARCH_QUERY_MIN_LENGTH})`.
- [ ] 2.3 Create `apps/frontend/src/features/search/useSearchResultsParams.ts` — wraps `useSearchParams`; `{params: {q, page}, setPage}`, `setPage` uses `{replace: true}` (mirrors `useNotesListParams`).

**Checkpoint 2:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 3 — Integration & UI Components

### Search feature components
- [ ] 3.1 `features/search/components/SnippetHighlight.tsx` — consumes `parseSnippet`; highlighted segments in a real `<mark>`, everything else as plain escaped text (no `dangerouslySetInnerHTML`).
- [ ] 3.2 `features/search/components/SearchResultSkeleton.tsx` — shimmer skeleton matching `SearchResultItem` dimensions.
- [ ] 3.3 `features/search/components/SearchResultItem.tsx` — `<Link data-search-result to="/notes/:id">` with title + `SnippetHighlight`, styled consistently with `NoteCard`.
- [ ] 3.4 `features/search/components/EmptySearchState.tsx` — 🔍 "No notes found for "{query}"" / "Try different keywords or check spelling" (UX §10/§8.9), query interpolated as a JSX text child.
- [ ] 3.5 `features/search/components/SearchResultsList.tsx` — consumes `useSearchQuery`; loading (3 skeletons) / error (retry banner, "Search unavailable. Please try again.") / empty (`EmptySearchState`) / populated (`<ul>` of `SearchResultItem`s with roving `↑`/`↓`/`Enter` keyboard nav) states; visually-hidden `aria-live="polite"` region announcing `"{N} results found"` on every settled fetch.
- [ ] 3.6 `features/search/components/SearchBar.tsx` — local input state + `useDebouncedValue`; `Ctrl+K` (window listener, guarded by `isTypingTarget`) focuses+selects; `Escape` (input keydown) clears value and navigates to `/` if on `/search`; `ArrowDown` (input keydown) focuses first `[data-search-result]`; debounced-value effect navigates to `/search?q=...` (`replace` if already on `/search`) or to `/` when cleared, guarded by a `lastNavigatedRef` to avoid redundant navigations. Input capped at `SEARCH_QUERY_MAX_LENGTH`, `aria-label="Search notes"`.

### Page composition
- [ ] 3.7 Modify `apps/frontend/src/components/layout/DashboardHeader.tsx` — render `<SearchBar />` between the left group and the right group.
- [ ] 3.8 Modify `apps/frontend/src/pages/DashboardPage.tsx` — replace the local `isTypingTarget` with the shared `src/lib/dom.ts` import (no behavioral change).
- [ ] 3.9 Create `apps/frontend/src/pages/SearchResultsPage.tsx` — `SkipLink` + `DashboardHeader` + `<main id="main-content">` with `SearchResultsList` + `PaginationControls` (reused from `features/notes`); reads `{q, page}` via `useSearchResultsParams`.
- [ ] 3.10 Modify `apps/frontend/src/App.tsx` — add `<Route path="/search" element={<ProtectedRoute><SearchResultsPage /></ProtectedRoute>} />`.

**Checkpoint 3:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```
Manual smoke check: `pnpm dev` (backend + frontend), log in, press `Ctrl+K`, type a query matching an existing note, confirm debounced navigation to `/search`, highlighted snippet renders (including a note with literal `<`/`>` in its content — confirm it displays as text, not markup), click through to the note, `Escape` back to Dashboard, and confirm the empty-query and no-results states render correctly.

---

## Phase 4 — Tests (unit, integration, E2E)

### Unit — data layer
- [ ] 4.1 `tests/unit/lib/dom.test.ts`
- [ ] 4.2 `tests/unit/hooks/useDebouncedValue.test.ts` (fake timers: rapid updates collapse to one final value)
- [ ] 4.3 `tests/unit/features/search/utils/parseSnippet.test.ts` (plain text / single & multiple `<mark>` runs / literal `<`/`>` outside any marker — the XSS-safety proof)
- [ ] 4.4 `tests/unit/features/search/search.api.test.ts`
- [ ] 4.5 `tests/unit/features/search/search.hooks.test.tsx` (`enabled` gating at empty/whitespace vs. real query)
- [ ] 4.6 `tests/unit/features/search/useSearchResultsParams.test.tsx` (defaults, `setPage` with `replace: true`)

### Unit — components
- [ ] 4.7 `tests/unit/features/search/components/SnippetHighlight.test.tsx`
- [ ] 4.8 `tests/unit/features/search/components/SearchResultItem.test.tsx`
- [ ] 4.9 `tests/unit/features/search/components/EmptySearchState.test.tsx`
- [ ] 4.10 `tests/unit/features/search/components/SearchResultsList.test.tsx` (loading/error+retry/empty/populated, `aria-live` announcement, roving arrow-key nav)
- [ ] 4.11 `tests/unit/features/search/components/SearchBar.test.tsx` (debounce-then-navigate, `Ctrl+K` focus+select, `Escape` clear+navigate, `ArrowDown` focus-first-result, max-length cap)
- [ ] 4.12 `tests/unit/components/layout/DashboardHeader.test.tsx` (new file — confirms `SearchBar` renders alongside existing header controls)
- [ ] 4.13 `tests/unit/pages/SearchResultsPage.test.tsx` (composition smoke test)
- [ ] 4.14 Update `tests/unit/pages/DashboardPage.test.tsx` if needed for the `isTypingTarget` import move (behavior unchanged, existing assertions should still pass as-is).

### E2E
- [ ] 4.15 `tests/e2e/search.spec.ts` — golden path (UX §7.7): login → create a note via fixture/API → `Ctrl+K` → type a matching term → debounced navigation to `/search` with highlighted results → click a result → lands on `/notes/:id` → back to Dashboard → `Escape` clears an in-progress search.

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
