# AB-1001 — Project Setup Spec

## 1. Ticket

- **ID:** AB-1001
- **Title:** Project Setup
- **Dependencies:** None (first ticket in sequence, per CON-006)
- **Status:** completed

## 2. Requirements Covered

This ticket is infrastructure-only. The Requirement Traceability Matrix (FRS §25.1) lists no
Related Requirement IDs, APIs, or Database Objects for AB-1001 — it establishes the scaffolding
that later tickets (AB-1002 onward) will implement functional requirements against.

| Requirement ID | Restatement |
| --------------- | ----------- |
| — | None. No FR-* requirement is implemented by this ticket. |

## 3. Scenarios

One scenario per acceptance criterion in FRS §25.3 (AB-1001).

### Scenario 1 — Clean install across workspaces
- **Given** a fresh clone of the repository with pnpm installed
- **When** `pnpm install` is run at the repo root
- **Then** dependencies resolve and install for `packages/shared`, `apps/backend`, and
  `apps/frontend` with zero errors.

### Scenario 2 — Zero-error, zero-warning build
- **Given** all workspace packages are scaffolded with their `tsconfig.json` extending
  `tsconfig.base.json`
- **When** `pnpm build` is run
- **Then** it produces zero TypeScript errors and zero warnings across all packages.

### Scenario 3 — Clean lint
- **Given** ESLint is configured with TypeScript rules (`noImplicitAny`, strict mode) at the root
- **When** `pnpm lint --max-warnings 0` is run
- **Then** it passes with no errors or warnings.

### Scenario 4 — Test runner executes with no failures
- **Given** Vitest is configured for unit/integration tests and Playwright for E2E
- **When** `pnpm test` is run with no test files present (or only placeholder tests)
- **Then** the command completes successfully with no failures.

### Scenario 5 — Backend dev server starts
- **Given** the Express 5 app (`app.ts`, `server.ts`) and validated env config are scaffolded
- **When** `pnpm dev:backend` is run
- **Then** the Express server starts and listens on the configured `PORT` (default `3000`) without
  errors.

### Scenario 6 — Frontend dev server starts
- **Given** the Vite + React 19 + TypeScript project is scaffolded with Tailwind, shadcn/ui, and
  React Router
- **When** `pnpm dev:frontend` is run
- **Then** the Vite dev server starts without errors.

### Scenario 7 — Database container starts and is reachable
- **Given** `docker-compose.yml` defines a PostgreSQL 16 service with a persistent volume
- **When** `docker compose up -d` is run
- **Then** PostgreSQL starts and is reachable at the configured connection details, and a separate
  `notetaking_test` database exists.

### Scenario 8 — Prisma migrations create all tables
- **Given** `schema.prisma` defines all models from SDS §15 (`User`, `Note`, `Tag`, `NoteTag`,
  `NoteVersion`, `ShareLink`, `RefreshToken`, `PasswordResetOtp`) plus the raw SQL migration for
  `searchVector`/GIN index/trigger from SDS §24.3
- **When** `pnpm db:migrate` is run against the running database
- **Then** all tables, indexes, and the search-vector trigger are created successfully with no
  errors.

### Scenario 9 — Prisma client generation
- **Given** a valid `schema.prisma`
- **When** `pnpm db:generate` is run
- **Then** the Prisma client generates without errors and is importable in the backend.

### Scenario 10 — Pre-commit hook enforcement
- **Given** Husky is configured per CON-010 (lint + type-check + test on pre-commit)
- **When** a `git commit` is attempted
- **Then** the Husky pre-commit hook triggers and runs the configured checks before allowing the
  commit.

### Scenario 11 — Commit message format enforcement
- **Given** commitlint is configured with the conventional format `type(scope): description
  AB#ticket` (SDS §32.4)
- **When** a commit is made with a non-conventional message
- **Then** commitlint rejects the commit.

### Scenario 12 — Commit message format acceptance
- **Given** the same commitlint configuration
- **When** a commit is made matching the format (e.g. `chore(config): add ESLint configuration
  AB#1001`)
- **Then** the commit is accepted.

### Scenario 13 — Shared package importable from both apps
- **Given** `packages/shared` is built with barrel exports (`index.ts`) for types, schemas, and
  constants stubs (SDS §9.2)
- **When** `apps/backend` and `apps/frontend` import from `@note-app/shared`
- **Then** the import resolves with correct TypeScript types in both packages.

## 4. API / Interface Contract

None. This ticket introduces no REST endpoints, UI screens, or component contracts — it is
scaffolding only.

## 5. Data Model Impact

- **New Prisma models** (all from SDS §15): `User`, `Note`, `Tag`, `NoteTag`, `NoteVersion`,
  `ShareLink`, `RefreshToken`, `PasswordResetOtp`.
- **New migration:** initial Prisma migration creating all tables/indexes above.
- **New raw SQL migration** (SDS §24.3): adds `searchVector` (`tsvector`) column to `Note`, GIN
  index `idx_note_search_vector`, and the `note_search_vector_update` trigger function.

## 6. Out of Scope

- Any authentication logic, notes CRUD, tags, search, sharing, version history.
- AI development infrastructure (bootstrapped in Phase 0).
