# AB-1013 — Frontend Search UI: Implementation Plan

## 1. Resolved Decisions (spec Open Questions 1–5)

| # | Question (from spec.md) | Decision |
| - | ------------------------ | -------- |
| 1 | Shared header/layout between `/` and `/search` | **No new `AppShell` abstraction.** `SearchBar` is added directly inside the existing `DashboardHeader` component (`apps/frontend/src/components/layout/DashboardHeader.tsx`), which is already a standalone, reusable component. A new `SearchResultsPage` renders `SkipLink` + `DashboardHeader` + `<main>` — the same shell as `DashboardPage` minus `Sidebar` (UX-SCR-009's component list has no `Sidebar`). This avoids touching `DashboardPage`'s internals at all. `Ctrl+K`/`Escape` keyboard handling lives *inside* `SearchBar` itself (not at the page level), so it works identically wherever `DashboardHeader` is mounted — no shell-level listener needed. |
| 2 | Live-navigate vs. explicit submit | **Live-navigate.** `SearchBar` owns local input state, debounces it 300ms (`useDebouncedValue`), then imperatively `navigate()`s to `/search?q=<value>` — `replace: true` when already on `/search` (so typing doesn't spam history), a normal push the first time (from `/`, so the back button returns to the Dashboard, and `Escape`/clear also explicitly `navigate('/')` for the deterministic case). A `lastNavigatedRef` guard skips re-navigating when the trimmed debounced value hasn't actually changed (covers the initial-mount case when landing directly on `/search?q=...`). |
| 3 | Snippet-highlighting implementation | `SnippetHighlight` splits the `snippet` string on the literal delimiters `<mark>` / `</mark>` via `snippet.split(/(<mark>|<\/mark>)/)`, tracks an "inside highlight" boolean while walking the parts, and renders each non-delimiter part as a plain React text child — highlighted parts wrapped in a real `<mark>` element, everything else in a plain `<span>`. **No `dangerouslySetInnerHTML` anywhere in this feature.** Since React text children are auto-escaped, literal `<`/`>`/`&` characters that a user typed into note content (and that `ts_headline` left un-escaped — confirmed in `search.service.ts`) render as literal visible text, never as markup. Unit-tested with a snippet containing literal `<`/`>` outside any `<mark>` marker. **Accepted limitation:** if a user's own note content happens to contain the literal substring `<mark>`, the parser will mis-highlight that literal text — a cosmetic edge case only (it's still rendered as escaped text, never executed), not a security issue, and not worth solving given the backend provides no distinguishing escape mechanism. |
| 4 | Minimum characters before firing a request | **1 trimmed character**, matching the backend contract (`SEARCH_QUERY_MIN_LENGTH` from `@note-app/shared` is `1`) exactly — no extra client-side floor. `useSearchQuery` is `enabled` only when `q.trim().length >= 1`. |
| 5 | Empty-state message escaping | The interpolated query in `EmptySearchState` is passed as a JSX expression child (`No notes found for "{query}"`), never string-concatenated into `innerHTML`/`dangerouslySetInnerHTML` — React's default escaping applies. |

## 2. Architecture Overview

```
DashboardHeader (components/layout/DashboardHeader.tsx) — MODIFIED, now shared by both pages below
├── "Notes" title / sidebar toggle (unchanged)
├── SearchBar (features/search/components/SearchBar.tsx)   — NEW
│   ├── local `value` state + useDebouncedValue(value, 300)
│   ├── Ctrl+K (window listener) → focus + select input
│   ├── Escape (input keydown) → clear value; navigate('/') if on /search
│   ├── ArrowDown (input keydown) → focus first [data-search-result]
│   └── debounced-value effect → navigate(`/search?q=...`) / navigate('/') when cleared
├── "+ New Note" Button (unchanged)
└── UserMenu (unchanged)

DashboardPage (unchanged)                         SearchResultsPage (features consumed below) — NEW
├── SkipLink                                       ├── SkipLink
├── DashboardHeader (now incl. SearchBar)          ├── DashboardHeader (now incl. SearchBar)
├── Sidebar                                        └── <main id="main-content">
└── <main>: TrashToggle/SortDropdown/                  └── SearchResultsList (features/search/components/)
    NotesList/PaginationControls                           ├── useSearchQuery({q, page}, {enabled})
                                                            ├── loading → SearchResultSkeleton × 3
                                                            ├── error → retry banner ("Search unavailable...")
                                                            ├── empty → EmptySearchState (🔍, query interpolated)
                                                            ├── aria-live="polite" region: "{N} results found"
                                                            ├── success → SearchResultItem × N (roving ↑/↓/Enter,
                                                            │     data-search-result, → SnippetHighlight)
                                                            └── PaginationControls (reused from features/notes)
```

State flow: `SearchBar`'s local input state is the only place raw keystrokes live. The URL (`/search?q=&page=`) is the single source of truth once a search is "committed" (post-debounce) — `SearchResultsPage` reads it via a small `useSearchResultsParams` hook (mirrors `useNotesListParams`'s pattern) and is the only consumer of `useSearchQuery`. `SearchBar` never reads live query results; it only writes the URL.

## 3. Files to Create

### `packages/shared`
**None.** `SearchQuery`, `SearchResult`, `SearchResponse`, `SearchQuerySchema`, `SEARCH_QUERY_MIN_LENGTH`, `SEARCH_QUERY_MAX_LENGTH`, `DEFAULT_PAGE_SIZE` all already exist from AB-1007.

### `apps/frontend/src/lib/`
| File | Purpose |
| ---- | ------- |
| `dom.ts` | `isTypingTarget(target: EventTarget \| null): boolean` — extracted verbatim from `DashboardPage.tsx` (currently a private local function there) so both `DashboardPage`'s `Ctrl+N` handler and `SearchBar`'s `Ctrl+K` handler share one implementation instead of duplicating it. |

### `apps/frontend/src/hooks/`
| File | Purpose |
| ---- | ------- |
| `useDebouncedValue.ts` | Generic `useDebouncedValue<T>(value: T, delayMs: number): T` — `setTimeout`/`clearTimeout` per-render-value, matching the debounce style already used ad hoc in `useAutosave.ts` but factored out for reuse (autosave's own timer stays as-is; it has different dirty-check semantics and is not migrated to this hook). |

### `apps/frontend/src/features/search/`
| File | Purpose |
| ---- | ------- |
| `search.constants.ts` | `SEARCH_DEBOUNCE_MS = 300` (canonical: FRS UX-SRCH-01), `SEARCH_RESULTS_SKELETON_COUNT = 3` (UX §11: "Search results: 3 shimmer skeleton cards"). |
| `search.types.ts` | Local `SearchListParams { q: string; page: number }` — UI-only shape (URL/query-key), not a data contract. |
| `search.api.ts` | `getSearchResults(params: SearchListParams): Promise<SearchResponse>` — thin `apiClient.request` wrapper: `GET /search?q=<q>&page=<page>&pageSize=<DEFAULT_PAGE_SIZE>`. |
| `search.hooks.ts` | `useSearchQuery(params: SearchListParams)` → `useQuery({queryKey: ['search', params], queryFn: () => getSearchResults(params), enabled: params.q.trim().length >= SEARCH_QUERY_MIN_LENGTH})`. |
| `useSearchResultsParams.ts` | Wraps `useSearchParams` (react-router), read-only-ish: `{params: {q, page}, setPage}`. `q` defaults to `''`, `page` defaults to `DEFAULT_PAGE`. `setPage` calls `setSearchParams(..., {replace: true})`, mirroring `useNotesListParams`. Used only by `SearchResultsPage` (not by `SearchBar`, which navigates imperatively — see Decision 2). |
| `utils/parseSnippet.ts` | `parseSnippet(snippet: string): Array<{ text: string; highlighted: boolean }>` — pure function implementing the `<mark>`/`</mark>` delimiter split from Decision 3, extracted from the component so it's directly unit-testable without rendering. |
| `components/SearchBar.tsx` | Described in Section 2. Renders `components/ui/input.tsx` with a `Search` icon (lucide-react), `type="search"`, `maxLength={SEARCH_QUERY_MAX_LENGTH}`, `aria-label="Search notes"`, placeholder `"Search notes... (Ctrl+K)"`. |
| `components/SnippetHighlight.tsx` | Consumes `parseSnippet`; renders `<mark className="rounded-sm bg-yellow-200 px-0.5 dark:bg-yellow-500/40">` for highlighted segments, plain text otherwise. |
| `components/SearchResultItem.tsx` | `<Link to={/notes/:id} data-search-result>` rendering `title` + `<SnippetHighlight snippet={result.snippet} />`, styled like `NoteCard` (border/card/hover/focus-visible ring) for visual consistency. |
| `components/SearchResultSkeleton.tsx` | Shimmer skeleton matching `SearchResultItem` dimensions (mirrors `NoteCardSkeleton`). |
| `components/EmptySearchState.tsx` | 🔍 icon, `No notes found for "{query}"`, "Try different keywords or check spelling" (UX §10/§8.9). |
| `components/SearchResultsList.tsx` | Consumes `useSearchQuery`; handles loading (`SearchResultSkeleton × 3`) / error (retry banner, text "Search unavailable. Please try again.") / empty (`EmptySearchState`) / success (`<ul>` of `SearchResultItem`s with roving `↑`/`↓`/`Enter` keyboard nav, same pattern as `NotesList.tsx`'s `handleKeyDown`, keyed off `[data-search-result]`); renders a visually-hidden `aria-live="polite"` region announcing `"{N} results found"` on every settled fetch (including 0). |

### `apps/frontend/src/pages/`
| File | Purpose |
| ---- | ------- |
| `SearchResultsPage.tsx` | `SkipLink` + `DashboardHeader` + `<main id="main-content">` containing `SearchResultsList` + `PaginationControls` (reused from `features/notes/components/PaginationControls.tsx` — its props (`pagination`, `onPageChange`) are already generic enough to not need duplication). Reads `{q, page}` via `useSearchResultsParams`. |

## 4. Files to Modify

| File | Change |
| ---- | ------ |
| `apps/frontend/src/components/layout/DashboardHeader.tsx` | Render `<SearchBar />` between the left group (menu/title) and the right group ("+ New Note"/`UserMenu`). No prop changes — `SearchBar` is fully self-contained (reads/writes its own state + the URL). |
| `apps/frontend/src/pages/DashboardPage.tsx` | Replace the local `isTypingTarget` function with an import from the new `src/lib/dom.ts` (no behavioral change to the existing `Ctrl+N` handler). |
| `apps/frontend/src/App.tsx` | Add `<Route path="/search" element={<ProtectedRoute><SearchResultsPage /></ProtectedRoute>} />`, matching the existing `/` and `/notes/:id` route shape. |

No changes to `packages/shared`, no changes to `apps/backend`, no new Prisma migrations — this ticket is entirely frontend, read-only consumption of `GET /api/search` (AB-1007, already merged).

## 5. TypeScript Interfaces (local, non-shared)

```typescript
// features/search/search.types.ts
export interface SearchListParams {
  q: string;
  page: number;
}
```

All request/response shapes reuse `@note-app/shared` types directly (`SearchQuery`, `SearchResult`, `SearchResponse`) — no duplication, per CON-003.

## 6. Data Fetching / Cache Keys

| Hook | Query Key | Enabled | Invalidated By |
| ---- | --------- | ------- | --------------- |
| `useSearchQuery({q, page})` | `['search', {q, page}]` | `q.trim().length >= 1` | Nothing — search results are never mutated by this ticket; no invalidation needed. |

No interaction with the existing `['notes', ...]` / `['tags', ...]` cache keys — `SearchResultItem`'s navigation to `/notes/:id` reuses `useNoteQuery`'s existing `['notes', 'detail', id]` key unchanged.

## 7. DB / Backend Impact

**None.** Read-only consumption of `GET /api/search` (AB-1007, already implemented and merged). No Prisma schema changes, no migrations, no changes to `apps/backend`.

## 8. Accessibility & Keyboard Checklist (to verify during implementation)

- `Ctrl+K` focuses + selects the search input from anywhere `DashboardHeader` is mounted (`/` and `/search`), ignored while focus is already inside a typing target (shared `isTypingTarget` guard).
- `Escape` while the search input is focused clears it and, if currently on `/search`, navigates to `/`.
- `ArrowDown` from the search input moves focus to the first `[data-search-result]`; `↑`/`↓`/`Enter` then rove within the results list (mirrors `NotesList.tsx`).
- The `aria-live="polite"` result-count region is visually hidden (`sr-only`) but always present and updated — not conditionally mounted, so screen readers reliably catch the update.
- `SearchResultItem` is a real `<Link>` (keyboard-focusable, `Enter`-activatable), never a `<div onClick>`.
- Search input has `aria-label="Search notes"` (no visible `<label>` in the compact header, per UX-SCR-009/UX-SCR-006's component list).
- `SnippetHighlight`'s `<mark>` usage is semantic highlighting, not a styling-only `<span>` — screen readers that announce emphasis get useful signal.

## 9. Test Plan

Mirrors `apps/frontend/tests/` structure (Vitest + React Testing Library for unit, Playwright for e2e), matching AB-1011's coverage patterns.

**Unit (`tests/unit/...`):**
- `hooks/useDebouncedValue.test.ts` — value updates only after the delay; rapid updates within the window collapse to one final value (`vi.useFakeTimers`).
- `lib/dom.test.ts` — `isTypingTarget` for input/textarea/contenteditable/plain elements.
- `features/search/utils/parseSnippet.test.ts` — plain text, single/multiple `<mark>` runs, and critically a snippet containing literal `<`/`>` characters outside any marker (proves the XSS-safety property from Decision 3).
- `features/search/search.api.test.ts` — `getSearchResults` calls `apiClient.request` with the expected `q`/`page`/`pageSize` query string.
- `features/search/search.hooks.test.tsx` — `useSearchQuery` `enabled` gating at `q=''`/whitespace-only vs. a real query.
- `features/search/useSearchResultsParams.test.tsx` — default `q`/`page`, `setPage` with `replace: true`.
- `features/search/components/SearchBar.test.tsx` — debounces before navigating; `Ctrl+K` focuses+selects; `Escape` clears and navigates home from `/search`; `ArrowDown` focuses the first result; input is capped at `SEARCH_QUERY_MAX_LENGTH`.
- `features/search/components/SnippetHighlight.test.tsx` — renders `<mark>` for highlighted segments and plain escaped text otherwise (complements the pure-function test above at the render level).
- `features/search/components/SearchResultsList.test.tsx` — loading/error+retry/empty/populated states, `aria-live` count announcement, roving arrow-key nav.
- `features/search/components/EmptySearchState.test.tsx` — renders the interpolated query as text.
- `pages/SearchResultsPage.test.tsx` — composition smoke test.
- `components/layout/DashboardHeader.test.tsx` — **new file** (none existed before); confirms `SearchBar` now renders alongside the existing header controls.

**E2E (`tests/e2e/`):** extend with a `search.spec.ts` covering the golden path from UX §7.7 — log in, create a note via existing fixtures/API, `Ctrl+K` to focus search, type a matching term, see highlighted results, click through to the note, and `Escape` back to the Dashboard.

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

## 11. Out-of-Scope Reminders Carried Forward from spec.md

- No tag-filter control on `/search` — `tagIds` is never sent by this ticket's UI (backend supports it, AB-1007 Scenario 6; no UX-SCR-009 component calls for it).
- No changes to `GET /api/search`, ranking, or highlighting logic — AB-1007 is done; this ticket only renders what it already returns.

---

Not proceeding to implementation — awaiting approval.
