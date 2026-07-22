Implement: $ARGUMENTS

Before writing code, read:
1. AGENTS.md
2. docs/FRS.md (Section 25.3 per-ticket scope for $ARGUMENTS)
3. docs/SDS.md (Relevant technical specs for $ARGUMENTS)
4. Domain CLAUDE.md files
5. openspec/tickets/$ARGUMENTS/spec.md
6. openspec/tickets/$ARGUMENTS/plan.md
7. openspec/tickets/$ARGUMENTS/tasks.md

Rules:
- Work through tasks.md sequentially phase by phase.
- After every phase checkpoint: run `pnpm build && pnpm lint --max-warnings 0 && pnpm test`.
- Write tests alongside implementation.
- Never commit with failing tests or lint errors.
- At 60k tokens: save state to `session-context.md` → `/clear` → resume.
- When all tasks complete: move the entire folder openspec/tickets/$ARGUMENTS/ to openspec/archive/$ARGUMENTS/.

Output when done:
## Files Changed + Why
## Spec Scenarios Covered
## FRS Requirements Covered
## Quality Gates Verification Results

Format: /implement AB-1002
