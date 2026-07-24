# AB-1014 — Frontend Share Modal + Public View: Task Checklist

Source: `openspec/tickets/AB-1014/spec.md`, `openspec/tickets/AB-1014/plan.md`.
No backend/DB/shared-package work is required — all four share endpoints and their types
(`CreateShareRequest`, `ShareLink`, `CreateShareResponse`, `RevokeShareResponse`, `ShareListItem`,
`ListSharesResponse`, `SharedNoteView`, `GetSharedNoteResponse`, `SHARE_EXPIRY_MIN_HOURS`/
`MAX_HOURS`, `DEFAULT_SHARE_EXPIRY_HOURS`) already exist and are merged (AB-1008). Phase 1 below
is therefore local feature-module scaffolding (constants/utils), not shared-types/migrations.

---

## Phase 1 — Foundation (local constants, utils, data-layer types)

- [ ] 1.1 Create `apps/frontend/src/features/share/share.constants.ts` — `SHARE_EXPIRY_OPTIONS` (1h/1, 24h/24, 7d/168 default, 30d/720, plan Decision 2), `COPIED_FEEDBACK_MS = 2000`.
- [ ] 1.2 Create `apps/frontend/src/features/share/share.utils.ts` — `findShareForNote(shares, noteId)` pure lookup (plan Decision 1).
- [ ] 1.3 Add the local `ShareExpiryOption` interface (plan §5) alongside `share.constants.ts`.

**Checkpoint 1:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 2 — Core Implementation (data layer: API wrappers + query/mutation hooks)

- [ ] 2.1 Create `apps/frontend/src/features/share/share.api.ts` — `getShares()` (`GET /shares`), `createShare(noteId, input)` (`POST /notes/:id/share`), `revokeShare(noteId)` (`DELETE /notes/:id/share`), `getSharedNote(token)` (`GET /shared/:token`) — thin `apiClient.request` wrappers mirroring `notes.api.ts`.
- [ ] 2.2 Create `apps/frontend/src/features/share/share.hooks.ts`:
  - `useSharesQuery()` → `['shares', 'list']`.
  - `useCreateShareMutation(noteId)` → invalidates `['notes','detail',noteId]` + `['shares','list']`; `toast()` on error.
  - `useRevokeShareMutation(noteId)` → same invalidation; `toast()` on error.
  - `useSharedNoteQuery(token)` → `['shared', token]`, `retry` returns `false` for 404/410 (mirrors `useNoteQuery`).

**Checkpoint 2:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

---

## Phase 3 — Integration & UI Components

### Share feature components
- [ ] 3.1 `features/share/components/ExpiryDropdown.tsx` — native `<select aria-label="Link expiry">` from `SHARE_EXPIRY_OPTIONS`, styled to match `Input`; controlled `value`/`onChange` in hours.
- [ ] 3.2 `features/share/components/ViewCounterBadge.tsx` — `<Badge variant="secondary">{viewCount} view(s)</Badge>`.
- [ ] 3.3 `features/share/components/ShareLinkDisplay.tsx` — share URL field, `ViewCounterBadge`, "Copy Link" (clipboard write + "Copied! ✓" for `COPIED_FEEDBACK_MS`, `aria-live="polite"`, destructive toast on clipboard failure per plan Decision 5), inline Revoke confirm ("Revoke Link" → "Are you sure? / Cancel / Yes, revoke" per plan Decision 6).
- [ ] 3.4 `features/share/components/ShareModal.tsx` — `Dialog` (480px desktop / bottom-sheet mobile via responsive Tailwind classes, plan Decision — no new dependency); branches on `useSharesQuery()` + `findShareForNote`: loading → spinner, error → inline "Failed to generate share link.", found → `ShareLinkDisplay`, not found → `ExpiryDropdown` + "Generate Link" (`useCreateShareMutation`, `isLoading` spinner on the button, inline error on failure). Props: `noteId`, `open`, `onOpenChange`, `returnFocusRef`.
- [ ] 3.5 `features/share/components/SharedNoteContent.tsx` — read-only TipTap (`useEditor({ extensions: buildEditorExtensions(), content, editable: false })`, no toolbar, plan Decision 3).
- [ ] 3.6 `features/share/components/SharedNoteSkeleton.tsx` — full-page centered spinner.
- [ ] 3.7 `features/share/components/SharedNoteErrorState.tsx` — `variant: 'not-found' | 'expired' | 'error'`, each with its copy; `not-found`/`expired` include the "Create your account" → `/register` CTA, `error` omits it.

### Page composition
- [ ] 3.8 Replace `apps/frontend/src/pages/SharedNotePage.tsx` stub — `useParams` → `useSharedNoteQuery(token)`; branches loading/404/410/other-error/success; success renders `<article>` (`<h1>` title, `SharedNoteContent`, author byline, `formatUpdatedAt(createdAt)` reused from `features/notes/notes.utils.ts`, footer CTA), centered `max-w-[800px]` container with 24px padding.
- [ ] 3.9 Modify `apps/frontend/src/features/notes/components/ActionHeader.tsx` — add `onMoreMenuTriggerRef?: (el: HTMLButtonElement | null) => void` callback prop, called once the trigger button mounts. `onShare`/`onHistory` unchanged.
- [ ] 3.10 Modify `apps/frontend/src/pages/EditorPage.tsx` — add `shareModalOpen` state; pass `onShare={() => setShareModalOpen(true)}` and `onMoreMenuTriggerRef` to `ActionHeader`; render `<ShareModal noteId={id} open={shareModalOpen} onOpenChange={setShareModalOpen} returnFocusRef={...} />` alongside `DeleteNoteDialog`.

No changes needed to `App.tsx` — `/shared/:token` is already routed, unprotected.

**Checkpoint 3:**
```bash
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```
Manual smoke check: `pnpm dev` (backend + frontend). Log in, open a note, click "More actions" → "Share" — confirm the modal opens with the expiry dropdown (7 days pre-selected) and "Generate Link". Click Generate, confirm the link + view count (0) appear, click "Copy Link" and confirm "Copied! ✓" for ~2 seconds. Reopen the modal (or reload the page) and confirm it now shows the existing link directly, skipping the expiry step. Click "Revoke Link", confirm the inline "Are you sure?" step, confirm, and confirm the modal reverts to the generate form. Open a fresh generated link's URL in a private/incognito window (no auth) and confirm the read-only view renders correctly with no edit controls, tags, or version history visible, and a working "Create your account" CTA. Confirm a revoked or expired link shows the correct 404/410 full-page state.

---

## Phase 4 — Tests (unit, integration, E2E)

### Unit — data layer
- [ ] 4.1 `tests/unit/features/share/share.utils.test.ts` — `findShareForNote` match/no-match.
- [ ] 4.2 `tests/unit/features/share/share.api.test.ts` — all four wrappers call `apiClient.request` with expected path/method/body.
- [ ] 4.3 `tests/unit/features/share/share.hooks.test.tsx` — query keys, invalidation on mutation success, `toast()` on error, `useSharedNoteQuery`'s no-retry-on-404/410 gating.

### Unit — components
- [ ] 4.4 `tests/unit/features/share/components/ExpiryDropdown.test.tsx` — all four options render, default is 7 days, `onChange` fires with numeric hours.
- [ ] 4.5 `tests/unit/features/share/components/ViewCounterBadge.test.tsx` — renders count text.
- [ ] 4.6 `tests/unit/features/share/components/ShareLinkDisplay.test.tsx` — copy success (fake timers: "Copied! ✓" then reverts after 2s) / copy failure (destructive toast, label unchanged); revoke inline confirm shown before any request; confirm → `DELETE` called; cancel → no request; revoke failure → destructive toast, link still shown; view count rendered via `ViewCounterBadge`.
- [ ] 4.7 `tests/unit/features/share/components/ShareModal.test.tsx` — no-link → generate form; existing-link → `ShareLinkDisplay` directly (skips expiry step); loading state; `GET /api/shares` failure → inline error; generate default/custom expiry; generate button loading spinner; generate failure → inline error; `Escape` closes + returns focus to `returnFocusRef`; `Tab` stays trapped inside the modal.
- [ ] 4.8 `tests/unit/features/share/components/SharedNoteContent.test.tsx` — renders TipTap output for given HTML, confirms no toolbar/editable surface.
- [ ] 4.9 `tests/unit/features/share/components/SharedNoteErrorState.test.tsx` — each variant's copy; `error` variant omits the register CTA, others include it.
- [ ] 4.10 `tests/unit/pages/SharedNotePage.test.tsx` — success (title/content/author/date rendered, no tags/id/email in the DOM); loading → `SharedNoteSkeleton`; 404/410/other-error → matching `SharedNoteErrorState` variant; identical rendering regardless of `useAuthStore`'s authenticated state.
- [ ] 4.11 Update `tests/unit/pages/EditorPage.test.tsx` — extend the `ActionHeader` mock to invoke `onShare`; assert `ShareModal` opens with the route's `noteId`.

### E2E
- [ ] 4.12 `tests/e2e/share.spec.ts` — golden path (UX §7.8): open a note → Share → generate with default expiry → copy → open the URL in a fresh unauthenticated context → confirm read-only rendering with no edit controls → back → revoke → confirm the shared URL now 404s.

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
