# AB-1012 — Frontend Note Editor with TipTap + Autosave: Task Checklist

Source: `openspec/tickets/AB-1012/spec.md`, `openspec/tickets/AB-1012/plan.md`.
No backend/DB/shared-package work is required — all consumed endpoints and types
already exist (AB-1004/AB-1006/AB-1009/AB-1011). Phase 1 below is UI-primitive and
local-scaffolding setup, not shared-types/migrations.

---

## Phase 1 — Foundation (shared UI primitives, local types/constants, scaffolding)

- [ ] 1.1 Create `apps/frontend/src/components/ui/dialog.tsx` (shadcn-style wrapper over `@radix-ui/react-dialog`: `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`).
- [ ] 1.2 Create `apps/frontend/src/components/ui/popover.tsx` (shadcn-style wrapper over `@radix-ui/react-popover`: `Popover`, `PopoverTrigger`, `PopoverContent`).
- [ ] 1.3 Create `apps/frontend/src/features/notes/tiptap-extensions.ts` (`buildEditorExtensions()` — exact SDS §23.1 list: StarterKit, Placeholder, Typography, Highlight, Link, CodeBlockLowlight + lowlight common bundle, TaskList/TaskItem, Underline, TextAlign, CharacterCount).
- [ ] 1.4 Extend `apps/frontend/src/features/notes/notes.constants.ts` — add `NOTE_AUTOSAVE_DEBOUNCE_MS = 2000`.
- [ ] 1.5 Extend `apps/frontend/src/features/notes/notes.types.ts` — add `SaveStatus` union and `EditorDraft` interface (plan.md §5).

**Checkpoint 1:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 2 — Core Implementation (data layer: API wrappers + query hooks + autosave hook)

- [ ] 2.1 Extend `apps/frontend/src/features/notes/notes.api.ts` — `getNote(id)`, `createNote(input)`, `updateNote(id, input)`, `deleteNote(id)`.
- [ ] 2.2 Extend `apps/frontend/src/features/notes/notes.hooks.ts` — `useNoteQuery(id, {enabled})` (`['notes','detail',id]`), `useCreateNoteMutation()`, `useUpdateNoteMutation()`, `useDeleteNoteMutation()`; all with the cache-priming/invalidation effects from plan.md §6.
- [ ] 2.3 Extend `apps/frontend/src/features/tags/tags.api.ts` — `createTag(input)`.
- [ ] 2.4 Extend `apps/frontend/src/features/tags/tags.hooks.ts` — `useCreateTagMutation()` with the 409 `TAG_NAME_EXISTS` silent-reuse path (plan.md Decision 4).
- [ ] 2.5 Create `apps/frontend/src/features/notes/useAutosave.ts` — debounce, dirty-check, create-then-update branching (plan.md Decision 1), `forceSave()`, client-side content-size pre-check against `NOTE_CONTENT_MAX_SIZE_BYTES`, `SaveStatus` state machine, syncs `useUIStore.editorDirty`.

**Checkpoint 2:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 3 — Integration & UI Components

### Notes feature components
- [ ] 3.1 `features/notes/components/EditorSkeleton.tsx`
- [ ] 3.2 `features/notes/components/NoteNotFoundState.tsx`
- [ ] 3.3 `features/notes/components/AutosaveStatusIndicator.tsx` (Saving/Saved/Save failed, `aria-live="polite"`)
- [ ] 3.4 `features/notes/components/LinkPopover.tsx` (uses `components/ui/popover.tsx`)
- [ ] 3.5 `features/notes/components/TipTapToolbar.tsx` (formatting buttons, `aria-pressed`, non-StarterKit shortcut bindings, embeds `LinkPopover`)
- [ ] 3.6 `features/notes/components/NoteEditor.tsx` (hosts `useEditor(buildEditorExtensions())`, renders `TipTapToolbar` + `EditorContent`; **not** keyed by note id — plan.md Decision 1)
- [ ] 3.7 `features/notes/components/TagCombobox.tsx` (uses `components/ui/popover.tsx`; existing-tag select + inline create via `useCreateTagMutation`)
- [ ] 3.8 `features/notes/components/TagBar.tsx` (removable tag chips + `TagCombobox`; zero-tags case)
- [ ] 3.9 `features/notes/components/DeleteNoteDialog.tsx` (uses `components/ui/dialog.tsx`; initial focus "Cancel"; confirm → `useDeleteNoteMutation` → navigate `/` → toast with Undo via AB-1011's `useRestoreNoteMutation`)
- [ ] 3.10 `features/notes/components/ActionHeader.tsx` (back button, title `Input` `maxLength=255`, `AutosaveStatusIndicator`, "More" `DropdownMenu` with Share/History disabled unless handler props passed, "Move to trash" opens `DeleteNoteDialog`)

### Page composition & routing
- [ ] 3.11 Modify `apps/frontend/src/App.tsx` — collapse `/notes/new` + `/notes/:id` into the single `<Route path="/notes/:id">` (plan.md Decision 1).
- [ ] 3.12 Rewrite `apps/frontend/src/pages/EditorPage.tsx` — `useParams` → `isNew`; compose loading/404/loaded branches per plan.md §2 architecture diagram; own the single `useAutosave(...)` instance; register `Ctrl+S` keydown handler.

**Checkpoint 3:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```
Manual smoke check: `pnpm dev` (backend + frontend), log in, click "+ New Note", type a title/content, confirm autosave fires and the URL updates to `/notes/:id` without losing cursor focus, add/remove/inline-create tags, use toolbar formatting + keyboard shortcuts, delete a note and click Undo, confirm `beforeunload` warns when navigating away with unsaved edits.

---

## Phase 4 — Tests (unit, integration, E2E)

### Unit — data layer
- [ ] 4.1 `tests/unit/features/notes/tiptap-extensions.test.ts`
- [ ] 4.2 `tests/unit/features/notes/useAutosave.test.ts` (fake timers: debounce, dirty-check no-op, create→update transition, force-save, content-size short-circuit, error state)
- [ ] 4.3 `tests/unit/features/notes/notes.api.test.ts` (extend — `getNote`/`createNote`/`updateNote`/`deleteNote`)
- [ ] 4.4 `tests/unit/features/notes/notes.hooks.test.tsx` (cache priming/invalidation for all four mutations/query)
- [ ] 4.5 `tests/unit/features/tags/tags.api.test.ts` (extend — `createTag`)
- [ ] 4.6 `tests/unit/features/tags/tags.hooks.test.tsx` (extend — 409 dedupe path)

### Unit — components
- [ ] 4.7 `tests/unit/features/notes/components/NoteEditor.test.tsx`
- [ ] 4.8 `tests/unit/features/notes/components/TipTapToolbar.test.tsx` (button → command mapping, `aria-pressed`)
- [ ] 4.9 `tests/unit/features/notes/components/LinkPopover.test.tsx`
- [ ] 4.10 `tests/unit/features/notes/components/AutosaveStatusIndicator.test.tsx`
- [ ] 4.11 `tests/unit/features/notes/components/TagBar.test.tsx` (add/remove/zero-tags)
- [ ] 4.12 `tests/unit/features/notes/components/TagCombobox.test.tsx` (existing-tag select, inline create, 409-reuse path)
- [ ] 4.13 `tests/unit/features/notes/components/DeleteNoteDialog.test.tsx` (initial focus Cancel, Escape, confirm→navigate+toast, API failure)
- [ ] 4.14 `tests/unit/features/notes/components/ActionHeader.test.tsx` (disabled Share/History when handlers absent)
- [ ] 4.15 `tests/unit/features/notes/components/EditorSkeleton.test.tsx`
- [ ] 4.16 `tests/unit/features/notes/components/NoteNotFoundState.test.tsx`
- [ ] 4.17 `tests/unit/pages/EditorPage.test.tsx` (new-note flow incl. no-remount assertion, existing-note load, 404 state, `Ctrl+S`, `beforeunload`/`editorDirty` wiring)

### E2E
- [ ] 4.18 `tests/e2e/editor.spec.ts` — golden path: "+ New Note" → type title/content → autosave → reload confirms persisted → add existing tag → inline-create new tag → delete note → Undo → back in Dashboard list.

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
