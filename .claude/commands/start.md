---
description: Begin a new ticket — load its scope from FRS Section 25.3 and set working context.
argument-hint: [ticket-id, e.g. AB-1002]
---

# /start

Begin work on ticket `$1` (format `AB-10XX`).

## Steps
1. Read `docs/FRS.md` Section 25.3 and locate the subsection for `$1`. Extract:
   - Description
   - Dependencies
   - Scope ("What to build")
   - Acceptance Criteria
2. Confirm the ticket's dependencies are actually done:
   - Check `openspec/archive/` for the dependency ticket's archived spec.
   - If a dependency is missing or incomplete, stop and tell the user — do not proceed out of
     order (CON-006: tickets AB-1001 through AB-1016 MUST be followed in sequence).
3. Cross-reference `docs/FRS.md` Section 25.1/25.2 (Requirement Traceability Matrix) for `$1` to
   identify the Related Requirement IDs, Related APIs/UX Screens, and Related Database Objects.
4. Read the relevant sections of `docs/SDS.md` for those APIs/entities (endpoint specs in Section
   17, Prisma models in Section 15, relevant architecture sections) and `docs/UX.md` for any
   referenced UX-SCR-* screens.
5. Summarize back to the user in under 200 words:
   - What `$1` covers and what it explicitly excludes
   - Which requirement IDs, endpoints/screens, and DB objects are in play
   - Any open questions or ambiguities in the spec that need clarifying before `/spec`
6. Do NOT write code or create the OpenSpec proposal yet — that's `/spec`'s job. This command only
   loads and confirms context.
