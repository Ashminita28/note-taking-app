# AGENTS.md — Note Taking App

## Project Context
This is a full-stack Note Taking Application following SDD workflow.
Docs: `docs/FRS.md`, `docs/SDS.md`, `docs/UX.md`

## Specs & Workflow
- Ticket prefix: `AB-10XX`
- SDD cycle: spec → plan → tasks → implement → review → PR
- Every ticket MUST have an openspec proposal before implementation.

## Key Constraints
- No features beyond what's in FRS scope.
- No technology substitutions (CON-001 through CON-010).
- All emails are console-logged, never actually sent.
- Soft delete only — never hard delete notes within 30-day window.
- Tech Stack: React (Vite), Tailwind, Express, Postgres, Prisma. ALL packages must use exact pinned versions as defined in SDS.md.
- Testing: All backend changes require Vitest/Supertest updates. All frontend changes require Vitest/Playwright updates.