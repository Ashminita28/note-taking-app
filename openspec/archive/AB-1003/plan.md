# Technical Plan — AB-1003 (Backend Password Reset / OTP)

Traces every file to a scenario in `openspec/tickets/AB-1003/spec.md`. Follows the same layered
architecture (Router → Validation → Controller → Service → Prisma) and module structure
established by AB-1002 in `apps/backend/src/modules/auth/`.

## 0. Architecture Decisions

1. **Reset token resolves the spec's open question: stateless JWT + one DB flag, not a fully
   opaque DB-stored token.** Signed with the existing `JWT_SECRET` via `jsonwebtoken`, payload
   `{userId, otpId, purpose: 'password_reset', iat, exp}`, expiry `RESET_TOKEN_EXPIRY_MIN` (15
   min). This reuses the exact signing/verification pattern already in `auth.tokens.ts`
   (`signAccessToken`/`verifyAccessToken`) rather than introducing a second token technology.
   - **Why not fully stateless (spec's flagged risk):** a bare JWT can't be revoked before
     `exp`, so "single-use" (FR-PWD-003 AC4) can't be enforced by signature verification alone.
   - **Resolution:** add one nullable-safe column, `resetTokenUsed Boolean @default(false)`, to
     the existing `PasswordResetOtp` row referenced by the JWT's `otpId` claim. `reset-password`
     verifies the JWT, then loads that row and rejects (`INVALID_RESET_TOKEN`) if
     `resetTokenUsed` is already `true`; on success it flips the flag in the same transaction as
     the password update. No new table, no token hash storage — the JWT signature already proves
     authenticity, the DB flag only tracks consumption. **This requires a Prisma migration**
     (see §2) — the smallest schema change that satisfies AC4 correctly.
2. **OTP hashing: SHA-256, not bcrypt** (FR-PWD-001 AC3, mirrors the `RefreshToken.tokenHash`
   precedent from AB-1002 — see that ticket's plan.md Architecture Decision #1). OTPs need
   deterministic exact-match lookup (`WHERE otpHash = ?`); bcrypt's salted output can't support
   that. Reuses `hashToken()` from `auth.tokens.ts` (already generic SHA-256, not refresh-token-
   specific despite its name — no need for a second function).
3. **OTP generation:** `crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits (Node's CSPRNG,
   not `Math.random()`), per FR-PWD-001 AC2.
4. **OTP lookup strategy (verify-otp):** resolve `email` → `user` first (generic `INVALID_OTP` if
   no user, preventing enumeration — spec Scenario 11). Then query
   `PasswordResetOtp.findFirst({ where: { userId, otpHash: hash(submittedOtp), used: false },
   orderBy: { createdAt: 'desc' } })` — **not** filtered by `expiresAt` in the query itself, so
   the code can distinguish "wrong code" (`INVALID_OTP`) from "right code, expired"
   (`OTP_EXPIRED`) per spec Scenario 12's ordering requirement (hash match checked before expiry).
5. **Re-request invalidation (spec Scenario 5):** `forgot-password` marks any existing
   `used: false` `PasswordResetOtp` rows for the user as `used: true` before creating the new row
   — implements BR-010/AF-2 without deleting history.
6. **Password-reset invalidates every session, not just one** (BR-013): unlike AB-1002's login
   (which replaces the single active session), `reset-password` runs
   `prisma.refreshToken.deleteMany({ where: { userId } })` — deliberately different semantics
   from login's single-session replacement, because this is a security event (forced logout
   everywhere), not routine re-authentication.
7. **Rate limiting is per-email, not per-IP**, which the existing global `rateLimiter`
   (`apps/backend/src/middleware/rate-limiter.ts`, IP-keyed, mounted app-wide) can't express. New
   `express-rate-limit` instances with a custom `keyGenerator: (req) => req.body.email`, mounted
   only on `forgot-password` (3/hr, `OTP_RATE_LIMIT`) and `verify-otp` (5/hr,
   `OTP_VERIFY_RATE_LIMIT`) per SDS §28.3 — distinct error codes from the general
   `RATE_LIMIT_EXCEEDED`, so they need their own `handler` functions, not the shared
   `rateLimitHandler`. Placed in `auth.rate-limiters.ts`, mounted **after** `validateBody` in the
   router chain so the key reads the already-trimmed/lowercased email.
8. **No changes to `User` model.** Only `PasswordResetOtp` gains the one new column.

## 1. `apps/backend/prisma` — Schema Migration

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| P1 | `apps/backend/prisma/schema.prisma` | Mod | Add `resetTokenUsed Boolean @default(false)` to `model PasswordResetOtp` (Architecture Decision #1). |
| P2 | `apps/backend/prisma/migrations/<timestamp>_add_reset_token_used/migration.sql` | New | Generated via `pnpm db:migrate` — `ALTER TABLE "PasswordResetOtp" ADD COLUMN "resetTokenUsed" BOOLEAN NOT NULL DEFAULT false;`. |

Run `pnpm db:generate` after the migration so the Prisma client picks up the new column before
any service code references it.

## 2. `packages/shared` — Contracts

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| S1 | `packages/shared/src/constants/limits.ts` | Mod | Add `OTP_LENGTH = 6`. |
| S2 | `packages/shared/src/schemas/auth.schemas.ts` | Mod | Add: `ForgotPasswordRequestSchema` (`{email: emailSchema}`), `ForgotPasswordResponseSchema` (`{message: z.string()}`), `VerifyOtpRequestSchema` (`{email: emailSchema, otp: z.string().length(OTP_LENGTH).regex(/^\d+$/, 'OTP must be 6 digits.')}`), `VerifyOtpResponseSchema` (`{resetToken: z.string()}`), `ResetPasswordRequestSchema` (`{resetToken: z.string().min(1), newPassword: strongPasswordSchema}` — reuses the existing `strongPasswordSchema`), `ResetPasswordResponseSchema` (`{message: z.string()}`), `ResetTokenPayloadSchema` (`{userId: z.string().uuid(), otpId: z.string().uuid(), purpose: z.literal('password_reset'), iat: z.number(), exp: z.number()}` — decoded-JWT shape check, mirrors `AccessTokenPayloadSchema`). |
| S3 | `packages/shared/src/types/auth.types.ts` | Mod | Add `z.infer` exports for every schema in S2: `ForgotPasswordRequest`, `ForgotPasswordResponse`, `VerifyOtpRequest`, `VerifyOtpResponse`, `ResetPasswordRequest`, `ResetPasswordResponse`, `ResetTokenPayload`. |
| S4 | `packages/shared/tests/unit/auth.schemas.test.ts` | Mod | Add valid/invalid cases: OTP not 6 digits / non-numeric, `newPassword` weak, `resetToken` empty, email enumeration-safe shape (schema itself doesn't leak — just structural validation). |

No barrel changes — `index.ts` already re-exports the whole `auth.schemas.js`/`auth.types.js` modules.

## 3. `apps/backend/src/modules/auth` — Feature Module

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| M1 | `apps/backend/src/modules/auth/auth.errors.ts` | Mod | Add `InvalidOtpError` (401 `INVALID_OTP`), `OtpExpiredError` (410 `OTP_EXPIRED`), `InvalidResetTokenError` (401 `INVALID_RESET_TOKEN`), `ResetTokenExpiredError` (410 `RESET_TOKEN_EXPIRED`), `PasswordSameAsCurrentError` (422 `PASSWORD_SAME_AS_CURRENT`) — all extend `AppError`, same pattern as existing classes. |
| M2 | `apps/backend/src/modules/auth/auth.tokens.ts` | Mod | Add `generateOtp(): {otp: string, otpHash: string, expiresAt: Date}` (`randomInt` + zero-pad + `hashToken()` + `config.OTP_EXPIRY_MINUTES`); `signResetToken({userId, otpId}): string` (`jwt.sign` with `purpose: 'password_reset'`, `expiresIn` derived from `config.RESET_TOKEN_EXPIRY_MIN` converted to a `SignOptions`-compatible string e.g. `` `${config.RESET_TOKEN_EXPIRY_MIN}m` ``); `verifyResetToken(token): ResetTokenPayload` (verifies signature via `jwt.verify`, then `ResetTokenPayloadSchema.parse`, then throws if `purpose !== 'password_reset'` — letting `jsonwebtoken`'s `TokenExpiredError` propagate for the caller to map to `RESET_TOKEN_EXPIRED`). Reuses existing `hashToken()` — no new hashing function. |
| M3 | `apps/backend/src/modules/auth/auth.rate-limiters.ts` | New | `otpRequestRateLimiter` (`windowMs: 60*60*1000, limit: 3`) and `otpVerifyRateLimiter` (`windowMs: 60*60*1000, limit: 5`), both `keyGenerator: (req) => (req.body as {email?: string}).email ?? 'unknown'`, each with its own `handler` responding `429` with `{error: {code: 'OTP_RATE_LIMIT' \| 'OTP_VERIFY_RATE_LIMIT', message, details: []}}` (SDS §19.1 envelope). |
| M4 | `apps/backend/src/modules/auth/auth.service.ts` | Mod | Add `requestPasswordReset(prisma, input: ForgotPasswordRequest): Promise<ForgotPasswordResponse>`, `verifyOtp(prisma, input: VerifyOtpRequest): Promise<VerifyOtpResponse>`, `resetPassword(prisma, input: ResetPasswordRequest): Promise<ResetPasswordResponse>` per Architecture Decisions #2–#6. Logs the SDS §29.4 simulated-email block via `console.log` in `requestPasswordReset` (only when a user is found — never logged for a non-existent email, since nothing was generated). |
| M5 | `apps/backend/src/modules/auth/auth.controller.ts` | Mod | Add thin handlers `forgotPassword`, `verifyOtp`, `resetPassword` — same pattern as existing handlers (call service with `prisma` + `req.body`, respond `200`). |
| M6 | `apps/backend/src/modules/auth/auth.router.ts` | Mod | Add: `POST /forgot-password` → `validateBody(ForgotPasswordRequestSchema)` + `otpRequestRateLimiter` + `forgotPassword`; `POST /verify-otp` → `validateBody(VerifyOtpRequestSchema)` + `otpVerifyRateLimiter` + `verifyOtp`; `POST /reset-password` → `validateBody(ResetPasswordRequestSchema)` + `resetPassword` (no rate limit specified in FRS/SDS for this endpoint). |

## 4. Tests

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| T1 | `apps/backend/tests/unit/auth.tokens.test.ts` | Mod | `generateOtp`: 6 digits, numeric, CSPRNG-backed (no `Math.random` calls — spy/mock check), correct expiry offset. `signResetToken`/`verifyResetToken`: round-trip; wrong `purpose` rejected; expired token throws; tampered signature throws. |
| T2 | `apps/backend/tests/unit/auth.service.test.ts` | Mod | Mocked-Prisma coverage of all 24 spec scenarios: enumeration-safe forgot-password (existing vs non-existing email, identical response/no DB write for the latter), OTP hash-only storage, prior-OTP invalidation on re-request, correct/incorrect/expired/already-used OTP branching order (hash-match-before-expiry), reset-token happy path, reset-token reuse (`resetTokenUsed` already `true`) → `INVALID_RESET_TOKEN`, expired reset token → `RESET_TOKEN_EXPIRED`, weak/same-as-current password rejections, bulk `refreshToken.deleteMany` on success (assert called with `{where: {userId}}`, not a single-token delete). |
| T3 | `apps/backend/tests/unit/auth.rate-limiters.test.ts` | New | Same pattern as existing `rate-limiter.test.ts`: mount each limiter standalone in a throwaway Express app, exceed the limit, assert `429` + correct `error.code`; assert keying is per-`body.email` (two different emails each get their own quota). |
| T4 | `apps/backend/tests/integration/setup.ts` | Mod | Add `await prisma.passwordResetOtp.deleteMany();` to `resetAuthTables()`. |
| T5 | `apps/backend/tests/integration/auth.integration.test.ts` | Mod | Add a `describe` block per endpoint. Since the OTP is console-logged (never in the response body per SDS §29.4/FR-PWD-001 AC1), tests spy on `console.log` (`vi.spyOn(console, 'log')`) around the `forgot-password` call and regex-extract the 6-digit code from the captured simulated-email block to drive the subsequent `verify-otp` call — this is the only way to obtain a valid OTP end-to-end without bypassing the API. Cases: full happy path (forgot → verify → reset → login with new password succeeds, old refresh token invalidated), unknown-email enumeration (200, no console log emitted), re-request invalidates prior OTP, wrong OTP, expired OTP (advance a fake/mocked clock or directly age the DB row via `prisma.passwordResetOtp.update` in the test to avoid a real 10-minute wait), OTP reuse, reset-token reuse, expired reset token (same DB-aging technique), weak new password, same-as-current password, missing-field validation errors on all three endpoints, rate-limit 429s (loop past the 3/5 request thresholds). |

**Note on testing expiry:** rather than waiting real wall-clock minutes, tests that need an
"expired" row directly `UPDATE` the row's `expiresAt` (or, for reset tokens, sign a token with a
negative `expiresIn` in a unit test) — consistent with how AB-1002's tests would have had to
handle `RefreshToken.expiresAt` if it tested expiry (it didn't need to, since login/refresh don't
require simulating time; this ticket does).

## 5. Build / Lint / Test Checkpoints

Run after the Prisma migration (§1):
```
docker compose up -d
pnpm db:migrate
pnpm db:generate
```

Run after `packages/shared` changes (§2):
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
```

Run after backend module changes (§3–§4):
```
pnpm --filter @note-app/backend build
pnpm --filter @note-app/backend lint --max-warnings 0
pnpm --filter @note-app/backend test
```

Final full-monorepo gate (CLAUDE.md mandatory quality gates) before commit:
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```
Confirm ≥80% coverage on all new/modified files (`pnpm --filter @note-app/backend test:coverage`).

## 6. Out of Scope (unchanged from spec.md)

- Frontend screens (UX-SCR-003/004/005) — AB-1010.
- Actual email delivery — console-logged only.
- Register/login/refresh/logout — AB-1002 (done).
- Any endpoint other than the three listed in §3/M6.

## 7. Points Needing Your Confirmation Before Implementation

1. **Migration approach (Architecture Decision #1):** adding `resetTokenUsed` to
   `PasswordResetOtp` is the smallest change I could find that makes single-use enforceable, but
   it is a schema change on a ticket the FRS/SDS didn't explicitly call out as needing one. If
   you'd rather avoid touching the schema at all, the fallback is a fully DB-backed opaque reset
   token (like the existing `RefreshToken` pattern) stored in a new table or extra columns
   instead — more consistent with "opaque + hashed" but a larger change, not smaller. I recommend
   proceeding with the single-column addition.
2. **No rate limit specified for `reset-password` itself** — FRS/SDS only define limits for the
   request and verify steps. Confirm that's intentional (the reset token's own 15-minute
   single-use expiry is the implicit protection) rather than an oversight to raise back against
   the FRS.

Waiting for your go-ahead (or edits) before moving to `/tasks` and implementation.
