# Shared Package CLAUDE.md

## Purpose
Single source of truth for all data contracts shared between frontend and backend.
No type or schema SHALL be duplicated in `apps/backend` or `apps/frontend` (CON-003).

## Structure
```
src/
├── types/       # Domain types (auth, note, tag, search, share, version, common, error)
├── schemas/     # Zod schemas mirroring each types file
├── constants/   # errors.ts, limits.ts, defaults.ts
└── utils/       # validation.ts, formatting.ts
```

## Rules
- Prefer `z.infer<typeof schema>` over hand-written interfaces — types are derived from schemas, not duplicated alongside them.
- No runtime dependencies beyond `zod`.
- All public exports go through the `index.ts` barrel — no deep-importing internal files from `apps/backend` or `apps/frontend`.
- Adding a field to a request/response requires updating the schema here first; backend validation and frontend types both consume the change.
- Package is published as ESM with TypeScript declarations (`tsc` build, no bundler).

## Testing
- Unit tests: `tests/unit/` — test schemas (valid/invalid input) and utils in isolation.
- Run: `pnpm test`
