# AB-1012 — Frontend Note Editor with TipTap + Autosave: Implementation Plan

## 1. Resolved Decisions (spec Open Questions 1–6, plus routing architecture)

| # | Question (from spec.md) | Decision |
| - | ------------------------ | -------- |
| 1 | URL transition mechanics on first save (Scenario 5) | **Collapse `/notes/new` and `/notes/:id` into a single route** — `<Route path="/notes/:id" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />` in `App.tsx`. `"new"` is a reserved literal id (never collides with a real UUID). Because both flows match the *same* `<Route>` entry, React Router does not unmount/remount `EditorPage` when `navigate(`/notes/${newId}`, { replace: true })` runs after the first `POST` resolves — only `useParams().id` changes on re-render. `NoteEditor`'s `useEditor()` instance must **not** be keyed by `id` (no `key={id}` anywhere in the tree), so the live TipTap document, cursor position, and undo stack survive the URL swap untouched. This is safer than remounting-and-reproving-from-cache, since remounting would drop cursor/selection state if the user resumes typing right as the create call resolves. |
| 2 | Title max-length enforcement (Scenario 13) | **Client-side `maxLength={255}` on the title `<input>`** (matches `NOTE_TITLE_MAX_LENGTH` from `@note-app/shared`) — simplest option, prevents the issue entirely, consistent with AB-1011's precedent of picking the simplest sufficient option. No separate validation-error UI needed for title length. |
| 3 | Link insertion UI (Scenario 17) | **`LinkPopover`** built on `@radix-ui/react-popover` (already a pinned dependency, unused until now — requires a new `components/ui/popover.tsx` wrapper). Triggered by the toolbar Link button or `Ctrl+K`: a small popover with a URL `Input` + "Apply"/"Remove link" actions, anchored to the current selection. No new library added (CON-001). |
| 4 | Duplicate tag name on inline creation (Scenario 21) | **Silently reuse the existing tag.** On `409 TAG_NAME_EXISTS` from `POST /api/tags`, look up the tag by case-insensitive name match in the already-fetched `['tags','list']` query cache (populated by `useTagsQuery`, which the tag bar consumes regardless) and attach its `id` to the note. No error surfaced to the user — from their perspective "creating" a tag that already exists just attaches it, which is the least surprising behavior. |
| 5 | Autosave hook shape | **Single reusable `useAutosave` hook** (`features/notes/useAutosave.ts`) encapsulating: dirty-check, 2s debounce, create-vs-update branching (per Decision 1), force-save (`Ctrl+S` cancels the pending timer and saves immediately), save-status state machine (`idle \| saving \| saved \| error`), and syncing `useUIStore.editorDirty` for the `beforeunload` guard. `EditorPage`/`NoteEditor` call it once; no logic duplicated across components. |
| 6 | `ActionHeader` reuse across AB-1012/1014/1015 | **Optional-handler props, not a children/slot API.** `ActionHeader` accepts `onShare?: () => void` and `onHistory?: () => void`. When a handler is `undefined` (this ticket), the corresponding "More" menu item renders `disabled`/`aria-disabled="true"` (reusing `DropdownMenuItem`'s existing `data-[disabled]` styling from AB-1011). AB-1014/AB-1015 pass real handlers as props later without touching `ActionHeader`'s internals — mirrors the existing `NoteCard`'s `onRestore?` prop pattern. |
| — | Undo window timing (Scenario 26–27) | **No new timer needed.** `components/ui/use-toast.ts`'s `TOAST_DURATION_MS` is already a fixed `5000`ms — exactly UX-NOTE-04's 5-second Undo window. The toast (and its Undo button) simply disappear via the existing auto-dismiss; Scenario 27 requires no extra code. |
| — | In-app "back" navigation vs. `beforeunload` (spec §7 was silent on this) | **Only the native `beforeunload` guard is implemented** (UX-NOTE-06 as written). Clicking the in-app "←" back button does **not** get a custom confirmation — react-router's in-SPA navigation doesn't fire `beforeunload`, and adding a bespoke nav-blocker (e.g. `unstable_useBlocker`) is not called for by FRS/UX and would be scope creep. Flagged here for visibility, not treated as a gap to fix. |

## 2. Architecture Overview

```
EditorPage (apps/frontend/src/pages/EditorPage.tsx)
├── useParams<{id: string}>()  →  isNew = id === 'new'
├── useNoteQuery(id, { enabled: !isNew })       — ['notes','detail', id]
├── useAutosave({ id, isNew, title, content, tagIds })
│   ├── useCreateNoteMutation()  — first save on a new note
│   ├── useUpdateNoteMutation()  — every subsequent save
│   └── syncs useUIStore.editorDirty (beforeunload guard)
│
├── (loading, !isNew)   → EditorSkeleton
├── (404, !isNew)       → NoteNotFoundState
└── (loaded / isNew)
    ├── ActionHeader                              — back button, title Input, AutosaveStatusIndicator, "More" DropdownMenu (Share/History disabled, "Move to trash" → opens dialog)
    │   └── DeleteNoteDialog (Dialog primitive)    — useDeleteNoteMutation + reuses AB-1011's useRestoreNoteMutation for Undo
    ├── TagBar                                    — useTagsQuery (existing) + TagCombobox (add existing / inline-create) + useCreateTagMutation
    └── NoteEditor                                — useEditor(tiptap-extensions.ts), never remounted/keyed by id
        └── TipTapToolbar                          — formatting buttons, aria-pressed, LinkPopover
```

Global keydown handler (in `EditorPage`, mirroring `DashboardPage`'s `Ctrl+N` pattern): `Ctrl+S` → force save via `useAutosave`'s `forceSave()`. TipTap's own keyboard shortcuts (`Ctrl+B`/`Ctrl+I`/etc.) are handled internally by the configured extensions (StarterKit already binds most of these); `Ctrl+K` and the two code shortcuts are wired explicitly since they open `LinkPopover` / aren't default StarterKit bindings for this exact combo.

## 3. Files to Create

### `packages/shared`
**None.** All required schemas/types (`CreateNoteRequest`, `UpdateNoteRequest`, `NoteResponse`, `DeleteNoteResponse`, `RestoreNoteResponse`, `CreateTagRequest`, `TagResponse`, `NOTE_TITLE_MAX_LENGTH`, `NOTE_CONTENT_MAX_SIZE_BYTES`) already exist from AB-1004/AB-1006.

### `apps/frontend/src/components/ui/` (new shared primitives — none exist yet)
| File | Purpose |
| ---- | ------- |
| `dialog.tsx` | Shadcn-style wrapper over `@radix-ui/react-dialog` (pinned dep, unused until now): `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`. Used by `DeleteNoteDialog` here; reusable by AB-1014's Share modal. |
| `popover.tsx` | Shadcn-style wrapper over `@radix-ui/react-popover` (pinned dep, unused until now): `Popover`, `PopoverTrigger`, `PopoverContent`. Used by `LinkPopover` and `TagCombobox`. |

### `apps/frontend/src/features/notes/`
| File | Purpose |
| ---- | ------- |
| `tiptap-extensions.ts` | Centralized extension list matching SDS §23.1 exactly: `StarterKit`, `Placeholder`, `Typography`, `Highlight`, `Link` (configured `openOnClick: false`, validated `href`), `CodeBlockLowlight` (via `lowlight`, common-languages bundle), `TaskList`/`TaskItem`, `Underline`, `TextAlign` (left/center/right), `CharacterCount`. Exported as a single `buildEditorExtensions()` so `NoteEditor` and its tests share one source of truth (no substitutions — CON-001). |
| `useAutosave.ts` | The hook from Decision 5: debounce (`NOTE_AUTOSAVE_DEBOUNCE_MS`), dirty check (shallow-compares last-saved `{title, content, tagIds}` snapshot), create-then-update branching, `forceSave()` for `Ctrl+S`, client-side content-size pre-check (`new Blob([content]).size > NOTE_CONTENT_MAX_SIZE_BYTES` short-circuits to an error state without a network round-trip), returns `{status: 'idle'\|'saving'\|'saved'\|'error', forceSave}`. |
| `notes.constants.ts` (extend) | Add `NOTE_AUTOSAVE_DEBOUNCE_MS = 2000` (SDS §23.3) alongside the existing `NOTE_PREVIEW_LENGTH`. |
| `notes.types.ts` (extend) | Add `SaveStatus = 'idle' \| 'saving' \| 'saved' \| 'error'` and `EditorDraft { title: string; content: string; tagIds: string[] }` (local working-state shape, not a request/response contract). |
| `notes.api.ts` (extend) | Add `getNote(id)`, `createNote(input: CreateNoteRequest)`, `updateNote(id, input: UpdateNoteRequest)`, `deleteNote(id)` — thin `apiClient.request` wrappers alongside the existing `getNotes`/`restoreNote`. |
| `notes.hooks.ts` (extend) | Add `useNoteQuery(id, {enabled})` (`['notes','detail', id]`), `useCreateNoteMutation()` (`onSuccess`: `setQueryData(['notes','detail', note.id], {note})`, invalidate `['notes','list']` + `['tags','list']`), `useUpdateNoteMutation()` (same cache effects, keyed on existing `id`), `useDeleteNoteMutation()` (invalidate `['notes','list']` + `['tags','list']`). |
| `components/NoteEditor.tsx` | Hosts `useEditor(buildEditorExtensions())`; controlled by `content` only on first mount (TipTap semantics — later prop changes are ignored by design, which is what keeps Decision 1 safe); calls `onContentChange(html)` via `onUpdate`. Renders `TipTapToolbar` + the `EditorContent` body with `Placeholder` "Start writing...". |
| `components/TipTapToolbar.tsx` | Sticky (desktop) / horizontally-scrollable (tablet/mobile) toolbar: bold/italic/underline/strike/highlight/link/bullet-list/ordered-list/task-list/blockquote/inline-code/code-block/text-align buttons, each `aria-label` + `aria-pressed={editor.isActive(...)}` (UX §8.7 Accessibility Notes). Renders `LinkPopover` for the Link button. Binds the non-StarterKit keyboard shortcuts (`Ctrl+K`, `Ctrl+Shift+H`, `Ctrl+Shift+E`) via TipTap's `addKeyboardShortcuts` on mount. |
| `components/LinkPopover.tsx` | `Popover` with a URL `Input` + "Apply"/"Remove link" buttons; calls `editor.chain().focus().extendMarkRange('link').setLink({href}).run()` / `.unsetLink()`. |
| `components/AutosaveStatusIndicator.tsx` | Renders "Saving..." / "Saved ✓" / red "Save failed" based on `SaveStatus`, `aria-live="polite"`. |
| `components/TagBar.tsx` | Renders current tags as removable `Badge` chips (× control calls back up to remove from `tagIds`) + `TagCombobox` trigger for add/create. Handles zero-tags case (Scenario 22) — only the "Add tag" affordance shows. |
| `components/TagCombobox.tsx` | `Popover` containing a filterable list of `useTagsQuery()` results (excluding already-attached tags) + a "Create '<typed name>'" row when no exact match exists; wires to `useCreateTagMutation` for inline creation (Decision 4 handles the 409 case internally). |
| `components/DeleteNoteDialog.tsx` | `Dialog` wrapping the confirmation per UX §8.8: initial focus on "Cancel" (Radix `Dialog` default — first focusable element inside `DialogContent`, so "Cancel" must be the first rendered button), destructive "Move to trash" button with `isLoading` from `useDeleteNoteMutation`, `Escape`/Cancel closes without action, `Enter`/click-confirm calls `deleteNote` then navigates to `/` and fires the toast+Undo (reusing AB-1011's `useRestoreNoteMutation`). |
| `components/ActionHeader.tsx` | Back button (`← ` → `navigate('/')`), title `Input` (`maxLength=255`, placeholder "Untitled"), `AutosaveStatusIndicator`, "More" `DropdownMenu` (reusing AB-1011's primitive) with Share/History (disabled unless `onShare`/`onHistory` props are passed — Decision 6) and "Move to trash" (opens `DeleteNoteDialog`). |
| `components/EditorSkeleton.tsx` | Skeleton title bar + skeleton editor body (UX §8.7 Loading States), matching `NoteCardSkeleton`'s existing shimmer pattern. |
| `components/NoteNotFoundState.tsx` | "Note not found" message + button back to Dashboard (Scenario 3 / UX §7.5) — distinct from a retryable-error banner since a 404 here is never retryable. |

### `apps/frontend/src/features/tags/`
| File | Purpose |
| ---- | ------- |
| `tags.api.ts` (extend) | Add `createTag(input: CreateTagRequest): Promise<{tag: TagResponse}>`. |
| `tags.hooks.ts` (extend) | Add `useCreateTagMutation()` — on `409 TAG_NAME_EXISTS`, resolves the existing tag from the `['tags','list']` cache by case-insensitive name match instead of surfacing an error (Decision 4); on success, invalidates `['tags','list']`. |

## 4. Files to Modify

| File | Change |
| ---- | ------ |
| `apps/frontend/src/App.tsx` | Replace the two separate `/notes/new` and `/notes/:id` `<Route>` entries with **one** `<Route path="/notes/:id" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />` (Decision 1). No other routes change. |
| `apps/frontend/src/pages/EditorPage.tsx` | Full rewrite replacing the placeholder: reads `id` via `useParams`, derives `isNew`, composes `ActionHeader` + `TagBar` + `NoteEditor` behind the loading/404/loaded branches from §2's architecture diagram, owns the single `useAutosave(...)` instance, registers the `Ctrl+S` keydown handler. |

No changes to `packages/shared`, no changes to `apps/backend`, no new Prisma migrations, no change to `NoteCard.tsx` / `DashboardHeader.tsx` (both already link/navigate to the correct paths and are unaffected by the route merge).

## 5. TypeScript Interfaces (local, non-shared)

```typescript
// features/notes/notes.types.ts (additions)
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorDraft {
  title: string;
  content: string;
  tagIds: string[];
}
```

All request/response shapes reuse `@note-app/shared` types directly (`CreateNoteRequest`, `UpdateNoteRequest`, `NoteResponse`, `DeleteNoteResponse`, `RestoreNoteResponse`, `CreateTagRequest`, `TagResponse`) — no duplication, per CON-003.

## 6. Data Fetching / Cache Keys (SDS §22)

| Hook | Query Key | Effect |
| ---- | --------- | ------ |
| `useNoteQuery(id)` | `['notes', 'detail', id]` | `enabled: !isNew`; primed via `setQueryData` by the create mutation so the URL swap (Decision 1) never triggers a refetch/flicker. |
| `useCreateNoteMutation()` | — (mutation) | `onSuccess`: `setQueryData(['notes','detail', note.id], {note})`; invalidate `['notes','list']`, `['tags','list']`. |
| `useUpdateNoteMutation()` | — (mutation) | `onSuccess`: `setQueryData(['notes','detail', id], {note})`; invalidate `['notes','list']`, `['tags','list']`. |
| `useDeleteNoteMutation()` | — (mutation) | `onSuccess`: invalidate `['notes','list']`, `['tags','list']`. |
| `useCreateTagMutation()` | — (mutation) | `onSuccess`/409-resolved: invalidate `['tags','list']`. |

`useRestoreNoteMutation` (AB-1011, unchanged) is reused as-is for the Undo action in `DeleteNoteDialog`.

## 7. DB / Backend Impact

**None.** Consumes `GET/POST/PATCH/DELETE /api/notes(/:id)`, `POST /api/notes/:id/restore`, `GET/POST /api/tags` — all already implemented and merged (AB-1004/AB-1006/AB-1009... restore reused from AB-1011). No Prisma schema changes, no migrations.

## 8. Accessibility & Keyboard Checklist (to verify during implementation)

- Title input, tag combobox trigger, and every toolbar button are real focusable elements with `aria-label`s — never `<div onClick>`.
- Toolbar buttons expose `aria-pressed={editor.isActive(...)}` per UX §8.7.
- `AutosaveStatusIndicator` uses `aria-live="polite"` so status changes are announced without stealing focus.
- `DeleteNoteDialog`: `role="dialog"` (Radix default), focus trapped, initial focus on "Cancel", focus restored to the "More" menu trigger on close (SDS §15.4 Rules 1–2).
- `LinkPopover`/`TagCombobox`: opening moves focus to the first interactive element inside; closing (Escape or outside-click) restores focus to the trigger (SDS §15.4 Rule 1–2, same as the delete dialog).
- All keyboard shortcuts in SDS §15.2 are bound and don't fire while focus is genuinely inside the title `<input>` in a way that would break native text-editing (e.g. native browser shortcuts still work in the title field; the note-level shortcuts are scoped to when the TipTap editor itself has focus, except `Ctrl+S` which is global within the editor page).
- Skip link / landmark structure from AB-1011 (`<main id="main-content">`) is preserved — `EditorPage` renders inside the existing app shell conventions.

## 9. Test Plan

Mirrors `apps/frontend/tests/` structure (Vitest + React Testing Library, Playwright e2e), matching AB-1011's coverage patterns.

**Unit (`tests/unit/...`):**
- `features/notes/tiptap-extensions.test.ts` — asserts the exact extension list (guards against silent substitution/drift from SDS §23.1).
- `features/notes/useAutosave.test.ts` — debounce timing (fake timers), dirty-check no-op, create→update transition, force-save cancels pending timer, content-size pre-check short-circuits without calling the API, error state on rejected mutation.
- `features/notes/notes.api.test.ts` (extend) — `getNote`/`createNote`/`updateNote`/`deleteNote` call `apiClient.request` with expected path/method/body.
- `features/notes/notes.hooks.test.tsx` — cache priming/invalidation for create/update/delete mutations.
- `features/notes/components/NoteEditor.test.tsx`, `TipTapToolbar.test.tsx` (button → command mapping + `aria-pressed`), `LinkPopover.test.tsx`, `AutosaveStatusIndicator.test.tsx`, `TagBar.test.tsx` (add/remove/zero-tags), `TagCombobox.test.tsx` (existing-tag select, inline create, 409-reuse path), `DeleteNoteDialog.test.tsx` (initial focus on Cancel, Escape, confirm→navigate+toast, API failure path), `ActionHeader.test.tsx` (disabled Share/History when handlers absent), `EditorSkeleton.test.tsx`, `NoteNotFoundState.test.tsx`.
- `features/tags/tags.api.test.ts` (extend), `features/tags/tags.hooks.test.tsx` (extend — 409 dedupe path).
- `pages/EditorPage.test.tsx` — new-note flow (Scenario 4–6, asserting no remount via a stable TipTap instance mock), existing-note load, 404 state, `Ctrl+S` force save, `beforeunload` guard wiring (`editorDirty` set/cleared).
- `App.test.tsx` (if one exists, else inline in `EditorPage.test.tsx`) — confirms `/notes/new` and `/notes/:id` both resolve to `EditorPage` via the single merged route.

**E2E (`tests/e2e/`):** new `editor.spec.ts` — golden path: click "+ New Note" → type title/content → wait for autosave → reload and confirm persisted → add an existing tag → inline-create a new tag → delete the note → click Undo → confirm it's back in the Dashboard list.

**Coverage target:** ≥80% on all new code per root `CLAUDE.md` quality gates.

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

---

Not proceeding to implementation — awaiting approval.
