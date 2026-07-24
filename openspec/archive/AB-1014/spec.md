# AB-1014 — Frontend Share Modal + Public View Spec

## 1. Ticket

- **ID:** AB-1014
- **Title:** Frontend Sharing (Share Modal + Public Shared Note View)
- **Dependencies:**
  - AB-1008 (Backend Sharing) — confirmed complete (`openspec/archive/AB-1008`). All four endpoints are consumed as-is: `POST /api/notes/:id/share`, `DELETE /api/notes/:id/share`, `GET /api/shares`, `GET /api/shared/:token`. Types/schemas already exist in `packages/shared` (`share.schemas.ts`, `share.types.ts`) — no new shared package work. Confirmed backend behaviors this ticket relies on: generating is idempotent (an existing active link is returned unchanged, not duplicated — AB-1008 Scenario 3), revoking hard-deletes the row (Scenario 15), and `GET /api/shared/:token` returns a minimal `{title, content, authorName, createdAt}` shape with no `id`/`tags`/version data (Scenario 10).
  - AB-1012 (Frontend Note Editor) — confirmed complete (`openspec/archive/AB-1012`, merged via PR #12). `ActionHeader` already renders a "Share" menu item wired to an optional `onShare?: () => void` prop (currently `undefined` in `EditorPage.tsx`, so the item renders disabled) — this ticket supplies that handler. The reusable `Dialog` primitive (`components/ui/dialog.tsx`) and the `DeleteNoteDialog` `returnFocusRef` pattern (focus returns to the "More actions" trigger button on close) are the established precedent to follow for the new Share modal.
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-SHARE-001 | The system SHALL allow authenticated users to generate a public read-only share link for a note, with a configurable expiry period (frontend: Share modal generate flow, expiry dropdown, existing-link reuse). |
| FR-SHARE-002 | The system SHALL allow anyone with a valid share link to view the note in read-only mode (frontend: public `SharedNotePage`, loading/expired/not-found states). |
| FR-SHARE-003 | The system SHALL allow the note owner to revoke an active share link (frontend: Revoke button + confirmation). |

**Supporting mechanic (not a primary deliverable, but required to satisfy UX-SCR-011's "Has active share link?" check per UX §7.8):** `GET /api/shares` (FR-SHARE-004, already implemented by AB-1008) is called by the Share modal to determine whether the note already has an active link before deciding whether to show the expiry-selection view or the link-display view.

**Business rules in scope:** BR-002 (a user only ever sees/edits their own notes — enforced server-side; a foreign/nonexistent note returns `404 NOTE_NOT_FOUND` from the share endpoints, mirrored generically in the UI). BR-006 (one active share link per note, enforced server-side — the frontend never needs to prevent a second "Generate"). BR-020 (atomic view count — frontend only displays the number it's given).

**Explicitly not re-litigated (already covered by AB-1008):** token generation/uniqueness, atomic view-count increment, one-link-per-note enforcement, expiry validation range (1–720 hours), and the `404`/`410`/`401`/`422` backend contract — all proven server-side; this ticket only needs to render what the API already guarantees and send well-formed requests.

## 3. Scenarios

### Opening the Share Modal & Existing-Link Detection (UX-SCR-011, FR-SHARE-001, UX §7.8)

**Scenario 1 — "Share" menu item opens the modal**
- **Given** the user is on the Note Editor (`/notes/:id`) for an existing (non-new) note
- **When** the user opens the "More actions" menu and selects "Share"
- **Then** the Share modal opens as a centered overlay (480px width on desktop, per UX §8.11).

**Scenario 2 — No existing active link shows the generate form**
- **Given** the note has no active `ShareLink`
- **When** the Share modal opens
- **Then** the modal checks for an existing link via `GET /api/shares` and, finding none for this note, shows the `ExpiryDropdown` and a "Generate Link" button (UX §7.8 `CheckExisting` → "No" branch).

**Scenario 3 — Existing active link shows the link display directly**
- **Given** the note already has an active (non-expired) `ShareLink`
- **When** the Share modal opens
- **Then** the modal finds the matching entry in `GET /api/shares` (by `noteId`) and immediately renders `ShareLinkDisplay` with the share URL, "Copy Link", "Revoke Link", and the view count — skipping the expiry-selection step (UX §7.8 `CheckExisting` → "Yes" branch).

**Scenario 4 — Loading state while checking for an existing link**
- **Given** the Share modal has just opened
- **When** `GET /api/shares` has not yet resolved
- **Then** a loading indicator is shown in place of both the generate form and the link display (UX §8.11 Loading States).

**Scenario 5 — Existing-link check fails**
- **Given** the Share modal has just opened
- **When** `GET /api/shares` fails (network error or 5xx)
- **Then** the modal shows the inline error "Failed to generate share link." (UX §8.11 Error States) — no generate form or link display is shown, and the user can close and reopen the modal to retry.

### Generating a Share Link (FR-SHARE-001)

**Scenario 6 — Successful generation with the default expiry**
- **Given** the generate form is shown with the default expiry option selected
- **When** the user clicks "Generate Link" without changing the expiry
- **Then** the client calls `POST /api/notes/:id/share` with an empty body (letting the server apply its default), and on `201` renders `ShareLinkDisplay` with the returned `url`, `expiresAt`, and `viewCount: 0`.

**Scenario 7 — Successful generation with a custom expiry**
- **Given** the generate form is shown
- **When** the user selects a non-default expiry option (e.g. 24 hours) and clicks "Generate Link"
- **Then** the client calls `POST /api/notes/:id/share` with `{expiresInHours: 24}` and, on `201`, renders `ShareLinkDisplay` with the returned link metadata.

**Scenario 8 — Generate button shows a loading state**
- **Given** the user has clicked "Generate Link"
- **When** the request is in flight
- **Then** the button shows a spinner and is disabled to prevent duplicate submissions (matching the `isLoading` pattern already used by `DeleteNoteDialog`'s confirm button).

**Scenario 9 — Generation fails**
- **Given** the user has clicked "Generate Link"
- **When** `POST /api/notes/:id/share` fails (network error or 5xx)
- **Then** the modal shows the inline error "Failed to generate share link." (UX §8.11 Error States) and remains on the generate form so the user can retry.

### Copying the Share Link (UX-SHARE-02)

**Scenario 10 — Copy Link succeeds**
- **Given** `ShareLinkDisplay` is shown with a share URL
- **When** the user clicks "Copy Link"
- **Then** the URL is written to the clipboard, the button label changes to "Copied! ✓" for exactly 2 seconds before reverting, and the status change is announced via `aria-live="polite"` (UX §8.11 Success States / Accessibility Notes).

**Scenario 11 — Copy Link fails**
- **Given** `ShareLinkDisplay` is shown with a share URL
- **When** the clipboard write rejects (e.g. denied permission or non-secure context)
- **Then** a toast "Failed to copy link. Please copy manually." is shown and the button label does not change to "Copied! ✓".

### Revoking a Share Link (FR-SHARE-003, per FRS AB-1014 scope "Revoke Link with confirmation")

**Scenario 12 — Revoke requires confirmation**
- **Given** `ShareLinkDisplay` is shown with an active link
- **When** the user clicks "Revoke Link"
- **Then** a confirmation step is shown before any request is sent (mirroring the `DeleteNoteDialog` confirm-before-destructive-action pattern) — no `DELETE` request fires yet.

**Scenario 13 — Confirming revoke succeeds**
- **Given** the revoke confirmation is shown
- **When** the user confirms
- **Then** the client calls `DELETE /api/notes/:id/share`, and on `200` the modal reverts to the empty state "No active share link for this note." (UX §8.11 Empty States) alongside the generate form, ready to create a new link.

**Scenario 14 — Canceling the revoke confirmation**
- **Given** the revoke confirmation is shown
- **When** the user cancels/dismisses it
- **Then** no request is sent and `ShareLinkDisplay` continues showing the still-active link unchanged.

**Scenario 15 — Revoke fails**
- **Given** the user has confirmed revocation
- **When** `DELETE /api/notes/:id/share` fails (network error or 5xx)
- **Then** a toast "Failed to revoke share link. Please try again." is shown and `ShareLinkDisplay` continues showing the link (no optimistic removal).

### View Count Display (UX-SHARE-01)

**Scenario 16 — View count is shown for an active link**
- **Given** `ShareLinkDisplay` is rendered (either just-generated or pre-existing)
- **Then** a `ViewCounterBadge` displays the link's current `viewCount` (e.g. "12 views").

### Share Modal Accessibility & Keyboard (UX §8.11)

**Scenario 17 — Escape closes the modal**
- **Given** the Share modal is open (in any state)
- **When** the user presses `Escape`
- **Then** the modal closes and focus returns to the "More actions" trigger button in `ActionHeader` (mirroring `DeleteNoteDialog`'s `returnFocusRef` pattern, since this modal is also opened from a `DropdownMenuItem`, not a `DialogTrigger`).

**Scenario 18 — Tab order moves through the modal's interactive controls**
- **Given** the Share modal is open showing the generate form
- **When** the user presses `Tab` repeatedly
- **Then** focus moves through the expiry dropdown and "Generate Link" button in order (or, when a link is already shown, through "Copy Link" and "Revoke Link") without leaving the modal (focus trap, UX §8.11 Keyboard Navigation).

### Public Shared Note View — Success Path (UX-SCR-013, FR-SHARE-002)

**Scenario 19 — Valid token renders the read-only note**
- **Given** a valid, non-expired share token `tok1` for a note titled "Meeting Notes" with content and author "Jane Doe"
- **When** an anonymous or authenticated visitor navigates to `/shared/tok1`
- **Then** `GET /api/shared/tok1` is called, and on `200` the page renders the title, rendered rich-text content, author display name, and creation date inside a semantic `<article>` — with no edit toolbar, tag chips, version-history controls, note ID, or author email visible anywhere on the page (FRS AC-3/AC-6, UX §8.13).

**Scenario 20 — Content renders with correct rich-text formatting, not raw markup**
- **Given** the shared note's `content` contains rich-text HTML (headings, lists, code blocks, task list items) that was already sanitized server-side on save (`notes.content.ts`, AB-1004)
- **Then** the public view renders that formatting visually correct and non-editable — no toolbar, and no way to focus/edit the content region.

**Scenario 21 — Loading state**
- **Given** the visitor has just navigated to `/shared/:token`
- **When** `GET /api/shared/:token` has not yet resolved
- **Then** a full-page centered loading spinner is shown (UX §8.13 Loading States).

**Scenario 22 — CTA links to registration**
- **Given** the shared note has rendered successfully
- **Then** a footer CTA "Create your account" is shown, linking to `/register` (UX §8.13 Navigation).

**Scenario 23 — Authenticated visitors see the same public view**
- **Given** a visitor is currently logged in as some authenticated user (who may or may not own the note)
- **When** they navigate to `/shared/:token`
- **Then** the page renders the same read-only public view as an anonymous visitor — `/shared/:token` is not wrapped in `ProtectedRoute` and has no special "owner" rendering branch (already true in `App.tsx`; this ticket must not add one).

### Public Shared Note View — Error Paths (UX-SCR-013, FRS EC-1/EC-2)

**Scenario 24 — Token not found**
- **Given** no `ShareLink` exists for the requested token
- **When** `GET /api/shared/:token` responds `404 SHARE_LINK_NOT_FOUND`
- **Then** a full-page "Note not found" screen is shown with a CTA to register (UX §8.13 Error States / UX-SHARE-04's not-found counterpart).

**Scenario 25 — Share link expired**
- **Given** the share token exists but its link has expired
- **When** `GET /api/shared/:token` responds `410 SHARE_LINK_EXPIRED`
- **Then** a full-page "This link has expired" screen is shown with a clear expiry message and a CTA to register (UX-SHARE-04).

**Scenario 26 — Unexpected/server error**
- **Given** `GET /api/shared/:token` fails with a non-404/410 error (network error or 5xx)
- **Then** a generic full-page error state is shown (distinct copy from the 404/410 states) so the visitor isn't told the link "doesn't exist" when the real cause was a transient failure.

## 4. API / Interface Contract

Consumed as-is (no backend changes), all from AB-1008:

| Method | Path | Auth | Request Body / Params | Success Response | Error Responses |
| ------ | ---- | ---- | ---------------------- | ----------------- | ---------------- |
| POST | `/api/notes/:id/share` | Yes | `{expiresInHours?}` | `201 {shareLink}` | `404 NOTE_NOT_FOUND`, `422 VALIDATION_ERROR`, `401 TOKEN_*` |
| DELETE | `/api/notes/:id/share` | Yes | — | `200 {message}` | `404 NOTE_NOT_FOUND`, `404 SHARE_LINK_NOT_FOUND`, `401 TOKEN_*` |
| GET | `/api/shares` | Yes | — | `200 {shares}` | `401 TOKEN_*` |
| GET | `/api/shared/:token` | No | — | `200 {note}` | `404 SHARE_LINK_NOT_FOUND`, `410 SHARE_LINK_EXPIRED` |

All request/response types come from `@note-app/shared` (`CreateShareRequest`, `ShareLink`, `CreateShareResponse`, `RevokeShareResponse`, `ShareListItem`, `ListSharesResponse`, `SharedNoteView`, `GetSharedNoteResponse`) — no new schemas are added to `packages/shared` by this ticket.

## 5. State & Data Impact

- **New feature module `apps/frontend/src/features/share/`:** `share.api.ts` (thin `apiClient` wrappers for the four endpoints above), `share.hooks.ts` (`useSharesQuery`, `useCreateShareMutation`, `useRevokeShareMutation`, `useSharedNoteQuery`), and components `ShareModal`, `ShareLinkDisplay`, `ExpiryDropdown`, `ViewCounterBadge`, `RevokeConfirmDialog` (or a confirmation step inline in `ShareModal` — see Open Question 6).
- **`EditorPage.tsx` changes:** adds `shareModalOpen` state and passes `onShare={() => setShareModalOpen(true)}` to `ActionHeader`, plus renders `<ShareModal noteId={id} open={shareModalOpen} onOpenChange={setShareModalOpen} returnFocusRef={...} />` alongside the existing `DeleteNoteDialog`.
- **`apps/frontend/src/pages/SharedNotePage.tsx`:** currently a placeholder stub (`<h1>Shared Note</h1>`); this ticket builds it out fully. Already routed at `/shared/:token` in `App.tsx` with no `ProtectedRoute` wrapper — no routing changes needed.
- **TanStack Query keys:** `['shares', 'list']` (existing-link check, matches the key already referenced in SDS §21 cache-invalidation table for generate/revoke mutations) and a new `['shared', token]` key for the public note view (not invalidated by anything — it's a one-shot public read).
- **No new Prisma models, no backend changes, no new `packages/shared` schemas** — frontend-only, matching AB-1013's precedent.

## 6. Out of Scope

- Any backend changes to the four share endpoints, token generation, atomic view-count increment, or the one-link-per-note constraint — AB-1008 (done); this ticket only renders and calls what already exists.
- The "History" `ActionHeader` menu item and version history UI — AB-1015.
- `ActionHeader`/`ProtectedRoute`/`Dialog` primitive changes beyond wiring the new `onShare` handler — those components already exist from AB-1012/AB-1010.
- Analytics or breakdowns of view counts (unique visitors, referrers, etc.) — FRS only requires displaying the simple counter the backend already returns.
- A dedicated "manage all my share links" screen — `GET /api/shares` is consumed here only as the existing-link check backing the per-note Share modal, not as a standalone list view (no such screen exists in the UX inventory).

## 7. Open Questions for `/plan`

1. **Existing-link detection mechanism (Scenarios 2–5):** confirm calling `GET /api/shares` and filtering client-side by `noteId` on modal open is the intended approach (vs., e.g., relying on `POST`'s idempotent "return existing link" behavior as an implicit check) — the `GET /api/shares` approach avoids ever sending a `POST` before the user has chosen an expiry or clicked "Generate," which better matches UX §7.8's explicit `CheckExisting` decision point preceding `SelectExpiry`.
2. **Expiry dropdown preset options:** FRS/UX specify only the valid range (1 hour – 30 days / 720 hours) and that it's a dropdown, not the exact preset list. Needs a concrete set, e.g. `1 hour`, `24 hours`, `7 days` (default, matches the backend's 168-hour default), `30 days`.
3. **Public content rendering approach (Scenario 20):** decide whether `SharedNotePage` renders `content` via a read-only TipTap instance (`editable: false`, reusing `buildEditorExtensions()` for exact visual parity with the editor) or via sanitized `dangerouslySetInnerHTML`. Server-side sanitization already exists (`notes.content.ts`), so either is safe from an XSS standpoint; the read-only-TipTap approach guarantees the same rendering (task lists, code blocks, etc.) as the editor with no separate CSS/markup path to maintain.
4. **Reusing `formatUpdatedAt` from `features/notes/notes.utils.ts`** for `expiresAt`/`createdAt` display in the Share modal and public view, vs. a local date formatter in the new `features/share/` module — AB-1013 established precedent for cross-feature reuse (it imports `PaginationControls` directly from `features/notes`), so reuse is consistent with that, but confirm since `formatUpdatedAt`'s name is note-specific.
5. **Clipboard fallback (Scenario 11):** confirm the exact fallback UX when `navigator.clipboard.writeText` is unavailable/rejected (no existing clipboard-write precedent elsewhere in the codebase to follow) — toast copy above is a proposal, not a confirmed spec.
6. **Revoke confirmation UI shape (Scenarios 12–14):** decide whether this is a second `Dialog` (`RevokeConfirmDialog`, mirroring `DeleteNoteDialog`'s separate-component pattern) or an inline two-step state within `ShareModal` itself (e.g. the "Revoke Link" button becomes "Confirm revoke?" / "Cancel" for a few seconds) — UX §8.11 only says "Revoke Link" is a component in the modal's list, not a separate confirmation dialog, so an inline pattern may be more faithful to the screen spec than stacking a second modal.
