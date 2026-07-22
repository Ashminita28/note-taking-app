# Technical Plan — AB-1002 (Backend Authentication)

Traces every file to a scenario in `openspec/tickets/AB-1002/spec.md`. Follows the layered
architecture (Router → Validation → Controller → Service → Prisma) and module structure
(`<name>.router/controller/service/errors.ts`) defined in `apps/backend/CLAUDE.md`.

## 0. Architecture Decisions

1. **Refresh token hashing algorithm** (spec open question, resolved): `node:crypto` SHA-256
   (`createHash('sha256')`), not bcrypt. Bcrypt is reserved for passwords (SDS §10.3) and is
   unsuitable here — refresh tokens need exact-match lookup by hash (`WHERE tokenHash = ?`),
   which requires a deterministic hash; bcrypt's salted output can't be looked up this way.
2. **Single-active-session semantics** (spec Scenario 12, resolved): on every successful login,
   all existing `RefreshToken` rows for that `userId` are deleted before the new one is created.
   This directly implements FRS AF-1 ("issues new tokens, invalidating the previous refresh
   token"). **Flagging once more before implementation starts:** this means logging in on a
   second device invalidates the first device's session. If multi-device support is actually
   wanted, tell me now and I'll scope it out to "add" instead of "replace."
3. **Express 5 native async error handling**: route handlers can be plain `async` functions that
   `throw` — Express 5.1 forwards rejected promises to `next(err)` automatically, so controllers
   need no manual `try/catch`.
4. **No DB schema changes.** `User` and `RefreshToken` already exist from AB-1001. This ticket
   only adds application code around them.
5. **New foundational (cross-cutting) pieces get introduced by this ticket** since it's the first
   to implement business logic: a shared `AppError` base class, a generic Zod body-validation
   middleware, a Prisma client singleton, and the JWT auth middleware. All are placed outside
   `modules/auth/` so later tickets (notes, tags, search, share, versions) reuse them without
   duplication.

## 1. `packages/shared` — Contracts

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| S1 | `packages/shared/src/utils/validation.ts` | Mod | Add `isStrongPassword(password: string): boolean` — checks ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 of `!@#$%^&*` (FRS §13.1). Replaces the `export {}` stub. |
| S2 | `packages/shared/src/schemas/auth.schemas.ts` | Mod | Replace stub with: `UserProfileSchema`, `RegisterRequestSchema`, `RegisterResponseSchema`, `LoginRequestSchema`, `LoginResponseSchema`, `RefreshRequestSchema`, `RefreshResponseSchema`, `LogoutRequestSchema`, `LogoutResponseSchema`, `MeResponseSchema`, `AccessTokenPayloadSchema`. Uses `NAME_MIN/MAX_LENGTH`, `EMAIL_MAX_LENGTH`, `PASSWORD_MIN/MAX_LENGTH` from `constants/limits.ts` and `isStrongPassword` from `utils/validation.ts`. Email fields `.trim().toLowerCase()`; name fields `.trim()`. |
| S3 | `packages/shared/src/types/auth.types.ts` | Mod | Replace stub with `z.infer<typeof ...>` exports for every schema in S2 (`UserProfile`, `RegisterRequest`, `RegisterResponse`, `LoginRequest`, `LoginResponse`, `RefreshRequest`, `RefreshResponse`, `LogoutRequest`, `LogoutResponse`, `MeResponse`, `AccessTokenPayload`) — no hand-written interfaces, per `packages/shared/CLAUDE.md`. |
| S4 | `packages/shared/tests/unit/auth.schemas.test.ts` | New | Valid/invalid cases per FRS §13.1 for every schema in S2 (weak password, bad email, oversized name, email lowercasing/trim, etc.). |
| S5 | `packages/shared/tests/unit/validation.test.ts` | New | Unit tests for `isStrongPassword` (missing uppercase/lowercase/digit/special, boundary lengths). |

`index.ts` barrel already re-exports `./schemas/auth.schemas.js`, `./types/auth.types.js`, and
`./utils/validation.js` — no barrel changes needed.

## 2. `apps/backend` — Cross-Cutting Foundations

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| B1 | `apps/backend/src/config/prisma.ts` | New | Exports a single `PrismaClient` instance (`export const prisma = new PrismaClient()`) for all modules to share. |
| B2 | `apps/backend/src/errors/app-error.ts` | New | `AppError` base class (`statusCode`, `code: ErrorCode`, `message`, `details: {field, message}[]`) and `ValidationError` subclass (422, `VALIDATION_ERROR`). |
| B3 | `apps/backend/src/middleware/validate.ts` | New | `validateBody(schema: ZodSchema)` — parses `req.body`, calls `next(new ValidationError(details))` on failure (mapping Zod issues to `{field, message}`), otherwise overwrites `req.body` with the parsed/transformed value and calls `next()`. |
| B4 | `apps/backend/src/middleware/auth.middleware.ts` | New | `requireAuth` — reads `Authorization: Bearer <token>`; missing/malformed header → `AccessTokenMissingError`; verifies via `verifyAccessToken` (auth.tokens.ts) catching `jsonwebtoken`'s `TokenExpiredError` → `AccessTokenExpiredError`, any other verify failure → `AccessTokenInvalidError`; on success sets `req.userId` and calls `next()`. |
| B5 | `apps/backend/src/types/express.d.ts` | New | Augments Express `Request` with `userId?: string` via declaration merging. |
| B6 | `apps/backend/src/middleware/error-handler.ts` | Mod | Add an `err instanceof AppError` branch that responds `{status: err.statusCode, body: {error: {code: err.code, message: err.message, details: err.details}}}`; unrecognized errors keep falling through to the existing 500/`INTERNAL_ERROR` path (existing test in `tests/unit/error-handler.test.ts` must keep passing unmodified). |
| B7 | `apps/backend/tests/unit/error-handler.test.ts` | Mod | Add a case: a thrown `AppError` subclass produces the mapped status/code/message/details envelope. |
| B8 | `apps/backend/tests/unit/validate.middleware.test.ts` | New | Valid body passes through; invalid body calls `next` with a `ValidationError` carrying field details. |
| B9 | `apps/backend/tests/unit/auth.middleware.test.ts` | New | Missing header → `TOKEN_MISSING`; malformed/bad-signature token → `TOKEN_INVALID`; expired token → `TOKEN_EXPIRED`; valid token → `req.userId` set and `next()` called with no error. |

## 3. `apps/backend/src/modules/auth` — Feature Module

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| M1 | `apps/backend/src/modules/auth/auth.errors.ts` | New | `EmailAlreadyExistsError` (409), `InvalidCredentialsError` (401), `AccessTokenMissingError` (401 `TOKEN_MISSING`), `AccessTokenExpiredError` (401 `TOKEN_EXPIRED`), `AccessTokenInvalidError` (401 `TOKEN_INVALID`), `InvalidRefreshTokenError` (401), `RefreshTokenExpiredError` (401) — all extend `AppError` (B2). |
| M2 | `apps/backend/src/modules/auth/auth.tokens.ts` | New | `signAccessToken({userId, email})`, `verifyAccessToken(token): AccessTokenPayload` (parses the decoded JWT through `AccessTokenPayloadSchema` for shape safety), `generateRefreshToken(): {token, tokenHash, expiresAt}` (`crypto.randomBytes(32).toString('hex')` + SHA-256 hash + expiry from `JWT_REFRESH_EXPIRY`), `hashToken(token): string`, and a small private `parseExpiryToMs('15m' \| '7d' \| ...)` duration parser. |
| M3 | `apps/backend/src/modules/auth/auth.service.ts` | New | `registerUser(prisma, input)`, `loginUser(prisma, input)`, `refreshTokens(prisma, input)`, `logoutUser(prisma, input)`, `getUserProfile(prisma, userId)`. Prisma is passed as the first argument (dependency injection) so unit tests can pass a mocked client instead of hitting a real database. No `req`/`res` access (per `apps/backend/CLAUDE.md`). |
| M4 | `apps/backend/src/modules/auth/auth.controller.ts` | New | Thin async handlers: `register`, `login`, `refresh`, `logout`, `getMe` — call the matching service function with `prisma` (B1) and `req.body`/`req.userId`, then `res.status(...).json(...)`. No manual error handling (Express 5 auto-forwards thrown/rejected errors). |
| M5 | `apps/backend/src/modules/auth/auth.router.ts` | New | `POST /register` → `validateBody(RegisterRequestSchema)` + `register`; `POST /login` → `validateBody(LoginRequestSchema)` + `login`; `POST /refresh` → `validateBody(RefreshRequestSchema)` + `refresh`; `POST /logout` → `requireAuth` + `validateBody(LogoutRequestSchema)` + `logout`; `GET /me` → `requireAuth` + `getMe`. Exports `authRouter`. |
| M6 | `apps/backend/src/app.ts` | Mod | Replace the "Feature routes are mounted here" comment with `app.use('/api/auth', authRouter)`. |

## 4. Tests — `apps/backend`

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| T1 | `apps/backend/tests/unit/auth.tokens.test.ts` | New | Sign/verify round-trip; expired-token rejection; refresh token uniqueness/hash correctness; duration parsing for `15m`/`7d`. |
| T2 | `apps/backend/tests/unit/auth.service.test.ts` | New | Each service function with a mocked Prisma client (`vi.fn()` per model method) covering every spec scenario: duplicate email, wrong password, unknown email, token rotation, expired/reused refresh token, idempotent logout, bcrypt cost factor used from `config.BCRYPT_ROUNDS`. |
| T3 | `apps/backend/tests/integration/setup.ts` | New | `beforeEach`/`afterEach` helper that truncates `RefreshToken` and `User` tables (via the B1 Prisma singleton) so integration tests run isolated against the real `notetaking_test` database (requires `docker compose up -d`). |
| T4 | `apps/backend/tests/integration/auth.integration.test.ts` | New | Supertest end-to-end coverage of all 5 endpoints against the real test DB — one case per scenario in `spec.md` §3 (register success/duplicate/validation, login success/invalid/validation/re-login-rotation, refresh success/rotation/expired/not-found/validation, logout success/idempotent/missing-token/invalid-token, `/me` success/missing/expired/invalid). |

## 5. Build / Lint / Test Checkpoints

Run after `packages/shared` changes (S-block), before touching backend:
```
pnpm --filter @note-app/shared build
pnpm --filter @note-app/shared test
```

Run after backend foundations + module (B/M blocks):
```
docker compose up -d
pnpm db:generate
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
Confirm ≥80% coverage on all new files (`pnpm --filter @note-app/backend test:coverage`, `pnpm --filter @note-app/shared test`).

## 6. Out of Scope (unchanged from spec.md)

- Password reset / OTP endpoints — AB-1003.
- Frontend auth screens/forms — AB-1010.
- Any Prisma schema/migration changes.
