# AB-1015 — Frontend Version History Drawer + Restore: Implementation Plan

## 1. Resolved Decisions (spec Open Questions 1–5)

| # | Question (from spec.md) | Decision |
| - | ------------------------ | -------- |
| 1 | Live editor content sync after restore | **Imperative ref on `NoteEditor` + a new `syncBaseline` escape hatch on `useAutosave`.** `NoteEditor` becomes `forwardRef<NoteEditorHandle, NoteEditorProps>` exposing `{ setContent: (html: string) => void }` via `useImperativeHandle`, calling `editor.commands.setContent(html)` (TipTap's default `emitUpdate = false`, so this does **not** fire `onContentChange` — the caller updates `draft` itself). `useAutosave` gains a `syncBaseline(next: EditorDraft): void` return value that sets `lastSavedRef.current = next` directly. `EditorPage`'s `handleRestored(note)` calls `setDraft(...)`, `syncBaseline(...)`, and `noteEditorRef.current?.setContent(note.content)` together — without `syncBaseline`, the dirty-check effect in `useAutosave.ts:153` would see the just-updated `draft` differ from its stale `lastSavedRef` baseline and schedule a redundant autosave `PATCH` ~2s later, silently creating a second, identical version right after the restore (contradicting BR-009's "restore creates a new version," not two). This is race-free: `VersionHistoryDrawer` is a focus-trapping `Drawer` (Radix `Dialog` under the hood), so the live editor cannot receive input while it's open — `draft` cannot change between opening the drawer and a restore completing, so reading `draft` in `handleRestored`'s closure is always accurate. |
| 2 | Where the preview renders | **Inside the drawer itself**, not by taking over the live editor pane. `VersionHistoryDrawer` renders a self-contained `VersionPreviewBanner` + read-only content pane (new `VersionContent.tsx`, mirroring `features/share/components/SharedNoteContent.tsx`'s read-only-TipTap pattern exactly, but kept local to `features/versions/` rather than cross-imported — versions and sharing are unrelated domains, unlike AB-1013's precedent of reusing `features/notes` exports for genuinely note-generic utilities). The live editor underneath is never touched until a confirmed restore, which is strictly safer given Decision 1's constraints and matches FR-VER-003 AC-3 ("viewing a version does not modify the current note") most literally. |
| 3 | Drawer behavior after a successful restore | **Auto-close.** On `useRestoreVersionMutation` success, `VersionHistoryDrawer` calls `onOpenChange(false)` (returning focus to the "More actions" trigger, same as `Escape`) after firing the toast and `onRestored(note)`. The user's goal is complete and the live editor now shows the restored content — leaving the drawer open on a stale preview of the *old* version would read as contradicting what just happened. This mirrors `DeleteNoteDialog`'s close-on-success pattern more than `ShareModal`'s stay-open pattern, since restore (like delete) is a one-shot completion action, not an ongoing management surface. |
| 4 | New `Drawer` primitive vs. feature-local styling | **New `components/ui/drawer.tsx`**, built on the same `@radix-ui/react-dialog` primitive as `components/ui/dialog.tsx` (no new dependency — CON-001/CON-008), right-anchored instead of centered, using `tailwindcss-animate`'s `slide-in-from-right`/`slide-out-to-right` utilities (already a pinned dependency) for the 300ms animation. To satisfy UX §8.12's explicit `<aside aria-label="Version history">` landmark note while keeping Radix's focus-trap/`Escape`/`aria-modal` behavior, `DrawerContent` renders `DialogPrimitive.Content asChild` wrapping a real `<aside>` element (Radix's `Slot` merges the dialog's role/keyboard/focus-trap props onto it) — giving the literal landmark tag *and* the modal semantics, rather than settling for Radix's default generic `role="dialog"` div the way `Dialog` does today. |
| 5 | Preview snippet length (FR-VER-002's "200 chars" vs. UX-VER-04's "~50 chars") | **Render `contentPreview` verbatim, truncate only visually.** Confirmed via `apps/backend/src/modules/versions/versions.service.ts:36` that the server already slices to `VERSION_PREVIEW_LENGTH = 200` (`packages/shared/src/constants/limits.ts`) before it ever reaches the client — so FR-VER-002 (200) is the real, already-implemented contract and UX-VER-04's "~50" is just approximate screen copy, not a second truncation the frontend must perform. `VersionItem` applies a single-line `truncate` (CSS ellipsis) class to the preview text for the list row's fixed width — a display concern, not a data concern. |

## 2. Architecture Overview

```
EditorPage.tsx (MODIFIED)
├── ActionHeader — now passed onHistory={isNew ? undefined : () => setHistoryDrawerOpen(true)}
├── noteEditorRef: useRef<NoteEditorHandle>(null) — NEW, passed to <NoteEditor ref={noteEditorRef} />
├── useAutosave(...) — now also destructures `syncBaseline`
├── handleRestored(note: NoteResponse) — NEW
│   ├── setDraft(prev => ({ ...prev, title: note.title, content: note.content }))
│   ├── syncBaseline({ ...draft, title: note.title, content: note.content })
│   └── noteEditorRef.current?.setContent(note.content)
└── VersionHistoryDrawer (features/versions/components/VersionHistoryDrawer.tsx) — NEW
    ├── open via `historyDrawerOpen` state; returnFocusRef = same moreMenuTriggerRef
    │   already used by DeleteNoteDialog/ShareModal
    ├── local state: selectedVersionNumber: number | undefined (undefined = list view)
    ├── useVersionsQuery(noteId, { enabled: open })
    │   ├── loading  → VersionListSkeleton (shimmer rows)
    │   ├── error    → toast "Unable to load version history."
    │   └── success  → VersionList (newest-first), each row a VersionItem
    │                    └── onClick → setSelectedVersionNumber(versionNumber)
    ├── useVersionQuery(noteId, selectedVersionNumber) — enabled only once a version is selected
    │   ├── loading  → preview loading spinner
    │   ├── error    → toast "Unable to load that version.", stay on list
    │   └── success  → VersionPreviewBanner ("Viewing version {N} from {date}") + VersionContent
    │                    (read-only TipTap, Decision 2) + "Back to current" + "Restore this version"
    │                       "Back to current"       → setSelectedVersionNumber(undefined)
    │                       "Restore this version"  → useRestoreVersionMutation(noteId).mutate(N)
    │                          └── onSuccess → onRestored(note), toast "Version {N} restored.",
    │                                          onOpenChange(false) (Decision 3), reset selection
    │                          └── onError  → toast "Failed to restore version. Please try again.",
    │                                          stays on the preview so the user can retry
    └── Drawer/DrawerContent (components/ui/drawer.tsx) — NEW primitive, Decision 4
```

State flow: `VersionHistoryDrawer` has exactly one piece of local state (`selectedVersionNumber`) — everything else (list contents, preview contents, restore progress) is derived from the three hooks' query/mutation states, mirroring `ShareModal`'s "no state beyond what the queries already give you" precedent from AB-1014.

## 3. Files to Create

### `packages/shared`
**None.** `VersionListItem`, `ListVersionsResponse`, `VersionDetail`, `GetVersionResponse`, `RestoreVersionResponse`, `VersionNumberParam` all already exist from AB-1009.

### `apps/frontend/src/components/ui/`
| File | Purpose |
| ---- | ------- |
| `drawer.tsx` | `Drawer`/`DrawerTrigger`/`DrawerPortal`/`DrawerClose`/`DrawerOverlay`/`DrawerContent` — right-anchored `Dialog` variant per Decision 4. `DrawerContent` renders `DialogPrimitive.Content asChild` wrapping an `<aside>`, classed `fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-card p-6 shadow-lg sm:w-[400px]` with `duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right`. Accepts and forwards `onCloseAutoFocus` like `DialogContent` does, so `returnFocusRef` wiring works identically to `ShareModal`/`DeleteNoteDialog`. |

### `apps/frontend/src/features/versions/`
| File | Purpose |
| ---- | ------- |
| `versions.api.ts` | `getVersions(noteId): Promise<ListVersionsResponse>` (`GET /notes/${noteId}/versions`), `getVersion(noteId, versionNumber): Promise<GetVersionResponse>` (`GET /notes/${noteId}/versions/${versionNumber}`), `restoreVersion(noteId, versionNumber): Promise<RestoreVersionResponse>` (`POST /notes/${noteId}/versions/${versionNumber}/restore`) — thin `apiClient.request` wrappers, mirroring `share.api.ts`. |
| `versions.hooks.ts` | `useVersionsQuery(noteId, options?: { enabled?: boolean })` → `useQuery<ListVersionsResponse>({queryKey: ['versions','list',noteId], queryFn: () => getVersions(noteId), ...options})`. `useVersionQuery(noteId, versionNumber: number \| undefined)` → `useQuery<GetVersionResponse>({queryKey: ['versions','detail',noteId,versionNumber], queryFn: () => getVersion(noteId, versionNumber!), enabled: versionNumber !== undefined})`. `useRestoreVersionMutation(noteId)` → `useMutation<RestoreVersionResponse, unknown, number>` — `onSuccess` does `setQueryData(['notes','detail',noteId], {note})` + `invalidateQueries(['notes','list'])` + `invalidateQueries(['versions','list',noteId])` (mirrors `useUpdateNoteMutation`'s cache-write pattern); `onError` shows the destructive toast (Decision-driven copy, Scenario 13). |
| `components/VersionHistoryDrawer.tsx` | Described in Section 2. Props: `noteId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `returnFocusRef?: RefObject<HTMLElement \| null>`, `onRestored: (note: NoteResponse) => void`. |
| `components/VersionList.tsx` | Renders the ordered `VersionItem` rows from `ListVersionsResponse['versions']`, or `VersionListSkeleton` while loading. Props: `versions: VersionListItem[]`, `onSelect: (versionNumber: number) => void`. |
| `components/VersionItem.tsx` | One row: version number, `formatUpdatedAt(createdAt)` (reused from `features/notes/notes.utils.ts`, same cross-feature-reuse precedent AB-1014 already established), and a `truncate`-classed `contentPreview` (Decision 5). Rendered as a `<button>` for keyboard/click access. |
| `components/VersionListSkeleton.tsx` | 3–4 stacked `Skeleton` rows (`components/ui/skeleton.tsx`), matching `NoteCardSkeleton`'s shimmer-stack convention. |
| `components/VersionPreviewBanner.tsx` | The yellow banner: "Viewing version {N} from {date}" (UX §8.12 Success States). Props: `versionNumber: number`, `createdAt: string`. |
| `components/VersionContent.tsx` | Read-only TipTap renderer (Decision 2), structurally identical to `features/share/components/SharedNoteContent.tsx`: `useEditor({extensions: buildEditorExtensions(), content, editable: false}, [content])`. Props: `content: string`. |

### `apps/frontend/src/features/notes/components/`
| File | Purpose |
| ---- | ------- |
| `NoteEditor.tsx` (rewritten, not new) | See Section 4 — converts to `forwardRef` and exposes `NoteEditorHandle`. |

No changes to `apps/backend`, no new `packages/shared` schemas.

## 4. Files to Modify

| File | Change |
| ---- | ------ |
| `apps/frontend/src/features/notes/components/NoteEditor.tsx` | Wrap in `forwardRef<NoteEditorHandle, NoteEditorProps>`; add `export interface NoteEditorHandle { setContent: (html: string) => void }`; add `useImperativeHandle(ref, () => ({ setContent: (html) => editor?.commands.setContent(html) }), [editor])`. `initialContent`/`onContentChange`/`onUpdate`/the "never re-keyed" `[]` deps array are all unchanged — this is a pure addition, not a behavior change to existing autosave/typing flows. |
| `apps/frontend/src/features/notes/useAutosave.ts` | Add `syncBaseline: (next: EditorDraft) => void` to `UseAutosaveResult` and the returned object, implemented as `useCallback((next: EditorDraft) => { lastSavedRef.current = next; }, [])`. No other logic in this file changes. |
| `apps/frontend/src/pages/EditorPage.tsx` | Add `noteEditorRef = useRef<NoteEditorHandle>(null)` and pass it to `<NoteEditor ref={noteEditorRef} .../>`; add `historyDrawerOpen` state; pass `onHistory={isNew ? undefined : () => setHistoryDrawerOpen(true)}` to `ActionHeader` (its `onHistory?: () => void` contract from AB-1012 is unchanged); destructure `syncBaseline` from `useAutosave(...)`; add `handleRestored` (Section 2); render `<VersionHistoryDrawer noteId={id} open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen} returnFocusRef={moreMenuTriggerRef} onRestored={handleRestored} />` next to the existing `ShareModal`, guarded by `{!isNew && (...)}` the same way `ShareModal` is. |
| `apps/frontend/tests/unit/pages/EditorPage.test.tsx` | Every existing `vi.mocked(useAutosave).mockReturnValue({status, forceSave: ...})` call site must add `syncBaseline: vi.fn()` (the real hook's return type now requires it, so the mocked type would otherwise fail to compile). Extend the `ActionHeader` mock to also invoke `onHistory` from a test button (mirroring how it already exposes `onShare`), and add a mocked `VersionHistoryDrawer` module plus a test asserting it receives `open={true}` after clicking "History" (mirrors AB-1014's `ShareModal` test addition) and `open={false}`/undefined `onHistory` when `isNew`. |
| `apps/frontend/src/features/notes/notes.types.ts` | No change — `EditorDraft` is reused as-is by `syncBaseline`'s signature. |

No changes to `App.tsx` (no new route — the drawer is not a page), no changes to `apps/backend`, no changes to `packages/shared`.

## 5. TypeScript Interfaces (local, non-shared)

```typescript
// features/notes/components/NoteEditor.tsx
export interface NoteEditorHandle {
  setContent: (html: string) => void;
}

// features/notes/useAutosave.ts (added to the existing UseAutosaveResult)
export interface UseAutosaveResult {
  status: SaveStatus;
  errorMessage?: string;
  forceSave: () => void;
  syncBaseline: (next: EditorDraft) => void; // NEW
}
```

All request/response shapes reuse `@note-app/shared` types directly (`VersionListItem`, `ListVersionsResponse`, `VersionDetail`, `GetVersionResponse`, `RestoreVersionResponse`) — no duplication, per CON-003.

## 6. Data Fetching / Cache Keys

| Hook | Query Key | Enabled | Invalidated By |
| ---- | --------- | ------- | --------------- |
| `useVersionsQuery(noteId)` | `['versions', 'list', noteId]` | `open` (only while the drawer is mounted/open) | `useRestoreVersionMutation` |
| `useVersionQuery(noteId, versionNumber)` | `['versions', 'detail', noteId, versionNumber]` | `versionNumber !== undefined` | nothing — each version snapshot is immutable (BR-017), so once fetched it never needs invalidation |
| `useRestoreVersionMutation(noteId)` | mutation, no query key | — | invalidates `['notes', 'list']`, `['versions', 'list', noteId]`; writes `['notes', 'detail', noteId]` directly via `setQueryData` |

## 7. DB / Backend Impact

**None.** Read/write consumption of the three endpoints from AB-1009 (already implemented and merged): `GET /api/notes/:id/versions`, `GET /api/notes/:id/versions/:versionNumber`, `POST /api/notes/:id/versions/:versionNumber/restore`. No Prisma schema changes, no migrations, no changes to `apps/backend`.

## 8. Accessibility & Keyboard Checklist (to verify during implementation)

- `VersionHistoryDrawer`'s `Escape` closes it and returns focus to the "More actions" trigger button (same `returnFocusRef` mechanism as `DeleteNoteDialog`/`ShareModal`).
- `Tab` order inside the drawer never escapes it (Radix `Dialog`'s built-in focus trap, inherited by the new `Drawer` primitive — no extra code needed).
- `DrawerContent` renders a real `<aside aria-label="Version history">` (Decision 4's `asChild` composition), not a generic `role="dialog"` div, matching UX §8.12's literal accessibility note.
- Each `VersionItem` is a real `<button>` (not a `<div onClick>`), so it's independently focusable/activatable via keyboard with no extra `tabIndex`/`onKeyDown` handling.
- `VersionPreviewBanner`'s "Viewing version {N} from {date}" text is real text content (screen-reader announced), not conveyed by color alone (the yellow background is a visual reinforcement, not the only signal).
- `VersionContent`'s read-only TipTap instance has `editable: false`, removing it from the tab order entirely (same as `SharedNoteContent`'s established precedent) — no focusable/editable surface inside the preview.
- Restoring closes the drawer via the same `onOpenChange(false)` path as `Escape`, so focus return is consistent regardless of which of the two closes the user (or the app) triggers.

## 9. Test Plan

Mirrors `apps/frontend/tests/` structure (Vitest + React Testing Library), matching AB-1012/AB-1014's coverage patterns.

**Unit (`tests/unit/features/versions/...`):**
- `versions.api.test.ts` — each of the three wrappers calls `apiClient.request` with the expected path/method.
- `versions.hooks.test.tsx` — `useVersionsQuery`'s key/`enabled` passthrough; `useVersionQuery`'s `enabled: false` when `versionNumber` is `undefined`; `useRestoreVersionMutation` writes `['notes','detail',noteId]`, invalidates `['notes','list']` and `['versions','list',noteId]` on success, and toasts on error.
- `components/VersionItem.test.tsx` — renders version number/date/preview; `onSelect` fires with the correct `versionNumber` on click.
- `components/VersionList.test.tsx` — renders rows newest-first (Scenario 3); shows `VersionListSkeleton` while loading (Scenario 4).
- `components/VersionPreviewBanner.test.tsx` — renders "Viewing version {N} from {date}" with the given props.
- `components/VersionContent.test.tsx` — renders TipTap output for given HTML, confirms no toolbar/editable surface (mirrors `SharedNoteContent.test.tsx`).
- `components/VersionHistoryDrawer.test.tsx` — Scenario 3–5 (list loads newest-first; loading skeleton; list-fetch failure → toast, no content), Scenario 6–10 (clicking a version → preview banner + content; preview does not fire any `PATCH`/mutation; preview loading state; preview-fetch failure → toast, stays on list; "Back to current" clears the selection), Scenario 11–14 (restore → correct `versionNumber` posted, `onRestored` called with the response note, toast text, drawer closes via `onOpenChange(false)`; restore button `isLoading` while in flight; restore failure → destructive toast, banner/preview remain so the user can retry; reopening after a restore shows the new top version and all prior versions still present), Scenario 15–17 (`Escape` → `onOpenChange(false)` + focus returns to `returnFocusRef`; `Tab` cycle stays inside; `<aside aria-label="Version history">` present).
- `components/NoteEditor.test.tsx` (extended) — a ref's `setContent(html)` updates the rendered TipTap document without remounting the editor instance or resetting `onContentChange`'s wiring.
- `useAutosave.test.ts` (extended) — `syncBaseline(next)` prevents the dirty-check effect from scheduling a save even though `draft` differs from the *original* baseline (i.e., after `syncBaseline`, `sameDraft(draft, lastSavedRef.current)` is true and no `setTimeout` for `performSave` is armed).
- `pages/EditorPage.test.tsx` (extended) — clicking "History" (via the extended `ActionHeader` mock) opens `VersionHistoryDrawer` with `noteId` matching the route and is disabled/absent when `isNew`; a mocked `onRestored` invocation updates `draft` and calls the mocked `NoteEditor` ref's `setContent`.

**Coverage target:** ≥80% on all new code per `CLAUDE.md` quality gates.

## 10. Checkpoints (run after implementation, before commit)

```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test:coverage
```

Then the full monorepo gate before commit, per root `CLAUDE.md`:

```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

## 11. Out-of-Scope Reminders Carried Forward from spec.md

- No changes to automatic version snapshot creation (FR-VER-001) or auto-purge (FR-VER-005) — both AB-1009 backend, already done.
- No changes to the editor's own autosave-driven version creation — AB-1012, unaffected.
- No E2E journey coverage of the restore flow — AB-1016.
- No diff/compare-two-versions UI — not in the FRS scope for this ticket.
- No cross-note "all version history" screen — only the per-note drawer (UX-SCR-012) exists in the UX inventory.

---

Not proceeding to implementation — awaiting approval.
