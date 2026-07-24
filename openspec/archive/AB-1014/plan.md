# AB-1014 — Frontend Share Modal + Public View: Implementation Plan

## 1. Resolved Decisions (spec Open Questions 1–6)

| # | Question (from spec.md) | Decision |
| - | ------------------------ | -------- |
| 1 | Existing-link detection mechanism | **`GET /api/shares` on modal open, filtered client-side by `noteId`.** `ShareModal` calls `useSharesQuery()` (`['shares', 'list']`) when it opens, then does `shares.find(s => s.noteId === noteId)`. Found → render `ShareLinkDisplay` directly. Not found → render the generate form. This matches UX §7.8's explicit `CheckExisting` decision point occurring *before* `SelectExpiry`, and avoids ever firing a `POST` before the user has chosen an expiry/clicked "Generate." |
| 2 | Expiry dropdown preset options + control choice | **Native `<select>`, not a new Radix dependency.** `@radix-ui/react-select` is not in `package.json` (only `dialog`, `dropdown-menu`, `popover`, `toast`, `tooltip` are pinned) and CON-001/CON-008 rule out adding an unpinned package for a 4-option control. `ExpiryDropdown` is a styled native `<select>` (Tailwind-classed to match `Input`'s visual style), fully keyboard/screen-reader accessible with zero new deps. Preset options: `1 hour` (1), `24 hours` (24), `7 days` (168, **default/pre-selected**, matches backend's `DEFAULT_SHARE_EXPIRY_HOURS`), `30 days` (720). |
| 3 | Public content rendering approach | **Read-only TipTap instance**, not `dangerouslySetInnerHTML`. `SharedNoteContent` calls `useEditor({ extensions: buildEditorExtensions(), content: note.content, editable: false })` (reusing the exact extension set from `features/notes/tiptap-extensions.ts` per CON-001) and renders `<EditorContent editor={editor} />` with no toolbar. Guarantees pixel-identical rendering of headings/lists/code blocks/task lists to the authoring editor, with a single source of truth for the extension set. Server-side sanitization (`notes.content.ts`, AB-1004) already makes this safe from an XSS standpoint regardless of rendering method — TipTap read-only is chosen for rendering-fidelity, not security. |
| 4 | Reuse `formatUpdatedAt` from `features/notes/notes.utils.ts`? | **Reuse it as-is**, imported directly (`import { formatUpdatedAt } from '../notes/notes.utils'`), for `expiresAt`/`createdAt` display in both the Share modal and the public view. AB-1013 already established cross-feature reuse (`PaginationControls` imported straight from `features/notes`) — despite the note-specific name, the function is a generic `Intl.DateTimeFormat` wrapper with no note-specific logic, so duplicating it in a new `features/share/` util would violate the "don't introduce abstractions beyond what's needed" principle for zero benefit. |
| 5 | Clipboard fallback | `navigator.clipboard.writeText(url)` wrapped in try/catch. On rejection (denied permission, non-secure context, or the API being entirely absent — checked via `navigator.clipboard?.writeText`), show `toast({ description: 'Failed to copy link. Please copy manually.', variant: 'destructive' })` and leave the button label unchanged (Scenario 11). No `document.execCommand('copy')` fallback — that API is deprecated and out of scope; the toast message itself tells the user to copy manually from the visible URL field. |
| 6 | Revoke confirmation UI shape | **Inline two-step state within `ShareModal`**, not a second `Dialog`. UX §8.11's component list for UX-SCR-011 is `Modal, ShareLinkDisplay, ExpiryDropdown, ViewCounterBadge, Button` — no second dialog component is named, unlike `DeleteNoteDialog`'s screen (UX-SCR-008) which explicitly lists a standalone confirmation screen. `ShareLinkDisplay`'s "Revoke Link" button toggles local `confirmingRevoke` state; when true it renders "Are you sure?" with "Cancel" / "Yes, revoke" in place of the single button, matching the modal's flat structure rather than stacking a second `Dialog` inside one already-open `Dialog` (Radix nested-dialog focus-trap conflicts are also avoided this way). |

## 2. Architecture Overview

```
EditorPage.tsx (MODIFIED)
├── ActionHeader — now passed onShare={() => setShareModalOpen(true)}
└── ShareModal (features/share/components/ShareModal.tsx) — NEW
    ├── open via `shareModalOpen` state in EditorPage; returnFocusRef = same
    │   moreMenuTriggerRef already used by DeleteNoteDialog (ActionHeader owns the ref;
    │   both dialogs receive it — see Files to Modify)
    ├── useSharesQuery() → find entry by noteId
    │   ├── loading  → centered spinner
    │   ├── error    → "Failed to generate share link." inline error
    │   ├── found    → ShareLinkDisplay (url, ViewCounterBadge, Copy, Revoke)
    │   └── not found → ExpiryDropdown + "Generate Link" button
    │                     └── useCreateShareMutation() → 201 → ShareLinkDisplay
    └── ShareLinkDisplay (features/share/components/ShareLinkDisplay.tsx) — NEW
        ├── Copy Link → clipboard write → "Copied! ✓" (2s, aria-live="polite")
        └── Revoke Link → inline confirm ("Are you sure?" / Cancel / Yes, revoke)
              └── useRevokeShareMutation() → 200 → back to ExpiryDropdown view

App.tsx (route already exists, unmodified) — /shared/:token → SharedNotePage
SharedNotePage.tsx (REPLACED — currently a placeholder stub)
├── useSharedNoteQuery(token) — GET /api/shared/:token, no auth required
│   ├── loading        → full-page centered spinner
│   ├── 404 (SHARE_LINK_NOT_FOUND) → SharedNoteErrorState variant="not-found"
│   ├── 410 (SHARE_LINK_EXPIRED)   → SharedNoteErrorState variant="expired"
│   ├── other error    → SharedNoteErrorState variant="error"
│   └── success         → <article>: title, SharedNoteContent (read-only TipTap),
│                          authorName, formatUpdatedAt(createdAt), footer CTA → /register
└── SharedNoteContent (features/share/components/SharedNoteContent.tsx) — NEW
    └── useEditor({ extensions: buildEditorExtensions(), content, editable: false })
```

State flow: `ShareModal` has no state of its own beyond `confirmingRevoke` — its "which view to show" is fully derived each render from `useSharesQuery()`'s data (found/not-found/loading/error) plus the two mutations' `isPending`/`isError`. `SharedNotePage` is a single `useSharedNoteQuery(token)` consumer with no local state besides what `EditorContent` needs internally.

## 3. Files to Create

### `packages/shared`
**None.** `CreateShareRequest`, `ShareLink`, `CreateShareResponse`, `RevokeShareResponse`, `ShareListItem`, `ListSharesResponse`, `SharedNoteView`, `GetSharedNoteResponse`, and `SHARE_EXPIRY_MIN_HOURS`/`SHARE_EXPIRY_MAX_HOURS`/`DEFAULT_SHARE_EXPIRY_HOURS` all already exist from AB-1008.

### `apps/frontend/src/features/share/`
| File | Purpose |
| ---- | ------- |
| `share.constants.ts` | `SHARE_EXPIRY_OPTIONS: { label: string; hours: number }[]` — the four presets from Decision 2 (`1 hour`/1, `24 hours`/24, `7 days`/168, `30 days`/720). `COPIED_FEEDBACK_MS = 2000` (Scenario 10). |
| `share.api.ts` | `getShares(): Promise<ListSharesResponse>` (`GET /shares`), `createShare(noteId: string, input: CreateShareRequest): Promise<CreateShareResponse>` (`POST /notes/${noteId}/share`), `revokeShare(noteId: string): Promise<RevokeShareResponse>` (`DELETE /notes/${noteId}/share`), `getSharedNote(token: string): Promise<GetSharedNoteResponse>` (`GET /shared/${token}`) — all thin `apiClient.request` wrappers, mirroring `notes.api.ts`. |
| `share.hooks.ts` | `useSharesQuery()` (`useQuery<ListSharesResponse>({queryKey: ['shares','list'], queryFn: getShares})`); `useCreateShareMutation(noteId)` and `useRevokeShareMutation(noteId)` (both invalidate `['notes','detail',noteId]` and `['shares','list']` per SDS §22.3, and `toast()` on error mirroring `notes.hooks.ts`'s pattern); `useSharedNoteQuery(token)` (`useQuery<GetSharedNoteResponse>({queryKey: ['shared', token], queryFn: () => getSharedNote(token), retry: (count, error) => error instanceof ApiError && (error.status === 404 || error.status === 410) ? false : count < 3})` — mirrors `useNoteQuery`'s no-retry-on-deterministic-4xx pattern). |
| `share.utils.ts` | `findShareForNote(shares: ShareListItem[], noteId: string): ShareListItem \| undefined` — pure lookup, unit-testable in isolation, used by `ShareModal`. |
| `components/ShareModal.tsx` | Described in Section 2. `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` from `components/ui/dialog.tsx`, with `className="sm:max-w-[480px]"` override (desktop 480px per UX §8.11 — `DialogContent`'s default `max-w-[400px]` is safely overridden via `cn`'s `twMerge`) and a mobile bottom-sheet variant via responsive Tailwind classes (`max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-t-lg max-sm:rounded-b-none`, replacing the default centered-fixed positioning only below the `sm` breakpoint) — no new dependency, matches CON-001. Accepts `noteId`, `open`, `onOpenChange`, `returnFocusRef` (same shape as `DeleteNoteDialog`'s props). |
| `components/ExpiryDropdown.tsx` | Native `<select aria-label="Link expiry">` populated from `SHARE_EXPIRY_OPTIONS`, styled to match `Input`'s border/focus-ring classes. Controlled `value: number` (hours) + `onChange`. |
| `components/ShareLinkDisplay.tsx` | Renders the share URL (read-only `<Input readOnly>` or plain text — visually copyable), `ViewCounterBadge`, "Copy Link" button (Decision 5 clipboard logic + `aria-live="polite"` status span), and the inline Revoke flow (Decision 6). Props: `shareLink: ShareLink`, `onRevoke: () => void`, `revokePending: boolean`. |
| `components/ViewCounterBadge.tsx` | Thin wrapper around `components/ui/badge.tsx`: `<Badge variant="secondary">{viewCount} view{viewCount === 1 ? '' : 's'}</Badge>`. |
| `components/SharedNoteContent.tsx` | Read-only TipTap renderer per Decision 3. Props: `content: string`. No `onUpdate`, no toolbar — mirrors `NoteEditor.tsx`'s `useEditor` setup minus the editable/toolbar/keyboard-shortcut concerns. |
| `components/SharedNoteErrorState.tsx` | Full-page centered state, `variant: 'not-found' \| 'expired' \| 'error'`. `not-found` → "Note not found" / "This link doesn't exist or has been removed." `expired` → "This link has expired" / "Ask the owner to share a new link." `error` → "Something went wrong" / "Please try again later." All three render a "Create your account" `<Link to="/register">` CTA (UX §8.13 Navigation) except `error`, which omits the CTA (a transient failure isn't the moment to pitch registration). |
| `components/SharedNoteSkeleton.tsx` | Full-page centered `Loader2` spinner (matches `EditorSkeleton`'s convention of a dedicated loading component rather than inlining a spinner in the page). |

### `apps/frontend/src/pages/`
| File | Purpose |
| ---- | ------- |
| `SharedNotePage.tsx` | **Replaces** the current one-line stub. Reads `token` via `useParams<{ token: string }>()`, calls `useSharedNoteQuery(token)`, and branches: loading → `SharedNoteSkeleton`; error with `status === 404` → `SharedNoteErrorState variant="not-found"`; `status === 410` → `variant="expired"`; any other error → `variant="error"`; success → `<article>` with title (`<h1>`), `SharedNoteContent`, author byline ("by {authorName}"), `formatUpdatedAt(createdAt)`, and the footer CTA, inside a centered `max-w-[800px]` container with `24px` padding (UX §8.13 Responsive Behavior). |

## 4. Files to Modify

| File | Change |
| ---- | ------ |
| `apps/frontend/src/pages/EditorPage.tsx` | Add `shareModalOpen` state (`useState(false)`); pass `onShare={() => setShareModalOpen(true)}` to `ActionHeader` (its existing `onShare?: () => void` contract is left unchanged, per AB-1012 spec Decision 6, which deliberately shipped that prop as a plain callback so this ticket could wire a handler without modifying `ActionHeader`); render `<ShareModal noteId={id} open={shareModalOpen} onOpenChange={setShareModalOpen} returnFocusRef={moreMenuTriggerRef} />` in `EditorPage` itself, next to `DeleteNoteDialog`. |
| `apps/frontend/src/features/notes/components/ActionHeader.tsx` (minimal change) | The only change to this file: expose its internal `moreMenuTriggerRef` to the parent via a new `onMoreMenuTriggerRef?: (el: HTMLButtonElement \| null) => void` callback prop (called once the trigger button mounts), so `EditorPage` can hand that same element to `ShareModal`'s `returnFocusRef` — mirroring how `DeleteNoteDialog` already receives it internally. `onShare`/`onHistory` props are unchanged. |
| `apps/frontend/tests/unit/pages/EditorPage.test.tsx` | Extend the existing `ActionHeader` mock to also invoke `onShare` from a test button, and add a test asserting `ShareModal` receives `open={true}` after clicking it (mirrors how `DeleteNoteDialog` is already exercised in this file for `canDelete`/delete flows). |

No changes to `App.tsx` (the `/shared/:token` route already exists, unprotected), no changes to `apps/backend`, no changes to `packages/shared`.

## 5. TypeScript Interfaces (local, non-shared)

```typescript
// features/share/share.constants.ts
export interface ShareExpiryOption {
  label: string;
  hours: number;
}
```

All request/response shapes reuse `@note-app/shared` types directly (`CreateShareRequest`, `ShareLink`, `CreateShareResponse`, `RevokeShareResponse`, `ShareListItem`, `ListSharesResponse`, `SharedNoteView`, `GetSharedNoteResponse`) — no duplication, per CON-003.

## 6. Data Fetching / Cache Keys

| Hook | Query Key | Enabled | Invalidated By |
| ---- | --------- | ------- | --------------- |
| `useSharesQuery()` | `['shares', 'list']` | always (only called while `ShareModal` is mounted) | `useCreateShareMutation`, `useRevokeShareMutation` (both invalidate it, per SDS §22.3) |
| `useCreateShareMutation(noteId)` | mutation, no query key | — | invalidates `['notes', 'detail', noteId]`, `['shares', 'list']` |
| `useRevokeShareMutation(noteId)` | mutation, no query key | — | invalidates `['notes', 'detail', noteId]`, `['shares', 'list']` |
| `useSharedNoteQuery(token)` | `['shared', token]` | always | nothing — one-shot public read, never mutated by this ticket |

`['notes', 'detail', noteId]` invalidation is a no-op in practice today (`NoteResponseSchema` carries no share-related field, confirmed in `packages/shared/src/schemas/note.schemas.ts`), but it's kept because SDS §22.3's cache-invalidation table lists it explicitly for both mutations — harmless, and keeps this ticket consistent with the canonical spec table rather than silently deviating from it.

## 7. DB / Backend Impact

**None.** Read-only/write consumption of the four endpoints from AB-1008 (already implemented and merged): `POST /api/notes/:id/share`, `DELETE /api/notes/:id/share`, `GET /api/shares`, `GET /api/shared/:token`. No Prisma schema changes, no migrations, no changes to `apps/backend`.

## 8. Accessibility & Keyboard Checklist (to verify during implementation)

- `ShareModal`'s `Escape` closes it and returns focus to the "More actions" trigger button (same `returnFocusRef` mechanism as `DeleteNoteDialog`).
- `Tab` order inside the modal never escapes it (Radix `Dialog`'s built-in focus trap — no extra code needed, same as `DeleteNoteDialog`).
- Copy status ("Copied! ✓") is announced via a dedicated `aria-live="polite"` span, not by relying on visible text change alone.
- `ExpiryDropdown` has an explicit `aria-label="Link expiry"` (no visible `<label>` in the compact modal layout, matching `SearchBar`'s precedent of `aria-label` over a visible label).
- `ViewCounterBadge` text is real text content (e.g. "12 views"), not an icon-only badge, so it's announced meaningfully by screen readers.
- `SharedNotePage`'s success state uses a real `<article>` landmark with the title as an `<h1>` (UX §8.13 Accessibility Notes: "Semantic article layout, clean document outline").
- `SharedNoteContent`'s read-only TipTap instance has no focusable/editable surface — `editable: false` removes it from the tab order entirely (Radix/ProseMirror default behavior), so no extra `tabIndex` handling is needed.
- Revoke's inline confirm ("Are you sure? Cancel / Yes, revoke") keeps focus on a stable element (the button that becomes "Yes, revoke") rather than moving focus unexpectedly when the two-step state toggles.

## 9. Test Plan

Mirrors `apps/frontend/tests/` structure (Vitest + React Testing Library for unit, Playwright for e2e), matching AB-1012/AB-1013's coverage patterns.

**Unit (`tests/unit/features/share/...`):**
- `share.utils.test.ts` — `findShareForNote` returns the matching entry / `undefined` when none matches.
- `share.api.test.ts` — each of the four wrappers calls `apiClient.request` with the expected path/method/body.
- `share.hooks.test.tsx` — `useSharesQuery` query key/fn; `useCreateShareMutation`/`useRevokeShareMutation` invalidate both expected keys on success and `toast()` on error; `useSharedNoteQuery`'s `retry` returns `false` for 404/410 and the default retry count otherwise.
- `components/ExpiryDropdown.test.tsx` — renders all four options, default selection is 7 days/168, `onChange` fires with the numeric hours value.
- `components/ShareModal.test.tsx` — Scenarios 2–5 (no-link → generate form; existing-link → `ShareLinkDisplay` directly; loading; `GET /api/shares` failure → inline error), Scenario 6–9 (generate default/custom expiry, loading spinner on the button, generate failure → inline error), `Escape` → `onOpenChange(false)` + focus returns to `returnFocusRef`.
- `components/ShareLinkDisplay.test.tsx` — Scenario 10/11 (copy success → "Copied! ✓" for 2s via `vi.useFakeTimers`, then reverts; copy failure → destructive toast, label unchanged), Scenario 12–15 (Revoke click → inline confirm shown, no request yet; confirm → `DELETE` called, cancel → no request and link still shown; revoke failure → destructive toast, link still shown), Scenario 16 (`ViewCounterBadge` shows `viewCount`).
- `components/SharedNoteContent.test.tsx` — renders TipTap output for given HTML content, confirms no toolbar/editable surface is present.
- `components/SharedNoteErrorState.test.tsx` — each of the three variants renders its expected copy; `error` variant omits the register CTA, the other two include it.
- `pages/SharedNotePage.test.tsx` — Scenario 19 (success renders title/content/author/date, no tags/id/email anywhere in the DOM), Scenario 21 (loading → `SharedNoteSkeleton`), Scenario 24/25/26 (404/410/other error → the matching `SharedNoteErrorState` variant), Scenario 23 (renders identically regardless of `useAuthStore`'s authenticated state — assert no conditional branch on auth).
- `pages/EditorPage.test.tsx` (extended) — clicking "Share" (via the extended `ActionHeader` mock) opens `ShareModal` with `noteId` matching the route.

**E2E (`tests/e2e/`):** extend with a `share.spec.ts` covering UX §7.8's golden path — open a note, click Share, generate a link with the default expiry, copy it, open the URL in a fresh (unauthenticated) browser context, confirm the read-only view renders with no edit controls, then go back and revoke the link, confirming the shared URL now 404s.

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

- No backend changes to any of the four share endpoints, token generation, atomic view-count increment, or the one-link-per-note constraint — AB-1008 (done).
- No "History" `ActionHeader` wiring or version history UI — AB-1015.
- No dedicated "manage all my share links" screen — `GET /api/shares` is consumed here only as the per-note existing-link check, never rendered as its own list view.
- No analytics/view-count breakdowns beyond the simple counter the backend already returns.

---

Not proceeding to implementation — awaiting approval.
