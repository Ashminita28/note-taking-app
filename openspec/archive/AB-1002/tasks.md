# Task Checklist — AB-1002 (Backend Authentication)

Sequenced from `openspec/tickets/AB-1002/plan.md`. File IDs (S*, B*, M*, T*) match the plan's
tables. This ticket makes no Prisma schema/migration changes — `User` and `RefreshToken` already
exist from AB-1001.

Outstanding decisions carried from the plan, treated as final unless flagged before implementation
starts: refresh tokens hashed with SHA-256 (not bcrypt); login enforces single-active-session
(new login deletes the user's existing refresh token(s)).

### Phase 1 — Foundation (shared types & cross-cutting scaffolding)

- [x] Add `isStrongPassword` to `packages/shared/src/utils/validation.ts` (S1)
- [x] Write `packages/shared/src/schemas/auth.schemas.ts` — all request/response/token-payload Zod schemas (S2)
- [x] Write `packages/shared/src/types/auth.types.ts` — `z.infer` exports only, no hand-written interfaces (S3)
- [x] Create `apps/backend/src/config/prisma.ts` — shared `PrismaClient` singleton (B1)
- [x] Create `apps/backend/src/errors/app-error.ts` — `AppError` base + `ValidationError` (B2)
- [x] Create `apps/backend/src/types/express.d.ts` — augment `Request` with `userId?: string` (B5)
- [x] No DB migration needed — confirm `User`/`RefreshToken` models are already in `schema.prisma` from AB-1001

**Checkpoint 1**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 2 — Core implementation (middleware & service layer)

- [x] Create `apps/backend/src/middleware/validate.ts` — generic `validateBody(schema)` (B3)
- [x] Create `apps/backend/src/modules/auth/auth.errors.ts` — 7 domain error classes extending `AppError` (M1)
- [x] Create `apps/backend/src/modules/auth/auth.tokens.ts` — sign/verify access token, generate/hash refresh token, expiry parsing (M2)
- [x] Create `apps/backend/src/middleware/auth.middleware.ts` — `requireAuth`, using `verifyAccessToken` from M2 (B4)
- [x] Update `apps/backend/src/middleware/error-handler.ts` — add `AppError` branch, keep existing 500 fallback path intact (B6)
- [x] Create `apps/backend/src/modules/auth/auth.service.ts` — `registerUser`, `loginUser`, `refreshTokens`, `logoutUser`, `getUserProfile` (Prisma injected as first arg) (M3)

**Checkpoint 2**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 3 — Integration (router wiring)

- [x] Create `apps/backend/src/modules/auth/auth.controller.ts` — thin async handlers, no manual try/catch (M4)
- [x] Create `apps/backend/src/modules/auth/auth.router.ts` — wire routes with `validateBody` + `requireAuth` (M5)
- [x] Update `apps/backend/src/app.ts` — mount `app.use('/api/auth', authRouter)` (M6)
- [x] Manual smoke check: `pnpm dev:backend` + one `curl`/Postman call to `POST /api/auth/register` and `GET /api/auth/me` against the running dev server

**Checkpoint 3**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

### Phase 4 — Unit, integration, and E2E tests

- [x] `packages/shared/tests/unit/auth.schemas.test.ts` — valid/invalid cases for every schema in S2 (S4)
- [x] `packages/shared/tests/unit/validation.test.ts` — `isStrongPassword` boundary cases (S5)
- [x] Update `apps/backend/tests/unit/error-handler.test.ts` — add `AppError` mapping case, keep existing 500 case green (B7)
- [x] `apps/backend/tests/unit/validate.middleware.test.ts` — pass-through and validation-failure cases (B8)
- [x] `apps/backend/tests/unit/auth.middleware.test.ts` — missing/malformed/expired/valid token cases (B9)
- [x] `apps/backend/tests/unit/auth.tokens.test.ts` — sign/verify round-trip, expiry parsing, hash correctness (T1)
- [x] `apps/backend/tests/unit/auth.service.test.ts` — every scenario in `spec.md` §3 against a mocked Prisma client (T2)
- [x] `apps/backend/tests/integration/setup.ts` — truncate `RefreshToken`/`User` between tests (T3)
- [x] `apps/backend/tests/integration/auth.integration.test.ts` — full Supertest coverage of all 5 endpoints against `notetaking_test` DB (`docker compose up -d` required) (T4)
- [x] No E2E (Playwright) tests — this ticket has no UI; AB-1010/AB-1016 cover E2E auth flows

**Checkpoint 4 (final quality gate)**
```
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm --filter @note-app/backend test:coverage
```
- [x] Confirm ≥80% coverage on all new/changed files in `apps/backend/src` and `packages/shared/src`
- [x] Confirm every Acceptance Criterion and Error Case in `spec.md` §3 has a passing test
