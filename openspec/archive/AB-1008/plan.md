# AB-1008 — Backend Sharing: Implementation Plan

## 1. Summary

Implement all 4 share endpoints (`POST/DELETE /api/notes/:id/share`, `GET /api/shares`, `GET /api/shared/:token`) as a new `share` module, following the existing layering (router → validate → controller → service → errors). No new Prisma models/migrations — `ShareLink` already exists (AB-1001) and its hard-delete-on-soft-delete side effect already exists (AB-1004).

Resolved open questions from `spec.md`:
1. **Expired-link replacement:** `update` the existing `ShareLink` row in place (new `token`, `expiresAt`, reset `viewCount: 0`, refreshed `createdAt`) rather than delete+create — avoids a race on the unique `noteId` constraint between the two statements.
2. **`FRONTEND_URL` source:** new required env var (`apps/backend/src/config/env.ts`), distinct from `CORS_ORIGIN` — they express different concerns (allowed CORS origin vs. the public URL embedded in share links) even though they share the same value in dev.
3. **Author name:** `User.name`, joined via `ShareLink → Note → User`, surfaced as `authorName`.
4. **`GET /api/shares` note title for a link on a soft-deleted note:** not defensively filtered — unreachable in practice since BR-014 hard-deletes the `ShareLink` synchronously with the soft delete.

**New architecture decision not flagged in `spec.md`:** SDS §25.3 illustrates the atomic view-count increment as raw SQL (`UPDATE ... RETURNING`), but `apps/backend/CLAUDE.md` restricts raw SQL to full-text search only (already used exclusively by `search.service.ts`, confirmed by reading it). Prisma's native atomic field update (`data: { viewCount: { increment: 1 } }` inside `updateMany`) generates the same single atomic `UPDATE ... SET "viewCount" = "viewCount" + 1 WHERE ...` statement PostgreSQL would run for the raw SQL version — no lost updates under concurrency (Scenario 11) — while staying inside the Prisma query builder. This satisfies SDS §25.3's atomicity *requirement* without violating the backend's no-raw-SQL constraint. Documenting this here since it's a deviation from the SDS's literal example, not from its intent.

**Token param validation:** `GET /api/shared/:token` treats `token` as `z.string().min(1)`, not `z.string().uuid()`. FRS EC-1 expects a *404* for any unrecognized token; enforcing UUID format at the validation layer would instead return `422 VALIDATION_ERROR` for a malformed-but-clearly-wrong token on a public, unauthenticated route, which isn't in the FRS error table for this endpoint. Format is irrelevant to the outcome — an unknown token of any shape is "not found."

## 2. Files to Create

### `packages/shared/src/schemas/share.schemas.ts` (currently `export {};` placeholder — replace)
```ts
import { z } from 'zod';
import { SHARE_EXPIRY_MIN_HOURS, SHARE_EXPIRY_MAX_HOURS } from '../constants/limits.js';

/** Canonical source: FRS FR-SHARE-001–004, SDS Section 17.5/25 (sharing architecture). */

/**
 * No `.default()` here — the actual default (`DEFAULT_SHARE_EXPIRY_HOURS` / `SHARE_DEFAULT_EXPIRY_HRS`)
 * is applied server-side from `config.SHARE_DEFAULT_EXPIRY_HRS` (env-configurable), not baked into the
 * shared schema, so an omitted field stays `undefined` through validation and is resolved in the service.
 */
export const CreateShareRequestSchema = z.object({
  expiresInHours: z.coerce
    .number()
    .int()
    .min(SHARE_EXPIRY_MIN_HOURS, `Expiry must be at least ${SHARE_EXPIRY_MIN_HOURS} hour.`)
    .max(SHARE_EXPIRY_MAX_HOURS, `Expiry must be at most ${SHARE_EXPIRY_MAX_HOURS} hours.`)
    .optional(),
});

export const ShareLinkSchema = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: z.string().datetime(),
  viewCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export const CreateShareResponseSchema = z.object({
  shareLink: ShareLinkSchema,
});

export const RevokeShareResponseSchema = z.object({
  message: z.string(),
});

export const ShareListItemSchema = z.object({
  noteId: z.string().uuid(),
  noteTitle: z.string(),
  url: z.string(),
  expiresAt: z.string().datetime(),
  viewCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export const ListSharesResponseSchema = z.object({
  shares: z.array(ShareListItemSchema),
});

export const SharedNoteViewSchema = z.object({
  title: z.string(),
  content: z.string(),
  authorName: z.string(),
  createdAt: z.string().datetime(),
});

export const GetSharedNoteResponseSchema = z.object({
  note: SharedNoteViewSchema,
});

/** Public token param — no `.uuid()` format check; an unrecognized token of any shape is a 404, not a 422 (see plan.md decision). */
export const ShareTokenParamSchema = z.object({
  token: z.string().min(1),
});
```
Notes:
- Reuses `NoteIdParamSchema` from `note.schemas.ts` for the `:id` param on `POST`/`DELETE /api/notes/:id/share` — not duplicated here (CON-003).
- `url` typed as plain `z.string()`, not `.url()` — keeps the schema decoupled from `FRONTEND_URL`'s exact format at validation time (it's a response field, not user input to constrain).

### `packages/shared/src/types/share.types.ts` (currently `export {};` placeholder — replace)
```ts
import type { z } from 'zod';
import type {
  CreateShareRequestSchema,
  ShareLinkSchema,
  CreateShareResponseSchema,
  RevokeShareResponseSchema,
  ShareListItemSchema,
  ListSharesResponseSchema,
  SharedNoteViewSchema,
  GetSharedNoteResponseSchema,
  ShareTokenParamSchema,
} from '../schemas/share.schemas.js';

export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;
export type ShareLink = z.infer<typeof ShareLinkSchema>;
export type CreateShareResponse = z.infer<typeof CreateShareResponseSchema>;
export type RevokeShareResponse = z.infer<typeof RevokeShareResponseSchema>;
export type ShareListItem = z.infer<typeof ShareListItemSchema>;
export type ListSharesResponse = z.infer<typeof ListSharesResponseSchema>;
export type SharedNoteView = z.infer<typeof SharedNoteViewSchema>;
export type GetSharedNoteResponse = z.infer<typeof GetSharedNoteResponseSchema>;
export type ShareTokenParam = z.infer<typeof ShareTokenParamSchema>;
```
`packages/shared/src/index.ts` already barrels both files (lines 9 and 18) — **no barrel edit needed**. No new constants needed — `SHARE_EXPIRY_MIN_HOURS`/`MAX_HOURS` (`limits.ts`), `DEFAULT_SHARE_EXPIRY_HOURS` (`defaults.ts`, unused by the backend directly — see env decision below), and `SHARE_LINK_EXPIRED`/`SHARE_LINK_NOT_FOUND` (`errors.ts`) already exist.

### `apps/backend/src/modules/share/share.errors.ts`
```ts
import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../../errors/app-error.js';

export class ShareLinkNotFoundError extends AppError {
  constructor() {
    super(ERROR_CODES.SHARE_LINK_NOT_FOUND, 'Share link not found.');
  }
}

export class ShareLinkExpiredError extends AppError {
  constructor() {
    super(ERROR_CODES.SHARE_LINK_EXPIRED, 'This share link has expired.');
  }
}
```
Note-existence checks (`POST`/`DELETE /api/notes/:id/share`) reuse `NoteNotFoundError` imported from `../notes/notes.errors.js` — same domain concept and error code, not redefined here.

### `apps/backend/src/modules/share/share.service.ts`
```ts
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  CreateShareRequest,
  CreateShareResponse,
  RevokeShareResponse,
  ListSharesResponse,
  GetSharedNoteResponse,
  ShareLink,
} from '@note-app/shared';
import { config } from '../../config/env.js';
import { NoteNotFoundError } from '../notes/notes.errors.js';
import { ShareLinkNotFoundError, ShareLinkExpiredError } from './share.errors.js';

function buildUrl(token: string): string {
  return `${config.FRONTEND_URL}/shared/${token}`;
}

function toShareLink(record: { token: string; expiresAt: Date; viewCount: number; createdAt: Date }): ShareLink {
  return {
    token: record.token,
    url: buildUrl(record.token),
    expiresAt: record.expiresAt.toISOString(),
    viewCount: record.viewCount,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function generateShareLink(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
  input: CreateShareRequest,
): Promise<CreateShareResponse> {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null } });
  if (!note) {
    throw new NoteNotFoundError();
  }

  const expiresInHours = input.expiresInHours ?? config.SHARE_DEFAULT_EXPIRY_HRS;
  const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000);
  const now = new Date();

  const existing = await prisma.shareLink.findUnique({ where: { noteId } });

  // BR-006: at most one active link per note. An existing non-expired link is returned as-is
  // (FRS AF-1); an existing but expired link is regenerated in place (Scenario 4).
  if (existing && existing.expiresAt > now) {
    return { shareLink: toShareLink(existing) };
  }

  const shareLink = existing
    ? await prisma.shareLink.update({
        where: { noteId },
        data: { token: randomUUID(), expiresAt, viewCount: 0, createdAt: now },
      })
    : await prisma.shareLink.create({
        data: { noteId, token: randomUUID(), expiresAt, viewCount: 0 },
      });

  return { shareLink: toShareLink(shareLink) };
}

export async function revokeShareLink(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
): Promise<RevokeShareResponse> {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!note) {
    throw new NoteNotFoundError();
  }

  const existing = await prisma.shareLink.findUnique({ where: { noteId } });
  if (!existing) {
    throw new ShareLinkNotFoundError();
  }

  await prisma.shareLink.delete({ where: { noteId } });

  return { message: 'Share link revoked successfully.' };
}

export async function listShares(prisma: PrismaClient, userId: string): Promise<ListSharesResponse> {
  const shares = await prisma.shareLink.findMany({
    where: { expiresAt: { gt: new Date() }, note: { userId } },
    include: { note: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    shares: shares.map((share) => ({
      noteId: share.note.id,
      noteTitle: share.note.title,
      url: buildUrl(share.token),
      expiresAt: share.expiresAt.toISOString(),
      viewCount: share.viewCount,
      createdAt: share.createdAt.toISOString(),
    })),
  };
}

export async function getSharedNote(prisma: PrismaClient, token: string): Promise<GetSharedNoteResponse> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { note: { include: { user: true } } },
  });

  if (!shareLink) {
    throw new ShareLinkNotFoundError();
  }
  if (shareLink.expiresAt <= new Date()) {
    throw new ShareLinkExpiredError();
  }
  // Defensive: BR-014 hard-deletes the ShareLink synchronously with soft delete, so this
  // branch should be unreachable in practice (Scenario 14).
  if (shareLink.note.deletedAt !== null) {
    throw new ShareLinkNotFoundError();
  }

  // Atomic increment (SDS §25.3 / BR-020) via Prisma's native `increment`, not raw SQL — see
  // plan.md Section 1 for why this satisfies the same atomicity guarantee as the SQL in SDS.
  await prisma.shareLink.updateMany({
    where: { token, expiresAt: { gt: new Date() } },
    data: { viewCount: { increment: 1 } },
  });

  return {
    note: {
      title: shareLink.note.title,
      content: shareLink.note.content,
      authorName: shareLink.note.user.name,
      createdAt: shareLink.note.createdAt.toISOString(),
    },
  };
}
```

### `apps/backend/src/modules/share/share.controller.ts`
```ts
import type { Request, Response } from 'express';
import type { CreateShareRequest, NoteIdParam, ShareTokenParam } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import { generateShareLink, revokeShareLink, listShares, getSharedNote } from './share.service.js';

export async function generateShareLinkHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const result = await generateShareLink(
    prisma,
    req.userId as string,
    req.params.id,
    req.body as CreateShareRequest,
  );
  res.status(201).json(result);
}

export async function revokeShareLinkHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const result = await revokeShareLink(prisma, req.userId as string, req.params.id);
  res.status(200).json(result);
}

export async function listSharesHandler(req: Request, res: Response): Promise<void> {
  const result = await listShares(prisma, req.userId as string);
  res.status(200).json(result);
}

export async function getSharedNoteHandler(
  req: Request<ShareTokenParam>,
  res: Response,
): Promise<void> {
  const result = await getSharedNote(prisma, req.params.token);
  res.status(200).json(result);
}
```

### `apps/backend/src/modules/share/share.router.ts`
```ts
import { Router } from 'express';
import { NoteIdParamSchema, CreateShareRequestSchema, ShareTokenParamSchema } from '@note-app/shared';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  generateShareLinkHandler,
  revokeShareLinkHandler,
  listSharesHandler,
  getSharedNoteHandler,
} from './share.controller.js';

const router = Router();

// Full sub-paths (not a single resource prefix) — this module spans /api/notes/:id/share,
// /api/shares, and /api/shared/:token, so it mounts at the bare /api prefix in app.ts.
router.post(
  '/notes/:id/share',
  requireAuth,
  validateParams(NoteIdParamSchema),
  validateBody(CreateShareRequestSchema),
  generateShareLinkHandler,
);
router.delete(
  '/notes/:id/share',
  requireAuth,
  validateParams(NoteIdParamSchema),
  revokeShareLinkHandler,
);
router.get('/shares', requireAuth, listSharesHandler);
router.get('/shared/:token', validateParams(ShareTokenParamSchema), getSharedNoteHandler);

export { router as shareRouter };
```
`GET /api/shared/:token` intentionally has no `requireAuth` — public per FRS/SDS §17.5.

## 3. Files to Modify

### `apps/backend/src/config/env.ts`
```diff
   CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
+  FRONTEND_URL: z.string().min(1, 'FRONTEND_URL is required'),
   BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),
```
`FRONTEND_URL` is distinct from `CORS_ORIGIN` (see Section 1 decision #2) — required, no default, matching the existing `CORS_ORIGIN` pattern.

### `apps/backend/.env` and `apps/backend/.env.example`
```diff
 # Allowed frontend origin — REQUIRED
 CORS_ORIGIN=http://localhost:5173
+
+# Public frontend base URL, used to build share links — REQUIRED
+FRONTEND_URL=http://localhost:5173
```

### `apps/backend/src/app.ts`
```diff
 import { searchRouter } from './modules/search/search.router.js';
+import { shareRouter } from './modules/share/share.router.js';
 ...
   app.use('/api/search', searchRouter);
+  app.use('/api', shareRouter);
-
-  // Further feature routes are mounted here by their owning tickets (AB-1008 onward).
+  // Further feature routes are mounted here by their owning tickets (AB-1009 onward).
```

## 4. Tests

### `apps/backend/tests/unit/share.service.test.ts` (new)
Mock `prisma.note`, `prisma.shareLink` per the `tags.service.test.ts` `createMockPrisma()` pattern. Cover:
- `generateShareLink`: creates when none exists; returns existing unchanged when active; regenerates (new token, `viewCount: 0`) when existing is expired; throws `NoteNotFoundError` when note missing/foreign/soft-deleted; resolves `expiresInHours` from input vs. `config.SHARE_DEFAULT_EXPIRY_HRS` fallback.
- `revokeShareLink`: deletes when present; throws `NoteNotFoundError` vs `ShareLinkNotFoundError` for the two distinct 404 cases.
- `listShares`: maps rows, filters via `expiresAt: { gt: ... }` in the `where` (assert the mock call args, not real DB filtering).
- `getSharedNote`: throws `ShareLinkNotFoundError` (missing token, soft-deleted note); throws `ShareLinkExpiredError` (past `expiresAt`); on success, asserts `viewCount` increment call args (`updateMany` with `increment: 1`) and the mapped response shape (no `id`/`tags`/`viewCount`/`email` leaked).

### `apps/backend/tests/integration/share.integration.test.ts` (new)
Follows `tags.integration.test.ts` conventions (`createApp()`, `supertest`, `registerAndLogin`, `resetNotesTables()` — already truncates `shareLink` first, no setup changes needed). Maps 1:1 to `spec.md`'s 24 scenarios, notably:
- Scenario 11 (concurrent increment): fire 10 concurrent `supertest` requests via `Promise.all`, assert final `viewCount` via `prisma.shareLink.findUnique` equals the exact expected count — this is the test that actually proves the atomic-increment approach (Section 1 decision) holds under real concurrent connections against the test DB, not just mocked call args.
- Scenario 3/4 (existing active vs. expired link): create a `ShareLink` directly via Prisma with a manually set `expiresAt` in the past to set up the expired case without waiting.
- Scenario 10 (public access, no `Authorization` header): confirm no header is sent and the request still succeeds.
- Scenarios 12–14: token not found / expired / soft-deleted note — build via direct Prisma writes to reach each state precisely.

### `packages/shared/tests/unit/share.schemas.test.ts` (new, per `packages/shared/CLAUDE.md`)
Valid/invalid input table for `CreateShareRequestSchema` (`expiresInHours` omitted / valid / below min / above max / non-integer) and `ShareTokenParamSchema` (accepts non-UUID strings, rejects empty string).

## 5. Build / Lint / Test Checkpoints

Run in order, matching `CLAUDE.md`'s mandatory gate:
```
pnpm --filter @note-app/shared build    # share.schemas.ts / share.types.ts compile, barrel resolves
pnpm --filter @note-app/shared test     # new share.schemas.test.ts
pnpm --filter @note-app/backend build   # tsc: new env var, service/controller/router typing
pnpm --filter @note-app/backend lint --max-warnings 0
pnpm --filter @note-app/backend test    # unit (mocked prisma) + integration (real Postgres test DB, requires docker compose up -d)
pnpm build && pnpm lint --max-warnings 0 && pnpm test   # full repo gate before commit, per CLAUDE.md
```
Integration tests require the Postgres test DB running (`docker compose up -d`) and `FRONTEND_URL` set in the test environment (add to whatever `.env.test`/CI env config `tags.integration.test.ts` already relies on — confirm this file/mechanism during `/implement`, no other ticket has needed a new required env var until now).

## 6. Out of Scope (unchanged from spec.md)

- Frontend Share Modal (UX-SCR-011) and Shared Note View page (UX-SCR-013) — later frontend ticket.
- BR-014's soft-delete-revokes-share behavior — already implemented in AB-1004.
- Share-specific rate limiting beyond the existing global `rateLimiter` — no share-specific limit in FRS/SDS.
- View-count analytics beyond the raw counter.

## 7. Open Items for `/implement` to Confirm

1. Where `FRONTEND_URL` needs to be added beyond `.env`/`.env.example` — check `docker-compose.yml` and any CI/test env config for a place that injects backend env vars, so integration tests don't fail on missing `FRONTEND_URL`.
2. Confirm Prisma's relation filter `note: { userId }` inside `shareLink.findMany`'s `where` (used in `listShares`) compiles/behaves as expected against the generated client — it's a to-one relation filter, which Prisma supports, but worth a quick sanity check since no other module filters `ShareLink` by its related `Note`'s fields yet.
3. Confirm `shareLink.update`'s explicit `createdAt: now` overwrite is accepted by Prisma given `createdAt` has `@default(now())` but no `@updatedAt` — `@default` only applies on insert, so an explicit value on `update` should pass through normally, but verify no schema-level immutability assumption is violated.
