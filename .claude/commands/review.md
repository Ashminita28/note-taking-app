---
description: Self-review the ticket's implementation against its spec scenarios, run all tests, and check coverage.
argument-hint: [ticket-id, e.g. AB-1002]
---

# /review

Review the completed implementation for ticket `$1` against `openspec/tickets/$1.md`.

## Steps
1. Confirm every task in "## Tasks" is checked. If not, stop and point out what's unfinished.
2. Walk every scenario in "## Scenarios" and verify there is a passing test exercising it —
   quote the test name/file for each. Flag any scenario with no corresponding test.
3. Delegate a full adversarial pass to the `reviewer` sub-agent (`.claude/agents/reviewer.md`) to
   check error handling, edge cases, and security (auth/ownership checks, input validation,
   soft-delete behavior) against `docs/SDS.md` and `docs/FRS.md` Section 14 (Error Catalogue).
4. Run the full quality gate suite:
   - `pnpm build`
   - `pnpm lint --max-warnings 0`
   - `pnpm test -- --coverage` (or the workspace equivalent) and confirm ≥80% line/branch/function
     coverage on new code (SDS Section 30.4).
5. Verify architecture rules from the root `CLAUDE.md` weren't violated: no duplicated
   types/schemas outside `packages/shared`, layering respected, `userId` scoping present on every
   query, cross-user access returns 404.
6. Produce a findings list: each item is either "Confirmed OK" or a concrete defect with file:line
   and the scenario/requirement it violates. Do not just say "looks good" — show the evidence.

## Rules
- This is a verification pass, not a rewrite — fix defects found, don't refactor unrelated code.
- If coverage or a gate fails, that is a blocking finding, not a footnote.
- Do not mark the ticket reviewed if any scenario lacks a test or any gate is red.
