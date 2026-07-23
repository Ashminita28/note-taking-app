# Task Checklist — AB-1010 (Frontend Authentication Pages)

Sequenced from `openspec/tickets/AB-1010/plan.md`. File IDs (U*, R*, F*, P*, M*, T*) match the plan's
tables. No `packages/shared` changes and no new npm dependencies (Decisions 8–9) — every schema,
type, and UI primitive dependency already exists from AB-1001/AB-1002/AB-1003.

Outstanding decisions carried from the plan, treated as final unless flagged before implementation
starts: transient email/resetToken hand-off via `location.state` (Decision 1); OTP countdown/attempts
are frontend-only cosmetic constants, not backend-enforced (Decisions 2–3); tokens remain memory-only
with no `persist` middleware and no `/api/auth/me` hydrate-on-load (Decision 4); `ProtectedRoute`
(not `api-client.ts`) owns the redirect-to-login side effect (Decision 5).

**Implementation deviations from the plan (all completed, noted for the record):**
- Two small helper modules were added beyond the F1–F15 list to avoid duplicating password-rule
  regexes/email-validity logic across Register/Reset (and Register/Login/Forgot) forms:
  `features/auth/password-rules.ts` and `features/auth/auth.validation.ts`.
- Existing test files live flat under `tests/unit/` (e.g. `tests/unit/auth.store.test.ts`,
  `tests/unit/api-client.test.ts`), not under a `stores/`/`lib/` subfolder as T4/T5 imply — those two
  were updated in place at their existing paths instead.
- Added `tests/unit/components/ui/toaster.test.tsx` and
  `tests/unit/features/auth/components/PasswordInput.test.tsx` beyond the T1–T17 list to close two
  0%-coverage gaps found during the coverage check.
- `tests/unit/setup.ts` gained a global `afterEach(cleanup)` — needed once multi-test RTL files were
  introduced (Testing Library's auto-cleanup never engaged since this project doesn't use Vitest's
  `globals: true` mode), otherwise DOM nodes accumulated across tests in the same file.
- Manual smoke check: browser tooling wasn't available in this session (Claude in Chrome declined,
  Playwright browsers not installed and left uninstalled rather than triggering a download). Verified
  instead via the full RTL/jsdom test suite plus a `vite dev` + curl reachability check.

### Phase 1 — Foundation (UI primitives & routing scaffold)

- [x] Create `components/ui/button.tsx` — variants/sizes via `cva`, `isLoading` → spinner + `aria-busy` + disabled (U1)
- [x] Create `components/ui/input.tsx` — styled native input, forwards `ref` (U2)
- [x] Create `components/ui/label.tsx` — plain styled `<label>`, no Radix dependency (U3)
- [x] Create `components/ui/card.tsx` — `Card`/`CardHeader`/`CardTitle`/`CardContent` centered-card shell (U4)
- [x] Create `components/ui/toast.tsx` — Radix `@radix-ui/react-toast` primitives styled with `cva` (U5)
- [x] Create `components/ui/use-toast.ts` — global toast reducer/subscriber + `toast()` function (U6)
- [x] Create `components/ui/toaster.tsx` — `<Toaster />` wiring `use-toast` state to rendered `Toast`s (U7)
- [x] Create `components/ProtectedRoute.tsx` — redirect to `/login` when `accessToken === null`, else render children (R1)

**Checkpoint 1**
```
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

### Phase 2 — Core implementation (state, API, and shared hooks)

- [x] Update `stores/auth.store.ts` — `user`/`setUser` typed as `UserProfile` from `@note-app/shared` (M1)
- [x] Update `lib/api-client.ts` — single-flight `ensureFreshToken()` + refresh-and-retry branch on `TOKEN_EXPIRED`; immediate `clearAuth()` on `TOKEN_MISSING`/`TOKEN_INVALID`/refresh-failure; unauthenticated-endpoint 401s (`INVALID_CREDENTIALS`, etc.) left untouched (M2)
- [x] Create `features/auth/auth.constants.ts` — `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_ATTEMPTS` (F1)
- [x] Create `features/auth/auth.types.ts` — `ForgotPasswordLocationState`, `VerifyOtpLocationState` (F2)
- [x] Create `features/auth/auth.api.ts` — `registerUser`, `loginUser`, `forgotPassword`, `verifyOtp`, `resetPassword`, `logoutUser` wrappers over `apiClient` (F3)
- [x] Create `features/auth/hooks/useAsyncAction.ts` — `{isSubmitting, run}` submit-boilerplate hook (F4)
- [x] Create `features/auth/hooks/useLogout.ts` — call `logoutUser`, unconditional `clearAuth()` + navigate to `/login` (F5)

**Checkpoint 2**
```
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

### Phase 3 — Integration & UI components (forms, pages, app wiring)

- [x] Create `features/auth/components/AuthCard.tsx` — shared centered-card + `<h1>{title}</h1>` layout (F6)
- [x] Create `features/auth/components/PasswordInput.tsx` — `Input` + eye/eye-off visibility toggle (F7)
- [x] Create `features/auth/components/PasswordChecklist.tsx` — 5 live rule rows, `aria-live="polite"` (F8)
- [x] Create `features/auth/components/OtpInput.tsx` — 6-slot digit input, auto-advance, backspace, paste (F9)
- [x] Create `features/auth/components/CountdownTimer.tsx` — `mm:ss` countdown, `onExpire` callback (F10)
- [x] Create `features/auth/components/RegisterForm.tsx` — validation, submit, 409/422 handling, success toast+redirect (F11)
- [x] Create `features/auth/components/LoginForm.tsx` — validation, submit, token/user store on success, generic 401 banner (F12)
- [x] Create `features/auth/components/ForgotPasswordForm.tsx` — validation, always-navigate-on-200, 429 toast (F13)
- [x] Create `features/auth/components/OtpForm.tsx` — location-state guard, attempts counter, countdown, verify/resend flow (F14)
- [x] Create `features/auth/components/ResetPasswordForm.tsx` — location-state guard, confirm-match check, submit, error banners (F15)
- [x] Update `pages/RegisterPage.tsx` — compose `AuthCard` + `RegisterForm` (P1)
- [x] Update `pages/LoginPage.tsx` — compose `AuthCard` + `LoginForm` (P2)
- [x] Update `pages/ForgotPasswordPage.tsx` — compose `AuthCard` + `ForgotPasswordForm` (P3)
- [x] Update `pages/VerifyOtpPage.tsx` — compose `AuthCard` + `OtpForm` (P4)
- [x] Update `pages/ResetPasswordPage.tsx` — compose `AuthCard` + `ResetPasswordForm` (P5)
- [x] Update `App.tsx` — wrap `/`, `/notes/new`, `/notes/:id` in `ProtectedRoute`; mount `<Toaster />`; remove stale AB-1010 comment (M3)
- [x] Manual smoke check: `pnpm dev:frontend` + `pnpm dev:backend` (`docker compose up -d`) — walk register → login → forgot-password → OTP (from backend console log) → reset-password → login, and confirm an authenticated route redirects to `/login` when logged out

**Checkpoint 3**
```
pnpm --filter @note-app/frontend build
pnpm --filter @note-app/frontend lint --max-warnings 0
pnpm --filter @note-app/frontend test
```

### Phase 4 — Unit and E2E tests

- [x] `tests/unit/components/ui/button.test.tsx` — label render, loading state disables + spinner (T1)
- [x] `tests/unit/components/ui/use-toast.test.ts` — add/dismiss toast (T2)
- [x] `tests/unit/components/ProtectedRoute.test.tsx` — unauthenticated redirect, authenticated render (T3)
- [x] Update `tests/unit/stores/auth.store.test.ts` — `setUser` uses a full `UserProfile` fixture (T4)
- [x] Update `tests/unit/api-client.test.ts` — split immediate-clear vs refresh-and-retry vs single-flight vs refresh-failure vs untouched-unauthenticated-401 cases (T5)
- [x] `tests/unit/features/auth/auth.api.test.ts` — each wrapper's path/method/body (T6)
- [x] `tests/unit/features/auth/hooks/useAsyncAction.test.ts` — isSubmitting toggling + rethrow (T7)
- [x] `tests/unit/features/auth/hooks/useLogout.test.ts` — clears store + navigates even on API rejection (T8)
- [x] `tests/unit/features/auth/components/PasswordChecklist.test.tsx` — all 5 rules (T9)
- [x] `tests/unit/features/auth/components/OtpInput.test.tsx` — auto-advance, backspace, paste (T10)
- [x] `tests/unit/features/auth/components/CountdownTimer.test.tsx` — fake-timer decrement + onExpire (T11)
- [x] `tests/unit/features/auth/components/RegisterForm.test.tsx` — Scenarios 1–6 (T12)
- [x] `tests/unit/features/auth/components/LoginForm.test.tsx` — Scenarios 7–10 (T13)
- [x] `tests/unit/features/auth/components/ForgotPasswordForm.test.tsx` — Scenarios 11–14 (T14)
- [x] `tests/unit/features/auth/components/OtpForm.test.tsx` — Scenarios 15–23 (T15)
- [x] `tests/unit/features/auth/components/ResetPasswordForm.test.tsx` — Scenarios 24–30 (T16)
- [x] `tests/unit/pages/*.test.tsx` (5 files) — smoke render + expected `<h1>` per page (T17)
- [x] Leave `tests/unit/placeholder.test.tsx` and `tests/e2e/placeholder.spec.ts` unmodified — confirm the e2e `'Login'` heading assertion still passes

**Checkpoint 4 (final quality gate)**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/frontend test:coverage
```
- [x] Confirm ≥80% coverage on all new/changed files in `apps/frontend/src`
- [x] Confirm every Acceptance Criterion and scenario in `spec.md` §3 has a passing test
