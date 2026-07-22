---
description: Break the ticket's implementation plan into an atomic, checkbox-tracked task list.
argument-hint: [ticket-id, e.g. AB-1002]
---

# /tasks

Convert the "## Plan" section of `openspec/tickets/$1.md` into an atomic task checklist (run
`/plan $1` first if no plan exists yet).

## Steps
1. Read the "## Plan" section of `openspec/tickets/$1.md`.
2. Append a "## Tasks" section with one `- [ ]` checkbox per atomic unit of work. Each task must be:
   - Small enough to implement and quality-gate in one `/implement` pass.
   - Independently verifiable (a service method + its unit test is one task; a controller +
     its integration test is another).
   - Ordered so that earlier tasks unblock later ones (shared types before backend, backend before
     frontend integration, implementation before its own tests only if tests can't be written
     test-first — otherwise pair them).
3. For each task, note in parentheses which scenario(s) from "## Scenarios" it satisfies, e.g.
   `- [ ] Implement POST /api/auth/register service method (Scenario: register with valid data)`.
4. Add a final task: "Run full quality gates (`pnpm build`, `pnpm lint --max-warnings 0`, `pnpm
   test`) and confirm ≥80% coverage on new code."

## Rules
- Do not start implementing — `/tasks` only produces the checklist.
- Every scenario in the ticket's spec must be covered by at least one task.
- Keep task descriptions concrete (file paths, function/endpoint names) so `/implement` can pick
  up the next unchecked box with no ambiguity.
