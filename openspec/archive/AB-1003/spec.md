# AB-1003 — Backend Password Reset (OTP) Spec

## 1. Ticket

- **ID:** AB-1003
- **Title:** Backend Password Reset (OTP)
- **Dependencies:** AB-1002 (Backend Authentication) — confirmed complete (`openspec/archive/AB-1002`, status: completed)
- **Status:** completed

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-PWD-001 | The system SHALL allow users to request a password reset by email, generating a 6-digit OTP logged to the console. |
| FR-PWD-002 | The system SHALL verify a submitted OTP and, if valid, return a time-limited password reset token. |
| FR-PWD-003 | The system SHALL allow users to set a new password using a valid password reset token, invalidating all existing sessions. |

## 3. Scenarios

### FR-PWD-001 — Request Password Reset (`POST /api/auth/forgot-password`)

**Scenario 1 — Successful request for an existing email**
- **Given** a user exists with email `jane@example.com`
- **When** a client submits `{email: "jane@example.com"}`
- **Then** the system generates a cryptographically random 6-digit OTP, stores its SHA-256 hash in `PasswordResetOtp` with `expiresAt` = now + 10 minutes, logs the simulated email block (SDS §29.4) to the console, and responds `200` with a generic `{message}`.

**Scenario 2 — Email enumeration prevention (unknown email)**
- **Given** no user exists with the submitted email
- **When** a client submits `{email}` for that address
- **Then** the system performs no OTP generation or DB write, and still responds `200` with the same generic `{message}` as Scenario 1 (AF-1) — response body and timing must not reveal whether the account exists.

**Scenario 3 — OTP is 6 digits from a secure random source**
- **Given** a successful request (Scenario 1)
- **Then** the generated OTP is exactly 6 numeric digits, produced via a CSPRNG (e.g. Node `crypto.randomInt`), never `Math.random()`.

**Scenario 4 — OTP stored as hash only**
- **Given** a successful request (Scenario 1)
- **Then** the `PasswordResetOtp.otpHash` column contains only the SHA-256 hash — the plaintext OTP is never persisted to the database (it appears only in the console log per SDS §29.4).

**Scenario 5 — Re-request invalidates the previous OTP**
- **Given** a user has an active, unexpired OTP from a prior request
- **When** the same user requests another OTP before the first expires
- **Then** the system marks the previous `PasswordResetOtp` record `used = true` (or equivalent invalidation) and creates a new one — only the newest OTP can succeed verification (AF-2, BR-010).

**Scenario 6 — Invalid email format**
- **Given** a request with a malformed `email` field
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and a field-level detail for `email`.

**Scenario 7 — Rate limit exceeded**
- **Given** an email address has already triggered 3 forgot-password requests within the past hour
- **When** a 4th request is submitted for that email
- **Then** the system responds `429` with error code `OTP_RATE_LIMIT` (SDS §28.3).

### FR-PWD-002 — Verify OTP (`POST /api/auth/verify-otp`)

**Scenario 8 — Successful verification**
- **Given** a user has an active, unused, unexpired OTP
- **When** the client submits `{email, otp}` matching that OTP
- **Then** the system marks the OTP record `used = true`, generates a password reset token valid for 15 minutes, and responds `200` with `{resetToken}`.

**Scenario 9 — OTP is single-use**
- **Given** an OTP that was already verified successfully once (Scenario 8)
- **When** the client attempts to verify the same OTP value again
- **Then** the system responds `401` with error code `INVALID_OTP` (EC-4) — a used OTP is treated identically to a non-existent one.

**Scenario 10 — Incorrect OTP**
- **Given** a user has an active OTP
- **When** the client submits a 6-digit value that does not match the stored hash
- **Then** the system responds `401` with error code `INVALID_OTP`, using the same generic message regardless of the underlying reason (EC-1).

**Scenario 11 — No active OTP for the email**
- **Given** no `PasswordResetOtp` record exists for the submitted email (or none unexpired/unused)
- **When** the client submits `{email, otp}`
- **Then** the system responds `401` with error code `INVALID_OTP` (EC-3) — identical response to Scenario 10, so the client cannot distinguish "wrong code" from "no code requested."

**Scenario 12 — Expired OTP**
- **Given** an OTP record whose `expiresAt` is in the past
- **When** the client submits the correct OTP value
- **Then** the system responds `410` with error code `OTP_EXPIRED` (EC-2) — checked only after confirming the hash matches, so an expired-but-correct OTP gets `OTP_EXPIRED` rather than `INVALID_OTP`.

**Scenario 13 — Rate limit exceeded**
- **Given** an email address has already made 5 verify-otp attempts within the past hour
- **When** a 6th attempt is submitted for that email
- **Then** the system responds `429` with error code `OTP_VERIFY_RATE_LIMIT` (SDS §28.3).

**Scenario 14 — Missing or malformed fields**
- **Given** a request missing `email`/`otp`, or `otp` is not exactly 6 numeric digits
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and field-level details.

### FR-PWD-003 — Reset Password (`POST /api/auth/reset-password`)

**Scenario 15 — Successful reset**
- **Given** a valid, unexpired, unused password reset token issued in Scenario 8
- **When** the client submits `{resetToken, newPassword}` where `newPassword` meets complexity rules (FRS §13.1) and differs from the user's current password
- **Then** the system hashes `newPassword` with bcrypt (cost ≥12), updates `User.passwordHash`, invalidates the reset token (single-use), deletes **all** `RefreshToken` rows for that user (BR-013, force logout on every device), and responds `200` with `{message}`.

**Scenario 16 — User can log in immediately with the new password**
- **Given** a successful reset (Scenario 15)
- **When** the client calls `POST /api/auth/login` with the new password
- **Then** the system authenticates successfully and issues a fresh access/refresh token pair.

**Scenario 17 — Reset token is single-use**
- **Given** a reset token already consumed by a successful reset (Scenario 15)
- **When** the client attempts to reuse the same token
- **Then** the system responds `401` with error code `INVALID_RESET_TOKEN`.

**Scenario 18 — Invalid reset token**
- **Given** a reset token that fails signature/shape verification or does not correspond to any issued token
- **When** the client submits `{resetToken, newPassword}`
- **Then** the system responds `401` with error code `INVALID_RESET_TOKEN` (EC-1).

**Scenario 19 — Expired reset token**
- **Given** a reset token whose validity window (15 minutes from issuance) has elapsed
- **When** the client submits it
- **Then** the system responds `410` with error code `RESET_TOKEN_EXPIRED` (EC-2).

**Scenario 20 — New password fails complexity rules**
- **Given** a `newPassword` missing one of {uppercase, lowercase, digit, special character} or outside the 8–128 length range
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and a field-level detail for `newPassword` (EC-3).

**Scenario 21 — New password same as current**
- **Given** a valid reset token and a `newPassword` that, when compared via bcrypt against `User.passwordHash`, matches the current password
- **When** the client submits the reset
- **Then** the system responds `422` with error code `PASSWORD_SAME_AS_CURRENT` (EC-4) and does not modify `passwordHash` or invalidate sessions.

**Scenario 22 — Missing required fields**
- **Given** a request missing `resetToken` or `newPassword`
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and field-level details.

### Cross-Cutting

**Scenario 23 — OTP and tokens never appear in plaintext in application logs**
- **Given** any password-reset flow request (any of the three endpoints)
- **Then** structured request/response logs (SDS §29.1) never include the plaintext OTP, the reset token, or the new password — the only place the plaintext OTP appears is the dedicated simulated-email console block (SDS §29.4), which is exempt from the general redaction rule as it *is* the simulated delivery channel.

**Scenario 24 — All queries scoped to the resolved user**
- **Given** any of the three endpoints
- **Then** the `PasswordResetOtp` and `RefreshToken` operations are always scoped by the `userId` resolved server-side from the email lookup or verified token payload — never accepted directly from client input (AZ-05 analog for unauthenticated endpoints).

## 4. API / Interface Contract

| Method | Path | Auth | Request Body | Success Response | Error Responses |
| ------ | ---- | ---- | ------------- | ----------------- | ---------------- |
| POST | `/api/auth/forgot-password` | No | `{email}` | `200 {message}` | `422 VALIDATION_ERROR`, `429 OTP_RATE_LIMIT` |
| POST | `/api/auth/verify-otp` | No | `{email, otp}` | `200 {resetToken}` | `401 INVALID_OTP`, `410 OTP_EXPIRED`, `422 VALIDATION_ERROR`, `429 OTP_VERIFY_RATE_LIMIT` |
| POST | `/api/auth/reset-password` | No | `{resetToken, newPassword}` | `200 {message}` | `401 INVALID_RESET_TOKEN`, `410 RESET_TOKEN_EXPIRED`, `422 VALIDATION_ERROR`, `422 PASSWORD_SAME_AS_CURRENT` |

**Validation rules (FRS §13.1, enforced via Zod schemas in `packages/shared`):**
- `email`: required, valid format (RFC 5322 simplified), max 255 chars, normalized to lowercase before lookup.
- `otp`: required, exactly 6 numeric digits.
- `newPassword`: required, 8–128 chars, must contain ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special character (`!@#$%^&*`) — identical rule to registration password.
- `resetToken`: required, non-empty string.

**Error format (SDS §19.1/19.2):** all errors as `{error: {code, message, details: []}}`; validation errors populate `details[]` with `{field, message}` entries.

**OTP spec (FRS FR-PWD-001/002, BR-010):**
- 6 digits, generated via CSPRNG, hashed with SHA-256 before storage in `PasswordResetOtp.otpHash`.
- Expiry: exactly `OTP_EXPIRY_MINUTES` (default 10) minutes from creation.
- Single-use: `used` flag set on successful verification; a re-request before expiry invalidates the prior record.

**Reset token spec (FRS FR-PWD-002/003):**
- Validity: exactly `RESET_TOKEN_EXPIRY_MIN` (default 15) minutes.
- Single-use, invalidated immediately upon successful `reset-password`.
- **Open question for `/plan`:** SDS defines no dedicated storage table or secret for this token (only `PasswordResetOtp` exists in the schema — SDS §13.2.8/§15 — and no `RESET_TOKEN_SECRET` env var is listed alongside `JWT_SECRET`). Recommend implementing it as a **stateless JWT** signed with the existing `JWT_SECRET`, carrying `{userId, purpose: "password_reset", iat, exp}`, verified by signature + `purpose` claim + `exp` rather than a DB lookup — consistent with the app's existing "stateless JWT" pattern (SDS §10.2/§11). "Single-use" then means: once `reset-password` succeeds, the user's password (and therefore any check tied to it) has changed, but the JWT itself remains cryptographically valid until `exp` — needs an explicit decision (e.g. a `passwordChangedAt` claim comparison, or a short-lived denylist) to truly enforce single-use for an already-consumed-but-unexpired token. **This must be resolved in `/plan` before implementation.**

## 5. Data Model Impact

- **No new Prisma models required** for the OTP flow — `PasswordResetOtp` already exists in `schema.prisma` (SDS §15) from AB-1001/1002 scaffolding.
- **`RefreshToken` (existing):** `reset-password` must delete/invalidate **all** rows for the resolved `userId` (BR-013), not just one — differs from AB-1002's single-token rotation logic.
- **Reset token storage:** see open question above — if implemented as a stateless JWT, no new table is needed; if a denylist/single-use mechanism is required, a small table or reuse of `PasswordResetOtp` (e.g. storing the reset-token's jti) may be needed. To be settled in `/plan`.

## 6. Out of Scope

- Frontend screens (UX-SCR-003 Forgot Password, UX-SCR-004 OTP Verification, UX-SCR-005 Reset Password) — AB-1010.
- Actual email delivery — OTP is console-logged only (CON-005 / SDS §29.4).
- Register/login/refresh/logout endpoints — AB-1002 (done).
- General API rate limiting middleware setup — assumed already in place from AB-1001/1002; this ticket only adds the OTP-specific limit rules (3/hr request, 5/hr verify) on top of it.
