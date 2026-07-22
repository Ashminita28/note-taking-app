# Note Taking Application

Full-stack Note Taking Application (React + Express + PostgreSQL). Monorepo managed with pnpm
workspaces.

## Prerequisites

- Node.js 22.16.0 (LTS)
- pnpm 9.15.4 (`corepack enable` will pick up the pinned version automatically)
- Docker (for PostgreSQL)

## Setup

```bash
# 1. Install dependencies across all workspaces
pnpm install

# 2. Start PostgreSQL (creates both the dev and notetaking_test databases)
docker compose up -d

# 3. Copy the backend env file and fill in real secrets for local dev
cp apps/backend/.env.example apps/backend/.env

# 4. Run Prisma migrations against the dev database
pnpm db:migrate

# 5. Generate the Prisma client
pnpm db:generate
```

## Development

```bash
pnpm dev            # backend + frontend concurrently
pnpm dev:backend    # backend only (http://localhost:3000)
pnpm dev:frontend   # frontend only (http://localhost:5173)
```

## Quality Gates

```bash
pnpm build                    # zero TypeScript errors, zero warnings
pnpm lint --max-warnings 0    # ESLint, clean across all workspaces
pnpm test                     # Vitest unit/integration tests
```

## Database

PostgreSQL 16 runs via Docker Compose (`docker-compose.yml`). Data persists in the
`postgres_data` named volume. A `notetaking_test` database is created automatically on first
start via `docker/init-test-db.sql`, for use by backend integration tests.

## Monorepo Layout

```
apps/backend/     Express API
apps/frontend/    React SPA
packages/shared/  Shared TypeScript types, Zod schemas, and constants
```

See `docs/FRS.md`, `docs/SDS.md`, and `docs/UX.md` for the full specification, and
`openspec/tickets/` for per-ticket implementation proposals.
