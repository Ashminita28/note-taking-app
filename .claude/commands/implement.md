---
description: Implement the next unchecked task for the ticket and run quality gates.
argument-hint: [ticket-id, e.g. AB-1002]
---

# /implement

Implement the next unchecked `- [ ]` task for ticket `$1` from the "## Tasks" section of
`openspec/tickets/$1.md`.

## Steps
1. Find the first unchecked task in `openspec/tickets/$1.md`. If none remain, tell the user the
   ticket is fully implemented and suggest `/review $1`.
2. Re-read the scenario(s) referenced by that task before writing any code.
3. Implement exactly that task — respect the module boundaries and rules in the relevant
   `CLAUDE.md` (`apps/backend/CLAUDE.md`, `apps/frontend/CLAUDE.md`, or
   `packages/shared/CLAUDE.md`) and the root `CLAUDE.md` architecture rules (soft delete,
   `userId` scoping, 404-not-403 on cross-user access, etc.).
4. Write or update the task's test alongside the implementation — don't defer tests to a later
   task unless the checklist explicitly separated them.
5. Run the quality gates for the affected workspace:
   - `pnpm build`
   - `pnpm lint --max-warnings 0`
   - `pnpm test`
6. If any gate fails, fix it before checking the box — do not check off a task with a red gate.
7. Check the task's box in `openspec/tickets/$1.md` once all gates pass.
8. Report which task was completed, which files changed, and the quality-gate results in a few
   sentences. Stop after one task unless the user asks to keep going.

## Rules
- One task per invocation — don't silently batch multiple checklist items.
- Never skip a quality gate to "come back to it later."
- If the task as written turns out to be wrong or too large, say so and propose a split rather
  than quietly doing something different.
