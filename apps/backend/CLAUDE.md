# Backend CLAUDE.md

## Module Structure
Each feature module in `src/modules/<name>/` has:
- `<name>.router.ts` — Route definitions
- `<name>.controller.ts` — HTTP request handling
- `<name>.service.ts` — Business logic
- `<name>.errors.ts` — Domain error classes

## Rules
- Controllers MUST NOT contain business logic.
- Services MUST NOT access req/res objects.
- All errors thrown from services are caught by global error handler.
- No raw SQL except full-text search queries.
- Every endpoint must have integration tests.

## Testing
- Unit tests: `tests/unit/` — test services in isolation.
- Integration tests: `tests/integration/` — test endpoints with Supertest against test DB.
- Run: `pnpm test`
