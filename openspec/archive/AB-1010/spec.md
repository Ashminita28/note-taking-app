# AB-1010 — Frontend Authentication Pages Spec

## 1. Ticket

- **ID:** AB-1010
- **Title:** Frontend Authentication Pages
- **Dependencies:** AB-1002 (Backend Authentication) — confirmed complete (`openspec/archive/AB-1002`, status: completed); AB-1003 (Backend Password Reset) — confirmed complete (`openspec/archive/AB-1003`, status: completed)
- **Status:** draft

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-AUTH-001 | The system SHALL allow new users to register with name, email, and password. |
| FR-AUTH-002 | The system SHALL allow registered users to log in with email and password. |
| FR-AUTH-004 | The system SHALL allow authenticated users to log out, invalidating their refresh token. |
| FR-PWD-001 | The system SHALL allow users to request a password reset by email. |
| FR-PWD-002 | The system SHALL verify a submitted OTP and return a time-limited password reset token. |
| FR-PWD-003 | The system SHALL allow users to set a new password using a valid password reset token. |

Also in scope as shared cross-cutting infrastructure (SDS §11.3, FRS §25.3): automatic silent access-token refresh, and a protected-route wrapper consumed by every future authenticated page (AB-1011+).

## 3. Scenarios

### UX-SCR-001 — Register (`/register`)

**Scenario 1 — Successful registration**
- **Given** the register form with valid name, email, and password
- **When** the user clicks "Create account"
- **Then** the button shows a spinner and "Creating account...", inputs are disabled, the client calls `POST /api/auth/register`, and on `201` the app shows toast "Account created! Please sign in." and redirects to `/login`.

**Scenario 2 — Real-time password strength checklist**
- **Given** the user is typing in the password field
- **Then** a live checklist (length ≥8, uppercase, lowercase, digit, special char) updates on every keystroke via `aria-live="polite"`, per UX-AUTH-01.

**Scenario 3 — Client-side field validation**
- **Given** the user submits with a missing name, invalid email format, or a password failing any complexity rule
- **Then** the form does not call the API; it shows the field-level message from UX §14.1 (e.g. "Full name is required", "Please enter a valid email address", "Must contain at least one uppercase letter") under the offending input(s).

**Scenario 4 — Duplicate email (409)**
- **Given** a submission that passes client validation
- **When** the API responds `409 EMAIL_ALREADY_EXISTS`
- **Then** the form shows a banner "Email already registered" (per SDS §7.1) and re-enables the form; the user's entered values are preserved.

**Scenario 5 — Server-side validation error (422)**
- **Given** a submission that passes client validation but the API responds `422 VALIDATION_ERROR`
- **Then** the form maps each `details[].field` entry to the corresponding field's error slot using the same messages as Scenario 3.

**Scenario 6 — Navigation**
- **Given** the register page
- **Then** a link "Already have an account? Sign in" navigates to `/login` without a full page reload.

### UX-SCR-002 — Login (`/login`)

**Scenario 7 — Successful login**
- **Given** the login form with a registered user's correct email and password
- **When** the user clicks "Sign in" (button shows spinner + "Signing in...")
- **Then** the client calls `POST /api/auth/login`; on `200` it stores `accessToken`, `refreshToken`, and `user` in the Zustand auth store and redirects directly to `/` (Dashboard) — no intermediate toast.

**Scenario 8 — Invalid credentials (401)**
- **Given** a login submission with wrong email or wrong password
- **When** the API responds `401 INVALID_CREDENTIALS`
- **Then** the form shows one generic banner "Invalid email or password" via `aria-live="assertive"` — never indicating which field was wrong (UX-AUTH-02) — and does not clear the entered email.

**Scenario 9 — Client-side required-field validation**
- **Given** the user submits with an empty email or password field
- **Then** the app shows "Email is required" / "Password is required" (UX §14.2) without calling the API.

**Scenario 10 — Navigation**
- **Given** the login page
- **Then** links to `/register` and `/forgot-password` are present and functional.

### UX-SCR-003 — Forgot Password (`/forgot-password`)

**Scenario 11 — Request submitted for any syntactically valid email**
- **Given** a syntactically valid email entered in the form
- **When** the user clicks "Send code" (button shows spinner + "Sending...")
- **Then** the client calls `POST /api/auth/forgot-password` and, regardless of whether the API's `200` response indicates a known or unknown account (Scenario 1/2 of AB-1003's spec are indistinguishable to the client), the app always navigates to `/verify-otp` carrying the submitted email in transient state (UX-AUTH-03).

**Scenario 12 — Invalid email format**
- **Given** a malformed email
- **When** the user submits
- **Then** the app shows "Please enter a valid email address" (UX §14.1/14.2 shared rule) and does not call the API.

**Scenario 13 — Rate limit exceeded (429)**
- **Given** the API responds `429 OTP_RATE_LIMIT`
- **Then** the app shows a toast/banner communicating the rate limit was hit and stays on `/forgot-password` (does not navigate to the OTP screen, since no new OTP was issued).

**Scenario 14 — Navigation**
- **Given** the forgot-password page
- **Then** a link back to `/login` is present.

### UX-SCR-004 — OTP Verification (`/verify-otp`)

**Scenario 15 — Digit entry, auto-advance, and paste**
- **Given** the 6-slot `OtpInput`
- **When** the user types a digit in a slot, or pastes a 6-digit string anywhere in the component
- **Then** focus auto-advances to the next empty slot on type (UX-AUTH-04), `Backspace` on an empty slot moves focus to the previous slot, and a paste of a valid 6-digit string fills all slots and moves focus to the last one.

**Scenario 16 — Successful verification**
- **Given** all 6 digits entered
- **When** the user clicks "Verify" (or the 6th digit auto-triggers submission)
- **Then** the client calls `POST /api/auth/verify-otp` with the email carried from Scenario 11; on `200` the app stores the returned `resetToken` in transient (in-memory, not persisted) state and navigates directly to `/reset-password`.

**Scenario 17 — Incorrect code (401)**
- **Given** the API responds `401 INVALID_OTP`
- **Then** the input boxes shake, the app shows "Incorrect code. X attempts remaining." where X is a client-tracked counter starting at 5 and decrementing per failed attempt for the current OTP (the API does not return a remaining-attempts count — see Open Question 3), and the input clears for re-entry.

**Scenario 18 — Expired code (410)**
- **Given** the API responds `410 OTP_EXPIRED`
- **Then** the app shows "Code expired" plus a "Resend code" link/button, and disables the "Verify" action until a new code is requested.

**Scenario 19 — Resend code**
- **Given** the user clicks "Resend code" (available once the countdown in Scenario 20 reaches zero, or immediately after a 410)
- **Then** the app re-calls `POST /api/auth/forgot-password` for the same email, resets the client-side attempt counter to 5, restarts the countdown timer, and clears the OTP input.

**Scenario 20 — Countdown timer**
- **Given** a code was just requested
- **Then** a `CountdownTimer` counts down from a client-configured duration (see Open Question 2) and is announced politely via `aria-live`; reaching zero enables "Resend code".

**Scenario 21 — Client-side format validation**
- **Given** fewer than 6 digits or a non-numeric character
- **Then** the "Verify" action is disabled and no API call is made.

**Scenario 22 — Navigation**
- **Given** the OTP page
- **Then** a link back to `/forgot-password` is present.

**Scenario 23 — Direct navigation without a preceding request**
- **Given** a user opens `/verify-otp` directly (no email in transient state, e.g. page refresh)
- **Then** the app redirects to `/forgot-password` rather than rendering a broken form (see Open Question 1 on transient-state persistence).

### UX-SCR-005 — Reset Password (`/reset-password`)

**Scenario 24 — Successful reset**
- **Given** a valid `resetToken` in transient state, a new password meeting complexity rules, and a matching confirm field
- **When** the user clicks "Reset password" (button shows spinner + "Resetting...")
- **Then** the client calls `POST /api/auth/reset-password`; on `200` the app shows toast "Password reset successful! Please sign in." and redirects to `/login`.

**Scenario 25 — Passwords do not match**
- **Given** "New Password" and "Confirm" fields with different values
- **When** the user submits or blurs the confirm field
- **Then** the app shows "Passwords do not match" (UX §14.7) under the confirm field and does not call the API.

**Scenario 26 — Weak password**
- **Given** a new password failing any complexity rule
- **Then** the app shows the same field messages as registration (UX §14.1) via the live checklist, and does not call the API.

**Scenario 27 — Reset token expired (410)**
- **Given** the API responds `410 RESET_TOKEN_EXPIRED`
- **Then** the app shows a banner directing the user back to `/forgot-password` to request a new code.

**Scenario 28 — Password same as current (422)**
- **Given** the API responds `422 PASSWORD_SAME_AS_CURRENT`
- **Then** the app shows a banner "New password must be different from your current password" under/above the form.

**Scenario 29 — Invalid reset token (401)**
- **Given** the API responds `401 INVALID_RESET_TOKEN` (e.g. token already consumed, replayed request)
- **Then** the app shows the same banner behavior as Scenario 27, directing the user to restart the flow.

**Scenario 30 — Direct navigation without a token**
- **Given** a user opens `/reset-password` directly with no `resetToken` in transient state
- **Then** the app redirects to `/forgot-password`.

### Cross-Cutting — Token Storage, Refresh, Protected Routes, Logout

**Scenario 31 — Tokens stored in Zustand**
- **Given** a successful login or token refresh
- **Then** `accessToken`, `refreshToken`, and `user` are held only in the `useAuthStore` Zustand store (in-memory) — no `persist` middleware, no `localStorage`/`sessionStorage` (see Open Question 1).

**Scenario 32 — Silent refresh on access-token expiry**
- **Given** an authenticated request returns `401` with a token-related error code (`TOKEN_EXPIRED`)
- **When** the API client intercepts the `401`
- **Then** it calls `POST /api/auth/refresh` with the stored `refreshToken`; on success it updates the store with the new token pair and retries the original request exactly once with the new `accessToken`, transparently to the caller (SDS §11.3).

**Scenario 33 — Concurrent requests during refresh**
- **Given** multiple in-flight requests receive `401` at the same time
- **Then** only one `/api/auth/refresh` call is made (single-flight); all pending requests wait for that single refresh to resolve and retry with its result.

**Scenario 34 — Refresh failure**
- **Given** the refresh call itself fails (`401 INVALID_REFRESH_TOKEN` or `401 REFRESH_TOKEN_EXPIRED`)
- **Then** the app clears the auth store and redirects to `/login`, discarding the original failed request.

**Scenario 35 — Protected route wrapper**
- **Given** a route wrapped by the protected-route component
- **When** `useAuthStore.isAuthenticated()` is `false`
- **Then** the app redirects to `/login` without rendering the wrapped page; when `true`, the page renders normally. `/`, `/notes/new`, `/notes/:id` (and future authenticated routes) are wrapped; `/login`, `/register`, `/forgot-password`, `/verify-otp`, `/reset-password`, `/shared/:token` are not (AZ-02 analog for the frontend).

**Scenario 36 — Logout**
- **Given** an authenticated user triggers logout (from a `UserMenu` action introduced by AB-1011, invoked here only for the store/API contract)
- **Then** the app calls `POST /api/auth/logout` with the stored `refreshToken`, clears the auth store regardless of the API response, and redirects to `/login`.

**Scenario 37 — All auth forms share a disabled/spinner submit state**
- **Given** any of the five auth forms
- **Then** the submit button is disabled and shows a spinner + in-progress label for the duration of its API call (UX-AUTH-06), and inputs are disabled to prevent double-submission.

## 4. Screen / Component Contract

| Screen | Route | Components (new) | Backend API |
| ------ | ----- | ------------------ | ----------- |
| UX-SCR-001 Register | `/register` | `RegisterPage`, `RegisterForm`, `PasswordChecklist` | `POST /api/auth/register` |
| UX-SCR-002 Login | `/login` | `LoginPage`, `LoginForm` | `POST /api/auth/login` |
| UX-SCR-003 Forgot Password | `/forgot-password` | `ForgotPasswordPage`, `ForgotPasswordForm` | `POST /api/auth/forgot-password` |
| UX-SCR-004 OTP Verification | `/verify-otp` | `VerifyOtpPage`, `OtpForm`, `OtpInput`, `CountdownTimer` | `POST /api/auth/verify-otp`, `POST /api/auth/forgot-password` (resend) |
| UX-SCR-005 Reset Password | `/reset-password` | `ResetPasswordPage`, `ResetPasswordForm` | `POST /api/auth/reset-password` |
| Cross-cutting | all authenticated routes | `ProtectedRoute` | `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` |

Base UI primitives (`Input`, `Button`, `Toast`/`Toaster`) do not yet exist under `src/components/ui/` (no ticket has created them) — building the minimal set needed by these forms is in scope here, sized to what these five screens require, not a general design-system buildout.

All request/response shapes and validation come from `@note-app/shared`: `RegisterRequestSchema`, `LoginRequestSchema`, `ForgotPasswordRequestSchema`, `VerifyOtpRequestSchema`, `ResetPasswordRequestSchema` (and their response counterparts) in `packages/shared/src/schemas/auth.schemas.ts` — forms validate client-side with these same schemas via `safeParse` (no `react-hook-form`/resolver in the dependency tree; per frontend `CLAUDE.md`, form inputs use React state).

## 5. State & Data Impact

- **`src/stores/auth.store.ts`** (existing, from AB-1001 scaffold): `user` changes from `unknown | null` to `UserProfile | null` (now resolvable from `@note-app/shared`); add a `clearAuth`-adjacent action if needed for logout: no new fields required — `accessToken`/`refreshToken`/`user` already modeled.
- **`src/lib/api-client.ts`** (existing): `handleUnauthorized` currently just clears the store on any `401`. This ticket changes it to distinguish a token-expiry `401` (attempt refresh-and-retry, Scenarios 32–34) from a refresh-endpoint `401` (clear + redirect, Scenario 34) — it must not attempt to refresh when the failing request *is* the refresh call itself.
- **No TanStack Query usage for auth mutations** — register/login/forgot-password/verify-otp/reset-password are one-shot form submissions (not cached server state), implemented as plain async handlers calling `apiClient` directly, consistent with SDS's flow diagrams. `GET /api/auth/me` (if used to hydrate the store on app load) may use TanStack Query since it's a read.
- **New transient state:** email carried from Forgot Password → OTP screen, and `resetToken` carried from OTP → Reset Password screen. Not part of the persistent auth store — see Open Question 1 for exact mechanism.
- **No new Prisma models or backend changes** — this ticket is frontend-only.

## 6. Open Questions (flagged in `/start`, still unresolved — must be settled in `/plan`)

1. **Transient state mechanism for the OTP email / reset token hand-off (Scenarios 11, 16, 23, 30).** Options: React Router location `state` (lost on hard refresh — matches Scenarios 23/30's redirect-back behavior), a short-lived Zustand slice, or component-lift state. Router `state` is the simplest fit given Scenarios 23/30 explicitly want a refresh to bounce the user back a step, but needs an explicit decision.
2. **OTP countdown duration is not returned by `POST /api/auth/forgot-password`** (response is `{message}` only per AB-1003 §4). Recommend hardcoding a client constant matching the backend's `OTP_EXPIRY_MINUTES` default (10 minutes) — this couples frontend/backend config by convention rather than contract; flag if a future ticket should add `expiresInSeconds` to the response instead.
3. **Remaining-attempts counter (Scenario 17) is client-tracked only** — the backend has no per-attempt counter in its response (AB-1003 spec confirms `INVALID_OTP` is a flat generic error, scenario 10/11 there). The client-side count is cosmetic UX only, not an enforced limit (the actual limit is the backend's `OTP_VERIFY_RATE_LIMIT` at 5 attempts/hour, a different mechanism). Confirm this cosmetic-only framing is acceptable.
4. **Refresh-token persistence across page reload is out of scope for this ticket** (Scenario 31 keeps everything in-memory, matching SDS §7.2 "Store tokens in memory") — a full page reload logs the user out. Confirm this is acceptable for the current milestone, since no ticket in FRS §25.2/25.3 appears to add persisted sessions.

## 7. Out of Scope

- Backend changes of any kind — AB-1002/AB-1003 (done).
- Dashboard, editor, search, sharing, version-history UI — AB-1011 through AB-1015.
- Actual email delivery — OTP/verification emails remain console-logged only (CON-005).
- A general-purpose `src/components/ui/` design system beyond the primitives these five screens need.
- Persisted ("remember me") sessions across browser restarts (Open Question 4).
- Rate-limit UI beyond surfacing the `429`/`OTP_RATE_LIMIT`/`OTP_VERIFY_RATE_LIMIT` errors already defined by the backend.
