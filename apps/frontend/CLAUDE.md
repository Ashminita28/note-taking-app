# Frontend CLAUDE.md

## Architecture
- Feature-based: `src/features/<name>/` for each domain.
- Pages in `src/pages/` compose features.
- Shared UI in `src/components/ui/` (shadcn/ui).
- All API calls go through `src/lib/api-client.ts`.

## Rules
- ALL types imported from `@note-app/shared` — never define locally.
- Use TanStack Query for ALL server data fetching.
- Use Zustand ONLY for auth state and UI state.
- Use React state for form inputs.
- Every component must have accessible labels and keyboard support.

## Testing
- Unit tests: `tests/unit/` — test components and hooks.
- E2E tests: `tests/e2e/` — Playwright full journey tests.
