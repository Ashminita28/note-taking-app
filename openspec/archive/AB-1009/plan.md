# AB-1009 — Backend Version History: Implementation Plan

## 1. Summary

Implement the 3 version-history endpoints (`GET /api/notes/:id/versions`, `GET /api/notes/:id/versions/:versionNumber`, `POST /api/notes/:id/versions/:versionNumber/restore`) as a new `versions` module, following the existing layering (router → validate → controller → service → errors). No new Prisma models/migrations — `NoteVersion` already exists (AB-1001) and version creation on note save already exists (AB-1004). Also implement the FR-VER-005 auto-purge as a plain service function wired to a `setInterval` in `server.ts` (not `app.ts`, so it never runs during integration tests, which build the app via `createApp()` directly).

Resolved open questions from `spec.md`:
1. **Module boundary:** new `versions` module mirroring `share`'s file layout, but mounted at the *same* prefix as `notesRouter` (`/api/notes`) rather than the bare `/api` — all three paths share that one prefix, unlike `share`'s multi-prefix span (`/api/notes/:id/share`, `/api/shares`, `/api/shared/:token`). Express matches multiple routers registered at the same prefix in order; `notesRouter`'s own routes (`/`, `/:id`, `/:id/restore`) never collide with `/:id/versions...`.
2. **Auto-purge trigger mechanism:** no scheduler dependency added (CON-001). `purgeOldVersions(prisma)` is a plain exported function in `versions.service.ts`, invoked from `server.ts` via `setInterval(..., 24h).unref()`. This keeps the purge logic itself unit-testable in isolation (call the function directly) without needing a fake clock library or new dependency, and guarantees it never fires during `createApp()`-based tests.
3. **Purge query shape:** no raw SQL (`apps/backend/CLAUDE.md` restricts raw SQL to full-text search only). Uses `prisma.noteVersion.groupBy({ by: ['noteId'], _count: { id: true } })` to find per-note version counts, filters to `count > VERSION_MIN_RETAINED` **in application code** (not via Prisma's `having`, whose exact nested-count syntax isn't confirmed against this Prisma version — see Open Items #2), then per eligible note: fetch the `VERSION_MIN_RETAINED` most-recent version `id`s, and `deleteMany` where `noteId` matches, `id` is not in that retained set, and `createdAt` is older than the 90-day cutoff.

**New architecture decision not flagged in `spec.md`:** restore's `note.update` must recompute `contentPlain` from the restored version's content (spec Scenario 17) — this reuses `extractPlainText` from `notes.content.ts` exactly as `notes.service.ts`'s `updateNote` does, not a new sanitization pass, since version content was already sanitized when originally captured.

**Reuse decision:** rather than duplicating the `NoteResponse` mapping logic (`toNoteResponse` + `NOTE_WITH_TAGS_INCLUDE`) that already exists in `notes.service.ts` for the restore endpoint's `{note}` response, export both from `notes.service.ts` and import them into `versions.service.ts` — avoids a second copy of the same mapping (see Files to Modify).

## 2. Files to Create

### `packages/shared/src/schemas/version.schemas.ts` (currently `export {};` placeholder — replace)
```ts
import { z } from 'zod';
import { NoteResponseSchema } from './note.schemas.js';

/** Canonical source: FRS FR-VER-002–004, SDS Section 17.6 (version history endpoints). */

export const VersionNumberParamSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.coerce.number().int().min(1),
});

export const VersionListItemSchema = z.object({
  versionNumber: z.number().int(),
  title: z.string(),
  contentPreview: z.string(),
  createdAt: z.string().datetime(),
});

export const ListVersionsResponseSchema = z.object({
  versions: z.array(VersionListItemSchema),
});

export const VersionDetailSchema = z.object({
  versionNumber: z.number().int(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const GetVersionResponseSchema = z.object({
  version: VersionDetailSchema,
});

export const RestoreVersionResponseSchema = z.object({
  note: NoteResponseSchema,
});
```
Notes:
- Reuses `NoteIdParamSchema` (`note.schemas.ts`) for the list endpoint's `:id`-only param — not duplicated here (CON-003).
- `VersionNumberParamSchema` covers both the view and restore endpoints (both take `id` + `versionNumber`); a non-numeric or `< 1` `versionNumber` fails here, before the service layer (spec Scenarios 12, 21).
- `RestoreVersionResponseSchema` reuses `NoteResponseSchema` — the restore response is just `{note}`, identical shape to every other note-returning endpoint.

### `packages/shared/src/types/version.types.ts` (currently `export {};` placeholder — replace)
```ts
import type { z } from 'zod';
import type {
  VersionNumberParamSchema,
  VersionListItemSchema,
  ListVersionsResponseSchema,
  VersionDetailSchema,
  GetVersionResponseSchema,
  RestoreVersionResponseSchema,
} from '../schemas/version.schemas.js';

export type VersionNumberParam = z.infer<typeof VersionNumberParamSchema>;
export type VersionListItem = z.infer<typeof VersionListItemSchema>;
export type ListVersionsResponse = z.infer<typeof ListVersionsResponseSchema>;
export type VersionDetail = z.infer<typeof VersionDetailSchema>;
export type GetVersionResponse = z.infer<typeof GetVersionResponseSchema>;
export type RestoreVersionResponse = z.infer<typeof RestoreVersionResponseSchema>;
```
`packages/shared/src/index.ts` already barrels both files (lines 10 and 19) — **no barrel edit needed**. `ERROR_CODES.VERSION_NOT_FOUND` (mapped to `404`) already exists in `errors.ts` — no change needed there.

### `apps/backend/src/modules/versions/versions.errors.ts`
```ts
import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../../errors/app-error.js';

export class VersionNotFoundError extends AppError {
  constructor() {
    super(ERROR_CODES.VERSION_NOT_FOUND, 'Version not found.');
  }
}
```
Note-existence checks reuse `NoteNotFoundError` imported from `../notes/notes.errors.js` — same domain concept and error code, not redefined here (mirrors `share.errors.ts`'s precedent).

### `apps/backend/src/modules/versions/versions.service.ts`
```ts
import type { PrismaClient } from '@prisma/client';
import type {
  ListVersionsResponse,
  GetVersionResponse,
  RestoreVersionResponse,
} from '@note-app/shared';
import { VERSION_PREVIEW_LENGTH, VERSION_RETENTION_DAYS, VERSION_MIN_RETAINED } from '@note-app/shared';
import { extractPlainText } from '../notes/notes.content.js';
import { NoteNotFoundError } from '../notes/notes.errors.js';
import { NOTE_WITH_TAGS_INCLUDE, toNoteResponse } from '../notes/notes.service.js';
import { VersionNotFoundError } from './versions.errors.js';

async function requireOwnedNote(prisma: PrismaClient, userId: string, noteId: string) {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null } });
  if (!note) {
    throw new NoteNotFoundError();
  }
  return note;
}

export async function listVersions(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
): Promise<ListVersionsResponse> {
  await requireOwnedNote(prisma, userId, noteId);

  const versions = await prisma.noteVersion.findMany({
    where: { noteId },
    orderBy: { versionNumber: 'desc' },
  });

  return {
    versions: versions.map((version) => ({
      versionNumber: version.versionNumber,
      title: version.title,
      contentPreview: version.content.slice(0, VERSION_PREVIEW_LENGTH),
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

export async function getVersion(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
  versionNumber: number,
): Promise<GetVersionResponse> {
  await requireOwnedNote(prisma, userId, noteId);

  const version = await prisma.noteVersion.findUnique({
    where: { noteId_versionNumber: { noteId, versionNumber } },
  });
  if (!version) {
    throw new VersionNotFoundError();
  }

  return {
    version: {
      versionNumber: version.versionNumber,
      title: version.title,
      content: version.content,
      createdAt: version.createdAt.toISOString(),
    },
  };
}

export async function restoreVersion(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
  versionNumber: number,
): Promise<RestoreVersionResponse> {
  await requireOwnedNote(prisma, userId, noteId);

  const target = await prisma.noteVersion.findUnique({
    where: { noteId_versionNumber: { noteId, versionNumber } },
  });
  if (!target) {
    throw new VersionNotFoundError();
  }

  const note = await prisma.$transaction(async (tx) => {
    await tx.note.update({
      where: { id: noteId },
      data: {
        title: target.title,
        content: target.content,
        contentPlain: extractPlainText(target.content),
      },
    });

    // BR-009: restore creates a NEW version — it never rewrites or deletes version history.
    const latest = await tx.noteVersion.aggregate({
      where: { noteId },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (latest._max.versionNumber ?? 0) + 1;
    await tx.noteVersion.create({
      data: { noteId, versionNumber: nextVersionNumber, title: target.title, content: target.content },
    });

    return tx.note.findUniqueOrThrow({
      where: { id: noteId },
      include: NOTE_WITH_TAGS_INCLUDE,
    });
  });

  return { note: toNoteResponse(note) };
}

/**
 * SDS §26.4 / FR-VER-005 — retains the VERSION_MIN_RETAINED most recent versions per note
 * regardless of age; deletes only versions that are BOTH outside that retained set AND older
 * than VERSION_RETENTION_DAYS. Invoked on a timer from server.ts — no HTTP route calls this.
 */
export async function purgeOldVersions(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - VERSION_RETENTION_DAYS * 86_400_000);

  const counts = await prisma.noteVersion.groupBy({
    by: ['noteId'],
    _count: { id: true },
  });
  const eligibleNoteIds = counts
    .filter((row) => row._count.id > VERSION_MIN_RETAINED)
    .map((row) => row.noteId);

  let deletedCount = 0;
  for (const noteId of eligibleNoteIds) {
    const retained = await prisma.noteVersion.findMany({
      where: { noteId },
      orderBy: { versionNumber: 'desc' },
      take: VERSION_MIN_RETAINED,
      select: { id: true },
    });
    const retainedIds = retained.map((version) => version.id);

    const result = await prisma.noteVersion.deleteMany({
      where: { noteId, id: { notIn: retainedIds }, createdAt: { lt: cutoff } },
    });
    deletedCount += result.count;
  }

  return deletedCount;
}
```

### `apps/backend/src/modules/versions/versions.controller.ts`
```ts
import type { Request, Response } from 'express';
import type { NoteIdParam, VersionNumberParam } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import { listVersions, getVersion, restoreVersion } from './versions.service.js';

export async function listVersionsHandler(req: Request<NoteIdParam>, res: Response): Promise<void> {
  const result = await listVersions(prisma, req.userId as string, req.params.id);
  res.status(200).json(result);
}

export async function getVersionHandler(
  req: Request<VersionNumberParam>,
  res: Response,
): Promise<void> {
  const result = await getVersion(
    prisma,
    req.userId as string,
    req.params.id,
    req.params.versionNumber,
  );
  res.status(200).json(result);
}

export async function restoreVersionHandler(
  req: Request<VersionNumberParam>,
  res: Response,
): Promise<void> {
  const result = await restoreVersion(
    prisma,
    req.userId as string,
    req.params.id,
    req.params.versionNumber,
  );
  res.status(200).json(result);
}
```

### `apps/backend/src/modules/versions/versions.router.ts`
```ts
import { Router } from 'express';
import { NoteIdParamSchema, VersionNumberParamSchema } from '@note-app/shared';
import { validateParams } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  listVersionsHandler,
  getVersionHandler,
  restoreVersionHandler,
} from './versions.controller.js';

const router = Router();

router.get('/:id/versions', requireAuth, validateParams(NoteIdParamSchema), listVersionsHandler);
router.get(
  '/:id/versions/:versionNumber',
  requireAuth,
  validateParams(VersionNumberParamSchema),
  getVersionHandler,
);
router.post(
  '/:id/versions/:versionNumber/restore',
  requireAuth,
  validateParams(VersionNumberParamSchema),
  restoreVersionHandler,
);

export { router as versionsRouter };
```
Mounts at the same `/api/notes` prefix as `notesRouter` in `app.ts` — see Files to Modify.

## 3. Files to Modify

### `packages/shared/src/constants/limits.ts`
```diff
 export const SHARE_EXPIRY_MIN_HOURS = 1;
 export const SHARE_EXPIRY_MAX_HOURS = 720;
+
+export const VERSION_PREVIEW_LENGTH = 200;
+export const VERSION_RETENTION_DAYS = 90;
+export const VERSION_MIN_RETAINED = 10;

 export const PAGE_MIN = 1;
```

### `apps/backend/src/modules/notes/notes.service.ts`
```diff
-const NOTE_WITH_TAGS_INCLUDE = { tags: { include: { tag: true } } } as const;
+export const NOTE_WITH_TAGS_INCLUDE = { tags: { include: { tag: true } } } as const;

 type NoteWithTags = Note & { tags: { tag: Tag }[] };

-function toNoteResponse(note: NoteWithTags): NoteResponse {
+export function toNoteResponse(note: NoteWithTags): NoteResponse {
```
Exporting these two (previously module-private) lets `versions.service.ts` reuse the exact same note-response mapping for the restore endpoint instead of duplicating it (Section 1 reuse decision). No behavior change.

### `apps/backend/src/app.ts`
```diff
 import { shareRouter } from './modules/share/share.router.js';
+import { versionsRouter } from './modules/versions/versions.router.js';
 ...
   app.use('/api', shareRouter);
+  app.use('/api/notes', versionsRouter);
-
-  // Further feature routes are mounted here by their owning tickets (AB-1009 onward).
+
+  // Further feature routes are mounted here by their owning tickets (AB-1010 onward).
```

### `apps/backend/src/server.ts`
```diff
 import { createApp } from './app.js';
 import { config } from './config/env.js';
+import { prisma } from './config/prisma.js';
+import { purgeOldVersions } from './modules/versions/versions.service.js';

 const app = createApp();

 app.listen(config.PORT, () => {
   console.log(`Server listening on port ${config.PORT}`);
 });
+
+// FR-VER-005 / SDS §26.4 — low-priority background purge, run once a day. Started only from the
+// real server process, never from createApp() directly, so integration tests (which build the
+// app without going through server.ts) never trigger it.
+const VERSION_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
+setInterval(() => {
+  purgeOldVersions(prisma).catch((error) => {
+    console.error('Version purge failed:', error);
+  });
+}, VERSION_PURGE_INTERVAL_MS).unref();
```

## 4. Tests

### `packages/shared/tests/unit/version.schemas.test.ts` (new)
Valid/invalid input table for `VersionNumberParamSchema`: valid UUID `id` + positive integer `versionNumber` (including string `"2"` coerced to `2`); rejects non-UUID `id`, non-numeric `versionNumber` (`"abc"`), `versionNumber: 0`, negative `versionNumber`, non-integer (`"1.5"`).

### `apps/backend/tests/unit/versions.service.test.ts` (new)
Mock `prisma.note` (`findFirst`), `prisma.noteVersion` (`findMany`, `findUnique`, `aggregate`, `create`, `groupBy`, `deleteMany`), and `prisma.$transaction`, per the `share.service.test.ts` `createMockPrisma()` pattern. Cover:
- `listVersions`: maps rows newest-first with truncated `contentPreview`; throws `NoteNotFoundError` when note missing/foreign/soft-deleted (assert `prisma.noteVersion.findMany` not called in that case).
- `getVersion`: returns full content on match; throws `VersionNotFoundError` when `versionNumber` has no row; throws `NoteNotFoundError` before even checking the version when the note itself is missing/foreign/soft-deleted.
- `restoreVersion`: updates note title/content/`contentPlain` (assert `extractPlainText` was applied — i.e. assert the `tx.note.update` call's `data.contentPlain`), creates a version at `max + 1`, returns the mapped `{note}`; throws `VersionNotFoundError` / `NoteNotFoundError` in the same shapes as above without mutating anything (assert `$transaction` not called).
- `purgeOldVersions`: given a mocked `groupBy` result mixing notes above/below `VERSION_MIN_RETAINED`, asserts only the above-threshold `noteId`s trigger a `findMany` + `deleteMany` call, and that `deleteMany`'s `where` includes the retained-`id` exclusion and the `createdAt: { lt: cutoff }` cutoff; returns the summed deleted count.

### `apps/backend/tests/integration/versions.integration.test.ts` (new)
Follows `share.integration.test.ts` conventions (`createApp()`, `supertest`, `registerAndLogin`, `resetNotesTables()` — already truncates `noteVersion` before `note`, no setup changes needed). Maps to `spec.md`'s scenarios:
- Scenarios 1–13, 18–22 (list/view over HTTP): create a note, `PATCH` it a couple of times via the existing notes endpoints to generate versions 2/3 naturally (reuses AB-1004's real version-creation path rather than seeding `noteVersion` rows directly), then exercise `GET .../versions` and `GET .../versions/:n`.
- Scenarios 14–17 (restore over HTTP): restore an older version, then assert via a follow-up `GET /api/notes/:id` that title/content match, and via `GET .../versions` that a new version was appended and all prior versions remain individually fetchable.
- Scenario 6/11/20 (soft-deleted note): soft-delete via the existing `DELETE /api/notes/:id` endpoint first, then assert 404 on all three version endpoints.
- Scenarios 23–26 (auto-purge): call `purgeOldVersions(prisma)` **directly** (not via HTTP — there's no route) after seeding `noteVersion` rows with explicit past `createdAt` timestamps via direct Prisma writes (`prisma.noteVersion.create({ data: { ..., createdAt: <90+ days ago> } })`), across multiple notes to prove per-note isolation (Scenario 26). This exercises the real `groupBy`/`deleteMany` queries against the actual test Postgres DB, which is a stronger guarantee than mocking those calls in the unit test.

## 5. Build / Lint / Test Checkpoints

Run in order, matching `CLAUDE.md`'s mandatory gate:
```
pnpm --filter @note-app/shared build    # version.schemas.ts / version.types.ts compile, barrel resolves
pnpm --filter @note-app/shared test     # new version.schemas.test.ts
pnpm --filter @note-app/backend build   # tsc: new module, notes.service.ts exports, server.ts timer
pnpm --filter @note-app/backend lint --max-warnings 0
pnpm --filter @note-app/backend test    # unit (mocked prisma) + integration (real Postgres test DB, requires docker compose up -d)
pnpm build && pnpm lint --max-warnings 0 && pnpm test   # full repo gate before commit, per CLAUDE.md
```

## 6. Out of Scope (unchanged from spec.md)

- Frontend Version History Drawer (UX-SCR-012) — later frontend ticket (AB-1015).
- Version snapshot creation on note create/update (FR-VER-001) — already implemented in AB-1004.
- Editing or individually deleting a specific version record (BR-017).
- Diffing between versions or highlighting changes.

## 7. Open Items for `/implement` to Confirm

1. Confirm Prisma's generated compound-unique input name for `@@unique([noteId, versionNumber])` on `NoteVersion` is exactly `noteId_versionNumber` (Prisma's default convention — field names joined by `_` in schema-declaration order) by checking the generated client types before wiring `findUnique`.
2. Confirm `prisma.noteVersion.groupBy({ by: ['noteId'], _count: { id: true } })` compiles and returns `{ noteId: string; _count: { id: number } }[]` against this Prisma version (`6.6.0`) — no other module in this codebase uses `groupBy` yet, so there's no existing precedent to copy.
3. The 24-hour purge interval is not specified anywhere in FRS/SDS (only "scheduled or triggered" appears) — confirm this cadence is acceptable, and confirm whether an immediate purge run at server startup is also wanted (current plan only fires after the first interval elapses).
4. Verify `noteVersion.deleteMany`'s `id: { notIn: retainedIds }` performs acceptably for notes with very large version counts (an `IN`/`NOT IN` list sized to `VERSION_MIN_RETAINED` (10) is small and fine — flagging only in case retention constants change later).
