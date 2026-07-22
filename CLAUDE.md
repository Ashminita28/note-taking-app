# CLAUDE.md — Note Taking App

## Project Overview
Full-stack Note Taking Application (React + Express + PostgreSQL).
Monorepo with pnpm workspaces.

## Quality Gates (MANDATORY before every commit)
1. `pnpm build` — zero errors, zero warnings
2. `pnpm lint --max-warnings 0` — clean
3. `pnpm test` — all green, ≥80% coverage on new code

## Commit Format
`type(scope): description AB#ticket`
Types: feat | fix | chore | refactor | test | docs
Scopes: auth | notes | tags | search | share | versions | shared | config

## Key Architecture Rules
- Shared types/schemas ONLY in `packages/shared` — NEVER duplicate.
- Backend layers: Router → Validation → Controller → Service → Prisma.
- Frontend state: TanStack Query (server) + Zustand (auth/UI).
- Soft delete = set `deletedAt` timestamp, NEVER hard delete notes.
- All queries MUST include `WHERE userId = <authUserId>`.
- Access to another user's resource MUST return 404, not 403.

## Database
- PostgreSQL 16 via Docker: `docker compose up -d`
- Migrations: `pnpm db:migrate`
- Client gen: `pnpm db:generate`

## Development
- Backend: `pnpm dev:backend` (port 3000)
- Frontend: `pnpm dev:frontend` (port 5173)
- Full: `pnpm dev`
