# Technical Plan — AB-1001 (Project Setup)

Ordered file-change plan tracing every file to a scenario or contract.

### A. Root Workspace Foundation

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| A1 | `pnpm-workspace.yaml` | New | Declares `packages/*` and `apps/*` as workspace globs. |
| A2 | `tsconfig.base.json` | New | Shared strict TS compiler options, extended by every package. |
| A3 | `package.json` (root) | New | Workspace scripts and pinned root devDependencies per SDS §3.1.4. |
| A4 | `.gitignore` | New | Node modules, dist, env files, etc. |
| A5 | `.eslintrc.cjs` | New | Root ESLint config (`@typescript-eslint`, strict, prettier). |
| A6 | `.prettierrc` | New | Prettier formatting rules. |
| A7 | `commitlint.config.cjs` | New | Conventional commit format with restricted scopes. |
| A8 | `docker-compose.yml` | New | PostgreSQL 16 service, named volume, test DB. |
| A9 | `README.md` | New | Project documentation and setup instructions. |
| A10 | `.husky/pre-commit` | New | Runs lint + typecheck + test on pre-commit. |
| A11 | `.husky/commit-msg` | New | Runs commitlint on commit message. |

### B. `packages/shared`

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| B1 | `packages/shared/package.json` | New | Pinned shared package dependencies. |
| B2 | `packages/shared/tsconfig.json` | New | Shared package TS config. |
| B3 | `packages/shared/src/constants/errors.ts` | New | Full `ErrorCode` enum from FRS §14. |
| B4 | `packages/shared/src/constants/limits.ts` | New | Validation limits from FRS §13. |
| B5 | `packages/shared/src/constants/defaults.ts` | New | Application defaults from FRS/SDS. |
| B6–B13 | `packages/shared/src/types/*.ts` | New | Stub type files for domain packages. |
| B14–B20 | `packages/shared/src/schemas/*.ts` | New | Stub Zod schema files. |
| B21–B22 | `packages/shared/src/utils/*.ts` | New | Validation and formatting stubs. |
| B23 | `packages/shared/src/index.ts` | New | Barrel export of all shared constants, types, schemas, utils. |
| B24–B25 | `packages/shared/tests/unit/*` | New | Vitest config & placeholder unit tests. |

### C. Backend Scaffold (`apps/backend`)

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| C1–C2 | `apps/backend/package.json`, `tsconfig.json` | New | Backend manifest & TS config. |
| C3 | `apps/backend/prisma/schema.prisma` | New | All 8 database models from SDS §15. |
| C4–C5 | `apps/backend/prisma/migrations/*` | New | Migration files (initial schema + raw FTS trigger SQL). |
| C6–C8 | `.env.example`, `config/env.ts`, `seed.ts` | New | Env validation and seed entrypoint. |
| C9–C12 | `middleware/*.ts` | New | Request logger, rate limiter, not-found, and error handler middlewares. |
| C13–C14 | `app.ts`, `server.ts` | New | Express app assembly and server runner. |
| C15–C16 | `vitest.config.ts`, `tests/unit/*` | New | Backend Vitest config & unit tests. |

### D. Frontend Scaffold (`apps/frontend`)

| # | Path | New/Mod | Description |
|---|------|---------|-------------|
| D1–D6 | `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `components.json` | New | Frontend configuration & build tooling. |
| D7–D8 | `index.html`, `src/styles/globals.css` | New | HTML entry point & CSS variables. |
| D9–D12 | `lib/query-client.ts`, `lib/api-client.ts`, `stores/*.ts` | New | QueryClient, API client shell, and Zustand stores. |
| D13–D20 | `src/pages/*.tsx` | New | Placeholder page components for route table. |
| D21–D22 | `src/App.tsx`, `src/main.tsx` | New | Router table assembly & React root renderer. |
| D23–D26 | `vitest.config.ts`, `playwright.config.ts`, `tests/*` | New | Unit & E2E test suite configurations. |
