---
description: Create an ordered implementation plan (file-by-file) from the ticket's OpenSpec proposal.
argument-hint: [ticket-id, e.g. AB-1002]
---

# /plan

Create the implementation plan for ticket `$1`, based on `openspec/tickets/$1.md` (run `/spec $1`
first if it doesn't exist yet).

## Steps
1. Read `openspec/tickets/$1.md` in full.
2. Read `docs/SDS.md` Sections 4–8 (architecture, layers, directory structure) plus whichever
   layer-specific sections apply (backend: Sections 13–20; frontend: Sections 21–23).
3. Check `apps/backend/CLAUDE.md`, `apps/frontend/CLAUDE.md`, and `packages/shared/CLAUDE.md` for
   the module/file conventions each layer must follow.
4. Produce an ordered list of file changes under a new "## Plan" section appended to
   `openspec/tickets/$1.md`. Order matters — dependencies first:
   - `packages/shared` additions/changes (types, schemas, constants) always come first if the
     ticket touches shared contracts.
   - Backend: Prisma schema/migration → service → controller → router → error classes →
     middleware wiring.
   - Frontend: API client method → hook (TanStack Query/Zustand) → component → page wiring.
   - Tests are planned alongside the code they cover, not as an afterthought at the end.
5. For each file, state: path, whether it's new or modified, and a one-line description of the
   change.
6. Flag any file this plan would touch that belongs to a later ticket's scope (per FRS 25.1/25.2)
   — that's a sign the plan has scope-crept and needs to be narrowed.

## Rules
- No code yet — this is a file-change plan, not a diff.
- Every planned file must trace back to a scenario or contract in `openspec/tickets/$1.md`.
- Keep the plan in dependency order so `/tasks` can turn it directly into an atomic checklist.
