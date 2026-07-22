# AB-1002 — Backend Authentication Spec

## 1. Ticket

- **ID:** AB-1002
- **Title:** Backend Authentication
- **Dependencies:** AB-1001 (Project Setup) — confirmed complete (`openspec/archive/AB-1001`, status: completed)
- **Status:** completed

## 2. Requirements Covered

| Requirement ID | Restatement |
| --------------- | ----------- |
| FR-AUTH-001 | The system SHALL allow new users to register with name, email, and password. |
| FR-AUTH-002 | The system SHALL allow registered users to log in with email and password, receiving a JWT access token and a refresh token. |
| FR-AUTH-003 | The system SHALL allow clients to exchange a valid refresh token for a new access token and a new refresh token (rotation). |
| FR-AUTH-004 | The system SHALL allow authenticated users to log out, invalidating their refresh token. |

`GET /api/auth/me` and the JWT auth middleware are also in scope (SDS §17.1, FRS §25.1) as shared infrastructure consumed by logout and all future authenticated endpoints, though not individually numbered as an FR.

## 3. Scenarios

### FR-AUTH-001 — Register (`POST /api/auth/register`)

**Scenario 1 — Successful registration**
- **Given** no user exists with the submitted email
- **When** a client submits `{name, email, password}` all satisfying validation rules (FRS §13.1)
- **Then** the system hashes the password with bcrypt (cost ≥12), creates the `User` record, logs a simulated verification email to the console, and responds `201` with `{user: {id, name, email}}`.

**Scenario 2 — Password never stored in plain text**
- **Given** a successful registration (Scenario 1)
- **Then** the `passwordHash` column contains only the bcrypt hash — the plaintext password is never persisted or logged.

**Scenario 3 — Duplicate email**
- **Given** a user already exists with email `x@example.com` (case-insensitive match, per BR-001)
- **When** a client submits registration with email `X@Example.com`
- **Then** the system responds `409` with error code `EMAIL_ALREADY_EXISTS`.

**Scenario 4 — Invalid email format**
- **Given** a registration request with a malformed email
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and a field-level detail for `email`.

**Scenario 5 — Password complexity violation**
- **Given** a registration request with a password missing one of {uppercase, lowercase, digit, special character} or outside the 8–128 length range
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and a field-level detail for `password`.

**Scenario 6 — Missing required fields**
- **Given** a registration request missing `name`, `email`, or `password`
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and field-level details for each missing field.

**Scenario 7 — Email stored lowercase**
- **Given** a successful registration with email `Jane.Doe@Example.COM`
- **Then** the stored `email` column value is `jane.doe@example.com` (BR-015).

### FR-AUTH-002 — Login (`POST /api/auth/login`)

**Scenario 8 — Successful login**
- **Given** a registered user with known credentials
- **When** the client submits `{email, password}` matching that user
- **Then** the system responds `200` with `{accessToken, refreshToken, user}`, where `accessToken` is a JWT expiring in exactly 15 minutes (payload: `userId`, `email`, `iat`, `exp`) and `refreshToken` is an opaque token expiring in exactly 7 days, stored hashed in the `RefreshToken` table.

**Scenario 9 — Unknown email**
- **Given** no user exists with the submitted email
- **When** the client attempts login
- **Then** the system responds `401` with error code `INVALID_CREDENTIALS` (generic message — does not reveal that the email is unregistered).

**Scenario 10 — Incorrect password**
- **Given** a registered user
- **When** the client submits the correct email but an incorrect password
- **Then** the system responds `401` with error code `INVALID_CREDENTIALS` (same generic message as Scenario 9).

**Scenario 11 — Missing required fields**
- **Given** a login request missing `email` or `password`
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR` and field-level details.

**Scenario 12 — Re-login invalidates the previous session's refresh token**
- **Given** a user has an active refresh token from a prior login
- **When** the same user logs in again successfully
- **Then** the system issues a new access/refresh token pair and invalidates the refresh token issued by the prior login.
- **Note:** FRS AF-1 states this explicitly; this spec treats it as single-active-session semantics (one live refresh token per user at a time). **Flagging for `/plan`:** confirm this is intended over allowing concurrent multi-device sessions, since FRS is otherwise silent on multi-device support.

### FR-AUTH-003 — Refresh (`POST /api/auth/refresh`)

**Scenario 13 — Successful refresh**
- **Given** a valid, non-expired refresh token stored in the database
- **When** the client submits `{refreshToken}`
- **Then** the system deletes the used token, generates a new access token and new refresh token, stores the new refresh token hashed, and responds `200` with `{accessToken, refreshToken}`.

**Scenario 14 — Rotation invalidates the used token**
- **Given** a successful refresh (Scenario 13)
- **When** the client attempts to reuse the same (now-deleted) refresh token
- **Then** the system responds `401` with error code `INVALID_REFRESH_TOKEN`.

**Scenario 15 — Refresh token not found**
- **Given** a refresh token value with no matching database record
- **When** the client submits it to `/api/auth/refresh`
- **Then** the system responds `401` with error code `INVALID_REFRESH_TOKEN`.

**Scenario 16 — Refresh token expired**
- **Given** a refresh token record whose `expiresAt` is in the past
- **When** the client submits it to `/api/auth/refresh`
- **Then** the system responds `401` with error code `REFRESH_TOKEN_EXPIRED`.

**Scenario 17 — Missing refresh token in request**
- **Given** a refresh request with no `refreshToken` field
- **When** validation runs
- **Then** the system responds `422` with `VALIDATION_ERROR`.

### FR-AUTH-004 — Logout (`POST /api/auth/logout`)

**Scenario 18 — Successful logout**
- **Given** an authenticated user (valid access token) with an active refresh token
- **When** the client submits `{refreshToken}` to `/api/auth/logout`
- **Then** the system deletes the refresh token record and responds `200` with `{message}`.

**Scenario 19 — Idempotent logout**
- **Given** a refresh token that has already been invalidated (via prior logout or refresh rotation)
- **When** the client calls logout again with that token
- **Then** the system still responds `200` with `{message}` (no error).

**Scenario 20 — No access token provided**
- **Given** a logout request with no `Authorization` header
- **When** the request reaches the auth middleware
- **Then** the system responds `401` with error code `TOKEN_MISSING`.

**Scenario 21 — Invalid access token**
- **Given** a logout request with a malformed or invalid-signature access token
- **When** the request reaches the auth middleware
- **Then** the system responds `401` with error code `TOKEN_INVALID`.

**Scenario 22 — No server-side access-token blocklist**
- **Given** a user has logged out
- **Then** their still-unexpired access token continues to validate successfully against protected endpoints until its natural 15-minute expiry (server maintains no blocklist, per FR-AUTH-004 AC3).

### Shared Auth Middleware & `GET /api/auth/me`

**Scenario 23 — Valid access token returns profile**
- **Given** a valid, non-expired access token
- **When** the client calls `GET /api/auth/me` with `Authorization: Bearer <token>`
- **Then** the system responds `200` with `{user: {id, name, email}}` for the `userId` embedded in the token.

**Scenario 24 — Missing access token**
- **Given** a request to any authenticated route with no `Authorization` header
- **Then** the middleware responds `401` with error code `TOKEN_MISSING`.

**Scenario 25 — Expired access token**
- **Given** a request with an access token past its `exp` claim
- **Then** the middleware responds `401` with error code `TOKEN_EXPIRED`.

**Scenario 26 — Malformed access token**
- **Given** a request with a token that fails JWT signature/shape verification
- **Then** the middleware responds `401` with error code `TOKEN_INVALID`.

**Scenario 27 — `userId` never trusted from client input**
- **Given** any authenticated request
- **Then** the `userId` used for database queries is read exclusively from the verified JWT payload, never from request body or query parameters (AZ-05).

## 4. API / Interface Contract

| Method | Path | Auth | Request Body | Success Response | Error Responses |
| ------ | ---- | ---- | ------------- | ----------------- | ---------------- |
| POST | `/api/auth/register` | No | `{name, email, password}` | `201 {user: {id, name, email}}` | `409 EMAIL_ALREADY_EXISTS`, `422 VALIDATION_ERROR` |
| POST | `/api/auth/login` | No | `{email, password}` | `200 {accessToken, refreshToken, user}` | `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR` |
| POST | `/api/auth/refresh` | No | `{refreshToken}` | `200 {accessToken, refreshToken}` | `401 INVALID_REFRESH_TOKEN`, `401 REFRESH_TOKEN_EXPIRED`, `422 VALIDATION_ERROR` |
| POST | `/api/auth/logout` | Yes | `{refreshToken}` | `200 {message}` | `401 TOKEN_MISSING`, `401 TOKEN_INVALID`, `401 TOKEN_EXPIRED` |
| GET | `/api/auth/me` | Yes | — | `200 {user: {id, name, email}}` | `401 TOKEN_MISSING`, `401 TOKEN_INVALID`, `401 TOKEN_EXPIRED` |

**Validation rules (FRS §13.1, enforced via Zod schemas in `packages/shared`):**
- `name`: required, 1–100 chars, trimmed.
- `email`: required, valid format (RFC 5322 simplified), max 255 chars, normalized to lowercase before lookup/storage.
- `password`: required, 8–128 chars, must contain ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special character (`!@#$%^&*`).

**Error format (SDS §19.1/19.2):** all errors as `{error: {code, message, details: []}}`; validation errors populate `details[]` with `{field, message}` entries.

**Token specs (SDS §10.2, BR-011, BR-012):**
- Access token: JWT, signed with `JWT_SECRET`, 15-minute expiry, payload `{userId, email, iat, exp}`, not persisted server-side.
- Refresh token: opaque random value, 7-day expiry, persisted in `RefreshToken.tokenHash` (hashed, not plaintext), rotated on every use.

## 5. Data Model Impact

- **No new Prisma models.** `User` and `RefreshToken` already exist in `schema.prisma` from AB-1001 (SDS §15) — this ticket implements the service/controller logic that reads and writes them.
- **Open question for `/plan`:** SDS specifies refresh tokens are stored "hashed" (§10.2) but does not name the hash algorithm (bcrypt is explicitly reserved for passwords per SDS §10.3). Recommend SHA-256 (fast, deterministic, suitable for an opaque high-entropy token looked up by exact hash match) rather than bcrypt (slow, non-deterministic, unsuitable for indexed lookup) — needs confirmation before implementation.

## 6. Out of Scope

- Password reset / OTP endpoints (`forgot-password`, `verify-otp`, `reset-password`) — AB-1003.
- Frontend auth screens/forms (UX-SCR-001, 002, 003, 004, 005) — AB-1010.
- Actual email delivery — verification email is console-logged only (CON-005).
- Rate limiting specific to auth endpoints beyond the general middleware from AB-1001 (OTP-specific rate limits `OTP_RATE_LIMIT`/`OTP_VERIFY_RATE_LIMIT` belong to AB-1003).
- Any endpoint other than the five listed in Section 4.
