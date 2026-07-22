---
description: Generate a PR description listing FRS requirements covered and spec scenarios tested.
argument-hint: [ticket-id, e.g. AB-1002]
---

# /pr

Generate the pull request description for ticket `$1`. Run `/review $1` first if it hasn't passed
yet — do not draft a PR for a ticket with failing gates or unchecked tasks.

## Steps
1. Read `openspec/tickets/$1.md` (Requirements Covered, Scenarios, Tasks) and `git diff` /
   `git log` against `main` for the actual changes made on this branch.
2. Compose a PR description with:
   - **Title**: `type(scope): description AB#$1` matching the commit format in root `CLAUDE.md`
     and SDS Section 32.4.
   - **Summary**: 2-4 bullets on what changed and why, in plain language.
   - **Requirements Covered**: table of Requirement IDs from the ticket's "Requirements Covered"
     section, each with a one-line note on how it was satisfied.
   - **Scenarios Tested**: list every scenario from "## Scenarios" with the test file/name that
     covers it.
   - **Quality Gates**: paste the final `pnpm build` / `pnpm lint --max-warnings 0` / `pnpm test`
     results (pass/fail, coverage %).
   - **Out of Scope / Follow-ups**: anything deliberately deferred (from the ticket's "Out of
     Scope" section or discovered during implementation).
3. Move `openspec/tickets/$1.md` to `openspec/archive/$1.md` once the PR is opened.
4. Do not push or open the PR yourself unless the user explicitly asks — hand back the drafted
   title/body for the user to review first.

## Rules
- Every Requirement ID and scenario claimed as "covered" must be traceable to an actual test or
  code change in the diff — don't claim coverage that isn't there.
- Keep the summary focused on this ticket's scope; don't describe unrelated changes.
