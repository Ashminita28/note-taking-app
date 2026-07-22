# OpenSpec Project Context — Note Taking Application

## Purpose
A full-stack web platform that enables authenticated users to create, organize, search, and share
rich-text notes. This file grounds every ticket's OpenSpec proposal in the same project context so
proposals stay consistent with `docs/FRS.md`, `docs/SDS.md`, and `docs/UX.md`.

## Source of Truth
| Document      | Defines                                                              |
| ------------- | --------------------------------------------------------------------- |
| `docs/FRS.md` | Functional requirements, business rules, validation rules, error catalogue, ticket scope (Section 25.3) |
| `docs/SDS.md` | Architecture, API contracts, database design, coding standards, AI infrastructure |
| `docs/UX.md`  | Screens, flows, interaction patterns                                 |

## Scope

### In Scope
1. User Authentication — registration, login, logout, password reset via OTP.
2. Notes Management — full CRUD on rich-text notes with soft delete and 30-day recovery.
3. Tagging System — user-scoped tags with color support and per-tag note counts.
4. Full-Text Search — PostgreSQL-powered search with keyword highlighting.
5. Note Sharing — public read-only links with configurable expiry and atomic view counting.
6. Version History — automatic snapshots on every save; view and restore any historical version.

### Out of Scope
- Real-time collaborative editing
- File or image attachments
- Native mobile application
- OAuth / social login
- Note folders or nesting
- Actual email sending (all emails are logged to console only)

## Technology Stack (fixed — no substitutions, CON-001)
| Layer              | Technology                         | Version        |
| ------------------ | ----------------------------------- | --------------- |
| Monorepo Manager   | pnpm Workspaces                     | 9.15.4          |
| Language           | TypeScript                          | 5.9.2           |
| Frontend Framework | React                               | 19.1.0          |
| Build Tool (FE)    | Vite                                | 6.0.11          |
| UI Primitive       | Tailwind CSS + shadcn/ui (Radix)    | 3.4.19          |
| Rich Text Editor   | TipTap (ProseMirror wrapper)        | 2.11.5          |
| State Management   | TanStack Query v5 + Zustand         | 5.75.0 / 4.5.7  |
| Backend Runtime    | Node.js                             | 22.16.0 (LTS)   |
| Web Framework      | Express                             | 5.1.0           |
| Database           | PostgreSQL                          | 16.8            |
| ORM                | Prisma                              | 6.6.0           |
| Validation         | Zod                                 | 3.24.4          |
| Password Hashing   | bcrypt                              | 5.1.1           |
| Testing (Unit)     | Vitest                              | 3.2.1           |
| Testing (API)      | Supertest                           | 7.1.0           |
| Testing (E2E)      | Playwright                          | 1.52.0          |

All versions are pinned exactly in `package.json` — no ranges, no `@latest` (CON-008).

## Architectural Patterns
1. **Monorepo Workspaces** — `packages/shared`, `apps/backend`, `apps/frontend`.
2. **Layered Architecture (Backend)** — Router → Validation (Zod) → Controller → Service → Prisma.
3. **Feature-Based Architecture (Frontend)** — `src/features/<domain>/` per feature.
4. **Single Source of Truth Validation** — all Zod schemas live in `packages/shared`; both client and server validate against them.
5. **Stateless JWT + Stateful Refresh Session** — short-lived JWT access tokens, DB-backed refresh tokens.

## Constraints (non-negotiable)
| ID      | Constraint                                                                  |
| ------- | ---------------------------------------------------------------------------- |
| CON-001 | Technology stack is fixed — no substitutions.                               |
| CON-002 | Monorepo MUST use pnpm workspaces.                                           |
| CON-003 | All TypeScript types and Zod schemas MUST reside in `packages/shared`.       |
| CON-004 | Full-text search MUST use PostgreSQL's built-in capabilities only.           |
| CON-005 | Email functionality MUST be simulated (console logging only).               |
| CON-006 | Ticket sequence (AB-1001 through AB-1016) MUST be followed in order.        |
| CON-007 | Soft delete = `deletedAt` timestamp only; no physical deletion within 30 days. |
| CON-008 | All tool versions MUST be pinned in `package.json`.                         |
| CON-009 | Every commit MUST follow conventional commit format: `type(scope): description AB#ticket`. |
| CON-010 | Husky pre-commit hooks MUST enforce lint, test, and TypeScript checks.       |

## Ticket Workflow
- Ticket prefix: `AB-10XX` (see `docs/FRS.md` Section 25 for the full traceability matrix and Section 25.3 for per-ticket scope).
- SDD cycle per ticket: `/start` → `/spec` → `/plan` → `/tasks` → `/implement` → `/review` → `/pr`.
- Every ticket MUST have an OpenSpec proposal under `openspec/tickets/AB-10XX.md` before implementation begins.
- Completed ticket specs move to `openspec/archive/`.

## Directory Structure
```
note-taking-app/
├── docs/                  # FRS.md, SDS.md, UX.md
├── packages/shared/       # Shared types, Zod schemas, constants, utils
├── apps/backend/          # Express API (modules: auth, notes, tags, search, share, versions)
├── apps/frontend/         # React SPA (feature-based)
├── openspec/              # This file + per-ticket proposals
├── .claude/commands/      # /start /spec /plan /tasks /implement /review /pr
├── .claude/agents/        # reviewer, test-writer sub-agents
├── AGENTS.md              # Universal AI context
└── CLAUDE.md              # Claude-specific rules and quality gates
```
