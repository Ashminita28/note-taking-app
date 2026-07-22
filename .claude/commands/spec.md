---
description: Generate an OpenSpec proposal for the current ticket from FRS, SDS, and UX.
argument-hint: [ticket-id, e.g. AB-1002]
---

# /spec

Generate the OpenSpec proposal for ticket `$1` at `openspec/tickets/$1.md`. Run `/start $1` first
if the ticket context has not been loaded yet in this session.

## Inputs
- `docs/FRS.md` Section 25.3 — ticket scope, dependencies, acceptance criteria.
- `docs/FRS.md` Sections 9–14 — functional requirements, business rules, validation rules, error
  catalogue for every Related Requirement ID.
- `docs/SDS.md` — API contracts (Section 17), data model (Section 15), and any architecture
  sections relevant to this ticket's endpoints/entities.
- `docs/UX.md` — screen and flow specs for every Related UX Screen.
- `openspec/project.md` — project-wide context, constraints, and conventions.

## Proposal Structure
Write `openspec/tickets/$1.md` with these sections:

1. **Ticket** — ID, title, dependencies, status (`proposed`).
2. **Requirements Covered** — table of Requirement IDs with a one-line restatement of each.
3. **Scenarios** — one scenario per acceptance criterion / business rule / error case, in
   Given/When/Then form. Every acceptance criterion in FRS 25.3 for `$1` MUST map to at least one
   scenario. Include negative/error scenarios from the FRS Error Catalogue (Section 14) that apply.
4. **API / Interface Contract** — endpoints, request/response shapes, or component/screen contracts
   this ticket introduces or changes, matching SDS exactly (no invented fields or routes).
5. **Data Model Impact** — Prisma models or migrations touched, if any.
6. **Out of Scope** — explicitly list adjacent things this ticket does NOT do (pull from FRS 4.2
   and the ticket's own scope boundary vs. neighboring tickets).
7. **Open Questions** — anything ambiguous that needs a decision before `/plan`.

## Rules
- Do not invent requirements, endpoints, or fields not present in FRS/SDS/UX.
- Do not write implementation code in this step.
- Keep scope tight to the ticket boundary in FRS 25.3 — do not pull in work from later tickets.
- If the proposal reveals a spec ambiguity or conflict between FRS/SDS/UX, surface it under "Open
  Questions" rather than silently resolving it.
