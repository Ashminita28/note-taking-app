# Task Checklist — AB-1003 (Backend Password Reset / OTP)

Sequenced from `openspec/tickets/AB-1003/plan.md`. File IDs (P*, S*, M*, T*) match the plan's
tables.

Outstanding decisions carried from the plan, treated as final unless flagged before implementation
starts: reset token is a stateless JWT (`purpose: 'password_reset'`, signed with `JWT_SECRET`)
whose single-use is enforced via a new `resetTokenUsed` column on `PasswordResetOtp`; OTPs hashed
with SHA-256 (not bcrypt); `reset-password` deletes **all** of the user's refresh tokens (BR-013);
rate limiting is per-email (not per-IP) on `forgot-password` (3/hr) and `verify-otp` (5/hr) only —
no rate limit on `reset-password` itself, per FRS/SDS silence on that endpoint.

### Phase 1 — Foundation (DB migration & shared contracts)

- [x] Add `resetTokenUsed Boolean @default(false)` to `model PasswordResetOtp` in `apps/backend/prisma/schema.prisma` (P1)
- [x] Run `docker compose up -d` and `pnpm db:migrate` to generate the migration, then `pnpm db:generate` (P2)
- [x] Add `OTP_LENGTH = 6` to `packages/shared/src/constants/limits.ts` (S1)
- [x] Add to `packages/shared/src/schemas/auth.schemas.ts`: `ForgotPasswordRequestSchema`, `ForgotPasswordResponseSchema`, `VerifyOtpRequestSchema`, `VerifyOtpResponseSchema`, `ResetPasswordRequestSchema`, `ResetPasswordResponseSchema`, `ResetTokenPayloadSchema` (S2)
- [x] Add corresponding `z.infer` exports to `packages/shared/src/types/auth.types.ts` — no hand-written interfaces (S3)

**Checkpoint 1**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 2 — Core implementation (tokens, rate limiters, service layer)

- [x] Update `apps/backend/src/modules/auth/auth.errors.ts` — add `InvalidOtpError`, `OtpExpiredError`, `InvalidResetTokenError`, `ResetTokenExpiredError`, `PasswordSameAsCurrentError` (M1)
- [x] Update `apps/backend/src/modules/auth/auth.tokens.ts` — add `generateOtp()`, `signResetToken()`, `verifyResetToken()`, reusing existing `hashToken()` (M2)
- [x] Create `apps/backend/src/modules/auth/auth.rate-limiters.ts` — `otpRequestRateLimiter` (3/hr per email), `otpVerifyRateLimiter` (5/hr per email), each with a custom 429 handler returning the correct error code (M3)
- [x] Update `apps/backend/src/modules/auth/auth.service.ts` — add `requestPasswordReset`, `verifyOtp`, `resetPassword` (M4)

**Checkpoint 2**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 3 — Integration (router wiring)

- [x] Update `apps/backend/src/modules/auth/auth.controller.ts` — add `forgotPassword`, `verifyOtp`, `resetPassword` handlers (M5)
- [x] Update `apps/backend/src/modules/auth/auth.router.ts` — wire the three new routes with `validateBody` + the matching rate limiter (M6)
- [x] Manual smoke check: `pnpm dev:backend`, then walk the full flow via `curl`/Postman — `POST /forgot-password` (watch console for the simulated email block), copy the logged OTP into `POST /verify-otp`, copy the returned `resetToken` into `POST /reset-password`, then confirm login with the old password fails and the new password succeeds

**Checkpoint 3**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] Update `packages/shared/tests/unit/auth.schemas.test.ts` — valid/invalid cases for every schema in S2 (S4)
- [x] Update `apps/backend/tests/unit/auth.tokens.test.ts` — `generateOtp` (6 digits, numeric, CSPRNG, expiry offset), `signResetToken`/`verifyResetToken` round-trip, wrong-`purpose` rejection, expired-token rejection, tampered-signature rejection (T1)
- [x] Update `apps/backend/tests/unit/auth.service.test.ts` — mocked-Prisma coverage of all 24 scenarios in `spec.md` §3: email-enumeration safety, OTP hash-only storage, prior-OTP invalidation on re-request, hash-match-before-expiry branching, OTP single-use, reset-token happy path, reset-token reuse, expired reset token, weak/same-as-current password rejections, bulk `refreshToken.deleteMany({where:{userId}})` on success (T2)
- [x] Create `apps/backend/tests/unit/auth.rate-limiters.test.ts` — 429 + correct error code once the per-email threshold is exceeded, independent quotas for different emails (T3)
- [x] Update `apps/backend/tests/integration/setup.ts` — truncate `passwordResetOtp` in `resetAuthTables()` (T4)
- [x] Update `apps/backend/tests/integration/auth.integration.test.ts` — full Supertest coverage of all 3 endpoints against `notetaking_test` DB, capturing the console-logged OTP via `vi.spyOn(console, 'log')` to drive the verify step; cover happy path, enumeration, re-request invalidation, wrong/expired OTP (age the DB row directly rather than waiting), OTP reuse, reset-token reuse/expiry, weak/same-as-current password, missing-field validation, and both rate limits (T5)
- [x] No E2E (Playwright) tests — this ticket has no UI; AB-1010/AB-1016 cover E2E password-reset flows

**Checkpoint 4 (final quality gate)**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirm ≥80% coverage on all new/changed files in `apps/backend/src` and `packages/shared/src`
- [x] Confirm every Acceptance Criterion and Error Case in `spec.md` §3 (all 24 scenarios) has a passing test
