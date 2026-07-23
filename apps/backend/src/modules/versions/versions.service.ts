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

async function requireOwnedNote(prisma: PrismaClient, userId: string, noteId: string): Promise<void> {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null } });
  if (!note) {
    throw new NoteNotFoundError();
  }
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
