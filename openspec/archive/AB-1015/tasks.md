# AB-1015 — Frontend Version History Drawer + Restore: Task Checklist

Source: `openspec/tickets/AB-1015/spec.md`, `openspec/tickets/AB-1015/plan.md`.
No backend/DB/shared-package work is required — all three version endpoints and their types
(`VersionListItem`, `ListVersionsResponse`, `VersionDetail`, `GetVersionResponse`,
`RestoreVersionResponse`, `VersionNumberParam`) already exist and are merged (AB-1009). Phase 1
below is therefore the foundational, cross-cutting building blocks (imperative editor ref, autosave
escape hatch, `Drawer` primitive) that every later phase depends on — not shared-types/migrations.

---

## Phase 1 — Foundation (imperative editor ref, autosave escape hatch, Drawer primitive)

- [ ] 1.1 Modify `apps/frontend/src/features/notes/components/NoteEditor.tsx` — convert to `forwardRef<NoteEditorHandle, NoteEditorProps>`; add `export interface NoteEditorHandle { setContent: (html: string) => void }`; add `useImperativeHandle(ref, () => ({ setContent: (html) => editor?.commands.setContent(html) }), [editor])` (plan Decision 1). `initialContent`/`onContentChange`/the `[]` deps array on `useEditor` stay unchanged.
- [ ] 1.2 Modify `apps/frontend/src/features/notes/useAutosave.ts` — add `syncBaseline: (next: EditorDraft) => void` to `UseAutosaveResult` and the returned object, implemented as `useCallback((next) => { lastSavedRef.current = next; }, [])` (plan Decision 1). No other logic in this file changes.
- [ ] 1.3 Create `apps/frontend/src/components/ui/drawer.tsx` — `Drawer`/`DrawerTrigger`/`DrawerPortal`/`DrawerClose`/`DrawerOverlay`/`DrawerContent`, right-anchored `@radix-ui/react-dialog` variant (plan Decision 4). `DrawerContent` renders `DialogPrimitive.Content asChild` wrapping a real `<aside>`, classed `fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-card p-6 shadow-lg sm:w-[400px]` with `duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right`; forwards `onCloseAutoFocus` like `DialogContent` does.

**Checkpoint 1:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```
Note: `apps/frontend/tests/unit/pages/EditorPage.test.tsx`'s existing `vi.mocked(useAutosave).mockReturnValue({status, forceSave: ...})` call sites will fail to typecheck after 1.2 until `syncBaseline: vi.fn()` is added to each — fix these now so Checkpoint 1 is actually green (don't defer to Phase 4).

---

## Phase 2 — Core Implementation (data layer: API wrappers + query/mutation hooks)

- [ ] 2.1 Create `apps/frontend/src/features/versions/versions.api.ts` — `getVersions(noteId)` (`GET /notes/:id/versions`), `getVersion(noteId, versionNumber)` (`GET /notes/:id/versions/:versionNumber`), `restoreVersion(noteId, versionNumber)` (`POST /notes/:id/versions/:versionNumber/restore`) — thin `apiClient.request` wrappers mirroring `share.api.ts`.
- [ ] 2.2 Create `apps/frontend/src/features/versions/versions.hooks.ts`:
  - `useVersionsQuery(noteId, options?: { enabled?: boolean })` → `['versions', 'list', noteId]`.
  - `useVersionQuery(noteId, versionNumber: number | undefined)` → `['versions', 'detail', noteId, versionNumber]`, `enabled: versionNumber !== undefined`.
  - `useRestoreVersionMutation(noteId)` → `onSuccess` writes `['notes','detail',noteId]` via `setQueryData`, invalidates `['notes','list']` + `['versions','list',noteId]`; `onError` shows `toast({ description: 'Failed to restore version. Please try again.', variant: 'destructive' })`.

**Checkpoint 2:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 3 — Integration & UI Components

### Version feature components
- [ ] 3.1 `features/versions/components/VersionListSkeleton.tsx` — 3–4 stacked `Skeleton` rows (`components/ui/skeleton.tsx`), matching `NoteCardSkeleton`'s shimmer-stack convention.
- [ ] 3.2 `features/versions/components/VersionItem.tsx` — one `<button>` row: version number, `formatUpdatedAt(createdAt)` (reused from `features/notes/notes.utils.ts`), `truncate`-classed `contentPreview` (plan Decision 5 — render verbatim, truncate only visually). Props: `version: VersionListItem`, `onSelect: (versionNumber: number) => void`.
- [ ] 3.3 `features/versions/components/VersionList.tsx` — renders ordered `VersionItem` rows from `versions: VersionListItem[]`, or `VersionListSkeleton` while loading.
- [ ] 3.4 `features/versions/components/VersionPreviewBanner.tsx` — yellow banner "Viewing version {N} from {date}" (UX §8.12 Success States). Props: `versionNumber: number`, `createdAt: string`.
- [ ] 3.5 `features/versions/components/VersionContent.tsx` — read-only TipTap (`useEditor({ extensions: buildEditorExtensions(), content, editable: false }, [content])`, no toolbar, plan Decision 2 — structurally mirrors `features/share/components/SharedNoteContent.tsx` but kept local to `features/versions/`).
- [ ] 3.6 `features/versions/components/VersionHistoryDrawer.tsx` — `Drawer`/`DrawerContent` (400px desktop/tablet, full-screen mobile via `sm:w-[400px]` default + full-width base class, 300ms slide-in from the right); local `selectedVersionNumber: number | undefined` state; branches on `useVersionsQuery` (loading → `VersionListSkeleton`, error → toast "Unable to load version history.", success → `VersionList`) and, once a version is selected, `useVersionQuery` (loading → preview spinner, error → toast "Unable to load that version." + stay on list, success → `VersionPreviewBanner` + `VersionContent` + "Back to current" + "Restore this version"); `useRestoreVersionMutation` wired to the restore button (`isLoading` spinner while in flight; success → `onRestored(note)` + toast "Version {N} restored." + `onOpenChange(false)` per plan Decision 3; error → destructive toast, stays on the preview). Props: `noteId`, `open`, `onOpenChange`, `returnFocusRef`, `onRestored: (note: NoteResponse) => void`.

### Page composition
- [ ] 3.7 Modify `apps/frontend/src/pages/EditorPage.tsx` — add `noteEditorRef = useRef<NoteEditorHandle>(null)`, pass to `<NoteEditor ref={noteEditorRef} .../>`; add `historyDrawerOpen` state; pass `onHistory={isNew ? undefined : () => setHistoryDrawerOpen(true)}` to `ActionHeader` (its existing `onHistory?: () => void` contract from AB-1012 is unchanged); destructure `syncBaseline` from `useAutosave(...)`; add `handleRestored(note)` (`setDraft` title/content, `syncBaseline({...draft, title: note.title, content: note.content})`, `noteEditorRef.current?.setContent(note.content)`); render `<VersionHistoryDrawer noteId={id} open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen} returnFocusRef={moreMenuTriggerRef} onRestored={handleRestored} />` guarded by `{!isNew && (...)}`, next to the existing `ShareModal`.

No changes needed to `ActionHeader.tsx` — its `onHistory` prop and `moreMenuTriggerRef` exposure already exist from AB-1012/AB-1014. No changes to `App.tsx`, `apps/backend`, or `packages/shared`.

**Checkpoint 3:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```
Manual smoke check: `pnpm dev` (backend + frontend). Open an existing note, edit it a couple of times so it accumulates 3+ versions, then click "More actions" → "History" — confirm the drawer slides in from the right showing versions newest-first with previews. Click an older version, confirm the yellow "Viewing version N from {date}" banner and its read-only content appear, and confirm no autosave/"Saving…" indicator fires while previewing. Click "Restore this version", confirm the toast "Version N restored.", the drawer closes, and the editor's visible content now matches the restored version. Reopen the drawer and confirm a new version now sits at the top and all prior versions are still listed. Confirm `Escape` closes the drawer and returns focus to the "More actions" button. Shrink the viewport to mobile width and confirm the drawer becomes full-screen. Confirm "History" is disabled while composing a brand-new, unsaved note.

---

## Phase 4 — Tests (unit)

### Unit — foundation (Phase 1 additions)
- [ ] 4.1 `tests/unit/features/notes/components/NoteEditor.test.tsx` (extended) — a ref's `setContent(html)` updates the rendered TipTap document without remounting the editor or disturbing `onContentChange`'s wiring.
- [ ] 4.2 `tests/unit/features/notes/useAutosave.test.ts` (extended) — after calling `syncBaseline(next)`, the dirty-check effect does not arm a `performSave` timeout even though `draft` differs from the *original* baseline.

### Unit — data layer
- [ ] 4.3 `tests/unit/features/versions/versions.api.test.ts` — all three wrappers call `apiClient.request` with the expected path/method.
- [ ] 4.4 `tests/unit/features/versions/versions.hooks.test.tsx` — query keys/`enabled` gating for both queries; `useRestoreVersionMutation` writes `['notes','detail',noteId]`, invalidates `['notes','list']` + `['versions','list',noteId]` on success, and toasts on error.

### Unit — components
- [ ] 4.5 `tests/unit/features/versions/components/VersionItem.test.tsx` — renders version number/date/preview; `onSelect` fires with the correct `versionNumber` on click.
- [ ] 4.6 `tests/unit/features/versions/components/VersionList.test.tsx` — rows render newest-first (Scenario 3); shows `VersionListSkeleton` while loading (Scenario 4).
- [ ] 4.7 `tests/unit/features/versions/components/VersionPreviewBanner.test.tsx` — renders "Viewing version {N} from {date}" from props.
- [ ] 4.8 `tests/unit/features/versions/components/VersionContent.test.tsx` — renders TipTap output for given HTML, confirms no toolbar/editable surface.
- [ ] 4.9 `tests/unit/features/versions/components/VersionHistoryDrawer.test.tsx` — list loads newest-first / loading skeleton / list-fetch failure toast (Scenarios 3–5); clicking a version shows the preview banner + content, preview fires no `PATCH`/mutation, preview loading state, preview-fetch failure toast + stays on list, "Back to current" clears the selection (Scenarios 6–10); restore posts the correct `versionNumber`, calls `onRestored` with the response note, shows the toast, closes via `onOpenChange(false)`, button `isLoading` while in flight, restore failure shows a destructive toast and keeps the preview, reopening after a restore shows the new top version with all prior versions intact (Scenarios 11–14); `Escape` closes + returns focus to `returnFocusRef`, `Tab` stays trapped inside, `<aside aria-label="Version history">` is present (Scenarios 15–17).
- [ ] 4.10 Update `tests/unit/pages/EditorPage.test.tsx` — extend the `ActionHeader` mock to invoke `onHistory`; assert `VersionHistoryDrawer` opens with the route's `noteId` and is disabled/absent when `isNew`; assert a mocked `onRestored` call updates `draft` and invokes the mocked `NoteEditor` ref's `setContent`.

**Checkpoint 4 (final gate before PR, per root `CLAUDE.md`):**
```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/frontend test:coverage   # confirm ≥80% coverage on new code
```

No new E2E spec in this ticket — the full restore journey (view history → restore → verify new version) is covered by AB-1016's end-to-end test, per spec.md §6 Out of Scope.

---

Not proceeding to implementation — awaiting approval.
