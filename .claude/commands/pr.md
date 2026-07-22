Prepare PR for: $ARGUMENTS

Steps:
1. Run quality gates:
   `pnpm build`
   `pnpm lint --max-warnings 0`
   `pnpm test`
   (Fix any failures before proceeding)
2. Move openspec/tickets/$ARGUMENTS/ folder to openspec/archive/$ARGUMENTS/ if not already archived.
3. Generate commit message: `type(scope): description AB#ticket`
4. Ask: "Run git add . && git commit? [y/n]"
5. Generate PR description:
   ## What
   ## FRS Requirements Covered
   ## Spec Artifacts
   ## Quality Gates Checklist
   ## Test Coverage Results
6. Ask: "Run git push? [y/n]"

Format: /pr AB-1002
