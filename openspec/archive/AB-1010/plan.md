# Technical Plan — AB-1010 (Frontend Authentication Pages)

Traces every file to a scenario in `openspec/tickets/AB-1010/spec.md`. Follows the feature-based
frontend architecture (`src/pages/` → `src/features/<name>/` → `src/components/ui/`, Zustand for
auth/UI state, React state for form inputs, TanStack Query reserved for server-cached reads) defined
in `apps/frontend/CLAUDE.md` and SDS §8.

## 0. Architecture Decisions

1. **Transient hand-off state (spec Open Question 1, resolved):** use React Router `location.state`.
   `ForgotPasswordForm` navigates to `/verify-otp` with `state: { email }`; `OtpForm` navigates to
   `/reset-password` with `state: { resetToken }`. Each page reads `useLocation().state` and, if the
   expected key is missing (direct nav / hard refresh — state does not survive a reload), redirects
   back a step (`/forgot-password` or `/verify-otp` respectively) per Scenarios 23/30. This requires
   no new store and correctly self-destructs on refresh, matching the "bounce back" requirement.
2. **OTP countdown duration (Open Question 2, resolved):** a frontend-only constant
   `OTP_RESEND_COOLDOWN_SECONDS = 600` in `features/auth/auth.constants.ts`, documented as coupled by
   convention to the backend's `OTP_EXPIRY_MINUTES` default (10 min, SDS §7 env table). Not a shared
   contract (backend never sends this value), so it does **not** go in `packages/shared`.
3. **Remaining-attempts counter (Open Question 3, resolved):** `OTP_MAX_ATTEMPTS = 5` client-side
   constant in the same file, decremented in local component state on each `401 INVALID_OTP`, reset on
   mount and on resend. Cosmetic only, as flagged in the spec — the real limit is the backend's
   `OTP_VERIFY_RATE_LIMIT`.
4. **Session persistence (Open Question 4, resolved):** no `persist` middleware on `useAuthStore`.
   Tokens are memory-only (SDS §7.2), so a hard refresh always lands on `ProtectedRoute`'s
   unauthenticated branch. Consequently **this ticket does not add a `GET /api/auth/me`
   hydrate-on-boot call** — there is nothing to hydrate from after a reload. `MeResponseSchema` stays
   unused by the frontend until a future ticket revisits persistence.
5. **`ProtectedRoute` triggers the redirect for the refresh-failure case (Scenario 34), not the API
   client.** `api-client.ts` only ever mutates `useAuthStore` (clears tokens on unrecoverable 401s); it
   never touches `window.location` or the router. `ProtectedRoute` subscribes to the store
   (`useAuthStore((s) => s.accessToken !== null)`), so a `clearAuth()` call from anywhere triggers an
   automatic re-render and `<Navigate to="/login" replace />` on the next render pass. This keeps
   `api-client.ts` a pure fetch wrapper (still unit-testable without a Router) and reuses the same
   mechanism as a normal unauthenticated page load.
6. **Refresh-and-retry algorithm in `api-client.ts`** (Scenarios 32–34): a request that gets back
   `401 TOKEN_EXPIRED` (and is not itself a retry, and is not the `/auth/refresh` call) triggers a
   single-flight `ensureFreshToken()`: if a refresh is already in flight, await the same promise
   instead of starting a second one (Scenario 33); otherwise POST to `/auth/refresh` with the stored
   `refreshToken` via a raw `fetch` (bypassing `request()` to avoid recursive interception). On success
   it calls `setTokens(...)` and the original request is retried exactly once with the new access
   token. On failure (`401 INVALID_REFRESH_TOKEN` / `REFRESH_TOKEN_EXPIRED`, or no `refreshToken`
   stored) it calls `clearAuth()` and rethrows, which the original caller propagates as an `ApiError`
   (ProtectedRoute then redirects per Decision 5). Any other 401 code (`TOKEN_MISSING`,
   `TOKEN_INVALID`) clears auth immediately with no refresh attempt (there is no token worth
   refreshing around). `401 INVALID_CREDENTIALS` and `401 INVALID_OTP`/`INVALID_RESET_TOKEN` are left
   untouched — those come from unauthenticated endpoints and must not mutate the auth store.
7. **Forms use plain React state + shared Zod schemas**, no `react-hook-form` (not in the dependency
   tree, and `apps/frontend/CLAUDE.md` mandates React state for inputs). Each field is validated
   on-blur/on-submit via `SomeRequestSchema.safeParse(...)`/`.pick({field: true})` against the schemas
   already in `@note-app/shared` — no duplicated validation logic (CON-003).
8. **No new npm dependencies.** `@radix-ui/react-toast`, `class-variance-authority`, `clsx`,
   `tailwind-merge`, and `lucide-react` are already installed and cover every primitive this ticket
   needs (toast, button/input variants, icons). `components/ui/label.tsx` is implemented as a plain
   styled `<label>` (no `@radix-ui/react-label` needed for a static label with no `asChild` use case).
9. **`packages/shared` requires no changes.** Every request/response schema (`RegisterRequestSchema`
   … `ResetPasswordResponseSchema`) and `UserProfile` type already exist from AB-1002/AB-1003 and are
   exported through the barrel — this ticket only consumes them.

## 1. `apps/frontend/src/components/ui/` — Base Primitives (new)

None of these exist yet (no ticket has created `components/ui/`); built minimally to what the five
auth screens need, not a general design-system pass.

| # | Path | Description |
|---|------|-------------|
| U1 | `components/ui/button.tsx` | `cva`-based variants (`default`, `outline`, `ghost`, `link`) and sizes, forwarding `ref`. Accepts `isLoading?: boolean` — renders a `lucide-react` `Loader2` (spinning) before the label and sets `disabled` and `aria-busy="true"` while loading (Scenario 37, UX-AUTH-06). |
| U2 | `components/ui/input.tsx` | Styled `<input>` forwarding all native props + `ref`; `aria-invalid` styling hook via `className`/`data-invalid` passed from callers. |
| U3 | `components/ui/label.tsx` | Styled `<label htmlFor>`; plain semantic element, no Radix dependency. |
| U4 | `components/ui/card.tsx` | `Card`/`CardHeader`/`CardTitle`/`CardContent` — the "centered card, max 420px, 16px mobile padding" shell reused by all 5 auth screens (UX §8.1–8.5 Responsive Behavior). |
| U5 | `components/ui/toast.tsx` | Radix `@radix-ui/react-toast` primitives (`ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`) styled with `cva` (default/destructive variants), shadcn-standard shape. |
| U6 | `components/ui/use-toast.ts` | Global toast store (reducer + subscriber list, shadcn's standard non-context `useToast()`/`toast()` pattern) so `toast({title, variant})` can be called from anywhere (form submit handlers), not just inside a provider subtree. |
| U7 | `components/ui/toaster.tsx` | `<Toaster />` — renders `ToastProvider` + maps the `use-toast` state to `<Toast>` items + `<ToastViewport />`. Mounted once in `App.tsx`. |

## 2. `apps/frontend/src/components/` — Cross-Cutting Routing

| # | Path | Description |
|---|------|-------------|
| R1 | `components/ProtectedRoute.tsx` | `{ children: ReactNode }` → reads `useAuthStore((s) => s.accessToken !== null)`; renders `<Navigate to="/login" replace />` when `false`, otherwise `children` (Scenario 35). No `GET /api/auth/me` call (Decision 4). |

## 3. `apps/frontend/src/features/auth/` — Feature Module (new)

| # | Path | Description |
|---|------|-------------|
| F1 | `features/auth/auth.constants.ts` | `OTP_RESEND_COOLDOWN_SECONDS = 600`, `OTP_MAX_ATTEMPTS = 5` (Decisions 2–3). |
| F2 | `features/auth/auth.types.ts` | Local (non-shared) types: `ForgotPasswordLocationState { email: string }`, `VerifyOtpLocationState { resetToken: string }` — router `location.state` shapes, not cross-FE/BE contracts, so they stay out of `packages/shared` per its CLAUDE.md scope. |
| F3 | `features/auth/auth.api.ts` | Thin wrappers over `apiClient.request`, one per endpoint: `registerUser`, `loginUser`, `forgotPassword`, `verifyOtp`, `resetPassword`, `logoutUser` — each typed with the matching `@note-app/shared` request/response type. No store side effects here (forms decide what to do with the result); keeps this module trivially unit-testable with a mocked `apiClient`. |
| F4 | `features/auth/hooks/useAsyncAction.ts` | `{ isSubmitting, run }` — `run(fn)` sets `isSubmitting` around `await fn()` and rethrows on failure so the caller's own `try/catch` maps `ApiError.code` to field/banner messages. Shared boilerplate across all 5 forms (Scenario 37). |
| F5 | `features/auth/hooks/useLogout.ts` | `() => Promise<void>` — calls `logoutUser({refreshToken})` (swallowing any API error, per AB-1003/AB-1002's idempotent-logout contract), then unconditionally `clearAuth()` and navigates to `/login` (Scenario 36). Not wired to a button yet (no `UserMenu` until AB-1011) — exposed for that ticket to consume. |
| F6 | `features/auth/components/AuthCard.tsx` | Wraps `Card` (U4) with the shared centered-card layout + `<h1>{title}</h1>`, used by all 5 pages. |
| F7 | `features/auth/components/PasswordInput.tsx` | `Input` (U2) + trailing eye/eye-off (`lucide-react`) toggle button flipping `type="password" | "text"`; used by Register and Reset forms. |
| F8 | `features/auth/components/PasswordChecklist.tsx` | `{ password: string }` → 5 live rule rows (≥8 chars, uppercase, lowercase, digit, special char — mirrors `isStrongPassword` from `@note-app/shared`) each with a check/x icon, wrapped in `aria-live="polite"` (Scenario 2, UX-AUTH-01). |
| F9 | `features/auth/components/OtpInput.tsx` | `{ value: string, onChange: (v: string) => void, length?: number }` → 6 individual digit `<input>`s (`inputMode="numeric"`, `maxLength={1}`, `aria-label="Digit X of 6"`), auto-advance on type, `Backspace` moves focus back, full-string paste fills all slots (Scenario 15). |
| F10 | `features/auth/components/CountdownTimer.tsx` | `{ totalSeconds: number, onExpire: () => void }` → `mm:ss` countdown via `setInterval`/cleanup, `aria-live="polite"`, calls `onExpire` once at zero (Scenario 20). |
| F11 | `features/auth/components/RegisterForm.tsx` | Local state per field + `RegisterRequestSchema.safeParse` for validation (Scenario 3); submit via `useAsyncAction` + `registerUser`; success → `toast()` + `navigate('/login')` (Scenario 1); `409 EMAIL_ALREADY_EXISTS` → banner (Scenario 4); `422` → per-field errors from `details[]` (Scenario 5). Uses `PasswordInput` + `PasswordChecklist`. |
| F12 | `features/auth/components/LoginForm.tsx` | Local state, required-field validation only (Scenario 9) via `LoginRequestSchema`; submit via `useAsyncAction` + `loginUser`; success → `setTokens` + `setUser` + `navigate('/')` (Scenario 7, no toast); `401 INVALID_CREDENTIALS` → one generic `aria-live="assertive"` banner, email preserved (Scenario 8). |
| F13 | `features/auth/components/ForgotPasswordForm.tsx` | Email field + `ForgotPasswordRequestSchema` validation (Scenario 12); submit via `useAsyncAction` + `forgotPassword`; on any `200` → `navigate('/verify-otp', {state: {email}})` (Scenario 11); `429 OTP_RATE_LIMIT` → toast, stays put (Scenario 13). |
| F14 | `features/auth/components/OtpForm.tsx` | Reads `email` from `location.state` (redirect to `/forgot-password` if absent, Scenario 23); owns `OtpInput` value, attempts-remaining counter (F1's `OTP_MAX_ATTEMPTS`), and a `CountdownTimer` (F1's `OTP_RESEND_COOLDOWN_SECONDS`); submit via `useAsyncAction` + `verifyOtp` → success navigates to `/reset-password` with `{state: {resetToken}}` (Scenario 16); `401 INVALID_OTP` → shake + decrement counter (Scenario 17); `410 OTP_EXPIRED` → disable Verify, show Resend (Scenario 18); Resend calls `forgotPassword` again, resets counter + timer + input (Scenario 19). |
| F15 | `features/auth/components/ResetPasswordForm.tsx` | Reads `resetToken` from `location.state` (redirect to `/forgot-password` if absent, Scenario 30); new-password + confirm fields, `ResetPasswordRequestSchema` for complexity (Scenario 26) plus a local equality check for confirm (Scenario 25); submit via `useAsyncAction` + `resetPassword` → success toast + `navigate('/login')` (Scenario 24); `410 RESET_TOKEN_EXPIRED` / `401 INVALID_RESET_TOKEN` → banner directing back to `/forgot-password` (Scenarios 27, 29); `422 PASSWORD_SAME_AS_CURRENT` → banner (Scenario 28). |

## 4. `apps/frontend/src/pages/` — Modify Existing Stubs

Each currently renders only `<main><h1>...</h1></main>` (AB-1001 scaffold). Each becomes a thin
composition of `AuthCard` + its form, preserving the existing `<h1>` text so it stays the accessible
page heading (and keeps `tests/e2e/placeholder.spec.ts`'s `heading name: 'Login'` assertion valid).

| # | Path | Change |
|---|------|--------|
| P1 | `pages/RegisterPage.tsx` | `<AuthCard title="Register"><RegisterForm /></AuthCard>` + nav link to `/login`. |
| P2 | `pages/LoginPage.tsx` | `<AuthCard title="Login"><LoginForm /></AuthCard>` + nav links to `/register`, `/forgot-password`. |
| P3 | `pages/ForgotPasswordPage.tsx` | `<AuthCard title="Forgot Password"><ForgotPasswordForm /></AuthCard>` + nav link to `/login`. |
| P4 | `pages/VerifyOtpPage.tsx` | `<AuthCard title="Verify OTP"><OtpForm /></AuthCard>` + nav link to `/forgot-password`. |
| P5 | `pages/ResetPasswordPage.tsx` | `<AuthCard title="Reset Password"><ResetPasswordForm /></AuthCard>`. |

## 5. Modify — Existing Cross-Cutting Files

| # | Path | Change |
|---|------|--------|
| M1 | `stores/auth.store.ts` | `user: unknown \| null` → `user: UserProfile \| null` (import from `@note-app/shared`); `setUser(user: unknown)` → `setUser(user: UserProfile)`. Removes the stub comment (Scenario 31 — no `persist` middleware added). |
| M2 | `lib/api-client.ts` | Implement the refresh-and-retry algorithm from Decision 6: add a private `refreshPromise` field, `ensureFreshToken()`, and branch the existing `response.status === 401` block on `payload?.error?.code` as described. `request()` gains an internal `isRetry` parameter (not part of the public `RequestConfig`). |
| M3 | `App.tsx` | Wrap `/`, `/notes/new`, `/notes/:id` routes' elements in `<ProtectedRoute>`; mount `<Toaster />` (U7) once inside `QueryClientProvider`; remove the now-stale "Auth-required route protection is wired up by AB-1010" comment. |

## 6. Tests — `apps/frontend`

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| T1 | `tests/unit/components/ui/button.test.tsx` | New | Renders label; `isLoading` disables the button, sets `aria-busy`, and shows the spinner. |
| T2 | `tests/unit/components/ui/use-toast.test.ts` | New | `toast(...)` adds an entry subscribers receive; dismiss removes it. |
| T3 | `tests/unit/components/ProtectedRoute.test.tsx` | New | Unauthenticated → redirects to `/login` (assert via a `MemoryRouter` + a `/login` sentinel route); authenticated (`setTokens` called first) → renders `children`. |
| T4 | `tests/unit/stores/auth.store.test.ts` | Mod | Update `setUser` calls to a full `UserProfile` fixture (`{id, name, email}`) to match the new type (M1). |
| T5 | `tests/unit/api-client.test.ts` | Mod | Update the existing "clears auth on a 401" test to specifically cover `TOKEN_MISSING`/`TOKEN_INVALID` (immediate clear, no refresh attempt). Add: (a) `TOKEN_EXPIRED` → refresh succeeds → original request retried once with the new token; (b) two concurrent `TOKEN_EXPIRED` responses → only one `/auth/refresh` call made (single-flight); (c) `TOKEN_EXPIRED` → refresh itself fails → `clearAuth()` called, original error surfaced; (d) `401 INVALID_CREDENTIALS` on an unauthenticated call → store untouched. |
| T6 | `tests/unit/features/auth/auth.api.test.ts` | New | Each wrapper calls `apiClient.request` with the right `path`/`method`/`body` and returns its result (mocked `apiClient`). |
| T7 | `tests/unit/features/auth/hooks/useAsyncAction.test.ts` | New | `isSubmitting` toggles true→false around a resolving/rejecting `fn`; rejection rethrows. |
| T8 | `tests/unit/features/auth/hooks/useLogout.test.ts` | New | Calls `logoutUser`, clears store, navigates to `/login` even when `logoutUser` rejects. |
| T9 | `tests/unit/features/auth/components/PasswordChecklist.test.tsx` | New | Each of the 5 rules toggles independently for representative passwords. |
| T10 | `tests/unit/features/auth/components/OtpInput.test.tsx` | New | Typing auto-advances; `Backspace` on empty slot moves back; pasting a 6-digit string fills all slots and calls `onChange` with the full value. |
| T11 | `tests/unit/features/auth/components/CountdownTimer.test.tsx` | New | Uses fake timers: renders `mm:ss`, decrements, calls `onExpire` exactly once at zero. |
| T12 | `tests/unit/features/auth/components/RegisterForm.test.tsx` | New | Scenarios 1–6: happy path (mocked `registerUser` success → toast + navigate spy), each client validation message, `409`/`422` mapped to banner/field errors. |
| T13 | `tests/unit/features/auth/components/LoginForm.test.tsx` | New | Scenarios 7–10: happy path stores tokens + navigates to `/`, required-field messages, generic `401` banner with email preserved. |
| T14 | `tests/unit/features/auth/components/ForgotPasswordForm.test.tsx` | New | Scenarios 11–14: always-navigate-on-200 (known and unknown-email-shaped responses look identical to the client), invalid-email message, `429` toast without navigation. |
| T15 | `tests/unit/features/auth/components/OtpForm.test.tsx` | New | Scenarios 15–23 (fake timers for the countdown): paste/auto-advance delegated to F9's own tests but re-verified at integration level for the submit path; success navigates with `resetToken` state; `401` decrements the attempts counter and shows the message; `410` disables Verify and reveals Resend; Resend re-requests and resets counter/timer; missing `location.state.email` redirects to `/forgot-password`. |
| T16 | `tests/unit/features/auth/components/ResetPasswordForm.test.tsx` | New | Scenarios 24–30: happy path toast + navigate, mismatched-confirm message, weak-password checklist, `410`/`401`/`422` banners, missing `location.state.resetToken` redirects to `/forgot-password`. |
| T17 | `tests/unit/pages/RegisterPage.test.tsx` … `ResetPasswordPage.test.tsx` (5 files) | New | Thin smoke test per page: renders inside a `MemoryRouter` without throwing and shows the expected `<h1>`. Deeper behavior is covered at the form level (T12–T16). |

Existing `tests/unit/placeholder.test.tsx` (DashboardPage) and `tests/e2e/placeholder.spec.ts` are left
unmodified — the e2e heading assertion (`'Login'`) continues to pass because P2 preserves that text.

## 7. Build / Lint / Test Checkpoints

Run after the `components/ui` + `ProtectedRoute` blocks (U/R), before the feature module:
```
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
```

Run after the full `features/auth` module + page + cross-cutting modifications (F/P/M):
```
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
pnpm --filter @note-app/frontend test:coverage
```

Manual smoke check (per top-level CLAUDE.md UI-change guidance): `pnpm dev:frontend` and walk the
full register → login → forgot-password → OTP → reset flow in a browser against the running backend
(`pnpm dev:backend`, `docker compose up -d`), including the OTP console-log copy/paste path.

Final full-monorepo gate (CLAUDE.md mandatory quality gates) before commit:
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

## 8. Out of Scope (unchanged from spec.md)

- Backend changes of any kind — AB-1002/AB-1003 (done).
- Dashboard, editor, search, sharing, version-history UI — AB-1011 through AB-1015.
- Actual email delivery — OTP/verification emails remain console-logged only (CON-005).
- A general-purpose `src/components/ui/` design system beyond U1–U7.
- Persisted ("remember me") sessions across browser restarts (Open Question 4 / Decision 4).
- `GET /api/auth/me` wiring — no ticket currently needs it; left unused until one does.
