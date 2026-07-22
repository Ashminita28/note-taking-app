Break down into tasks for: $ARGUMENTS

Steps:
1. Read: openspec/tickets/$ARGUMENTS/proposal.md
2. Read: openspec/tickets/$ARGUMENTS/plan.md
3. Generate sequenced task checklist:
   - Phase 1: Foundation (shared types, DB migrations, package setups)
   - Phase 2: Core implementation
   - Phase 3: Integration & UI components
   - Phase 4: Unit, integration, and E2E tests
   - Checkpoint after each phase:
     * pnpm build → 0 errors
     * pnpm lint --max-warnings 0
     * pnpm test → all green
4. Save task checklist file to: openspec/tickets/$ARGUMENTS/tasks.md
5. Wait for user approval.

Format: /tasks AB-1002
