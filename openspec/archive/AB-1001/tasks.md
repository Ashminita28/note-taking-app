# Task Checklist — AB-1001 (Project Setup)

### A. Root Workspace Foundation

- [x] Create `pnpm-workspace.yaml` and `tsconfig.base.json` (A1, A2)
- [x] Create root `package.json` with workspace scripts and pinned devDependencies (A3)
- [x] Create `.gitignore` (A4)
- [x] Create `.eslintrc.cjs` and `.prettierrc` (A5, A6)
- [x] Create `commitlint.config.cjs` with restricted scope-enum (A7)
- [x] Create `docker-compose.yml` with PostgreSQL 16 service & `notetaking_test` DB (A8)
- [x] Create `README.md` documenting setup commands (A9)
- [x] Create `.husky/pre-commit` and `.husky/commit-msg` (A10, A11)

### B. `packages/shared`

- [x] Create `packages/shared/package.json` and `tsconfig.json` (B1, B2)
- [x] Populate `packages/shared/src/constants/errors.ts` with full `ErrorCode` enum (B3)
- [x] Populate `packages/shared/src/constants/limits.ts` with validation limits (B4)
- [x] Populate `packages/shared/src/constants/defaults.ts` with default values (B5)
- [x] Create stub type files under `packages/shared/src/types/` (B6–B13)
- [x] Create stub schema files under `packages/shared/src/schemas/` (B14–B20)
- [x] Create stub validation & formatting utilities (B21, B22)
- [x] Create `packages/shared/src/index.ts` barrel export (B23)
- [x] Create Vitest config & unit tests for `packages/shared` (B24, B25)

### C. Backend Scaffold (`apps/backend`)

- [x] Create `apps/backend/package.json` and `tsconfig.json` (C1, C2)
- [x] Create `apps/backend/prisma/schema.prisma` with all 8 models (C3)
- [x] Run `prisma migrate dev` for initial tables & indexes (C4)
- [x] Hand-author raw SQL migration for PostgreSQL FTS `searchVector` & GIN trigger (C5)
- [x] Create `.env.example` and Zod-validated `src/config/env.ts` (C7, C8)
- [x] Create request logger, rate limiter, not-found, and error handler middlewares (C9–C12)
- [x] Create `app.ts` middleware stack assembly & `server.ts` entrypoint (C13, C14)
- [x] Create Vitest config & unit tests for `apps/backend` (C15, C16)

### D. Frontend Scaffold (`apps/frontend`)

- [x] Create `apps/frontend/package.json`, `tsconfig.json`, `vite.config.ts`, Tailwind & PostCSS configs (D1–D5)
- [x] Create `components.json`, `index.html`, `globals.css` (D6–D8)
- [x] Create `QueryClient` provider, API client shell, and Zustand Auth/UI stores (D9–D12)
- [x] Create placeholder page components for route table (D13–D20)
- [x] Create `src/App.tsx` router assembly & `src/main.tsx` entrypoint (D21, D22)
- [x] Create Vitest & Playwright test configurations (D23–D26)

### E. Database & Client Verification

- [x] Confirm PostgreSQL container starts and `notetaking_test` DB exists
- [x] Run Prisma migrations & confirm table/index/trigger creation
- [x] Confirm Prisma client generation and exportability
- [x] Verify backend & frontend dev servers start cleanly
- [x] Verify commitlint and Husky hook enforcement

### F. Final Quality Gate

- [x] Run `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test` — all 100% green.
