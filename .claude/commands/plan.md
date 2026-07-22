Create technical implementation plan for: $ARGUMENTS

Steps:
1. Read: openspec/tickets/$ARGUMENTS/proposal.md
2. Read: Relevant sections in docs/SDS.md (API contracts, DB schema, data fetching, state management)
3. Read: Relevant sections in docs/UX.md (Screen specs, design system tokens)
4. Read: AGENTS.md + domain CLAUDE.md files
5. Scan existing codebase for reusable patterns and shared schemas
6. Generate plan covering:
   - Exact file paths to create/modify
   - TypeScript interfaces and Zod schemas (matching SDS contracts)
   - Architecture decisions & DB changes
   - Build, lint, and test checkpoint commands
7. Save plan file to: openspec/tickets/$ARGUMENTS/plan.md
8. Wait for user approval before implementation.

Format: /plan AB-1002
