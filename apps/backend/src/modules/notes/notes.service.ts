import type { PrismaClient, Note, Tag } from '@prisma/client';
import type {
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteResponse,
  DeleteNoteResponse,
  RestoreNoteResponse,
} from '@note-app/shared';
import { RECOVERY_WINDOW_DAYS } from '@note-app/shared';
import { sanitizeNoteHtml, extractPlainText } from './notes.content.js';
import {
  NoteNotFoundError,
  AlreadyDeletedError,
  NotDeletedError,
  RecoveryExpiredError,
} from './notes.errors.js';

const NOTE_WITH_TAGS_INCLUDE = { tags: { include: { tag: true } } } as const;

type NoteWithTags = Note & { tags: { tag: Tag }[] };

function toNoteResponse(note: NoteWithTags): NoteResponse {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

/** Resolves `tagIds` to the subset owned by `userId` — unknown/foreign ids are silently dropped (BR-002 opacity). */
async function resolveOwnedTagIds(
  prisma: PrismaClient,
  userId: string,
  tagIds: string[] | undefined,
): Promise<string[]> {
  if (!tagIds || tagIds.length === 0) {
    return [];
  }
  const owned = await prisma.tag.findMany({
    where: { id: { in: tagIds }, userId },
    select: { id: true },
  });
  return owned.map((tag) => tag.id);
}

export async function createNote(
  prisma: PrismaClient,
  userId: string,
  input: CreateNoteRequest,
): Promise<NoteResponse> {
  const content = sanitizeNoteHtml(input.content);
  const contentPlain = extractPlainText(content);
  const tagIds = await resolveOwnedTagIds(prisma, userId, input.tagIds);

  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.note.create({
      data: { userId, title: input.title, content, contentPlain },
    });

    if (tagIds.length > 0) {
      await tx.noteTag.createMany({
        data: tagIds.map((tagId) => ({ noteId: created.id, tagId })),
      });
    }

    await tx.noteVersion.create({
      data: { noteId: created.id, versionNumber: 1, title: created.title, content: created.content },
    });

    return tx.note.findUniqueOrThrow({
      where: { id: created.id },
      include: NOTE_WITH_TAGS_INCLUDE,
    });
  });

  return toNoteResponse(note);
}

export async function getNote(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
): Promise<NoteResponse> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId, deletedAt: null },
    include: NOTE_WITH_TAGS_INCLUDE,
  });

  if (!note) {
    throw new NoteNotFoundError();
  }

  return toNoteResponse(note);
}

export async function updateNote(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
  input: UpdateNoteRequest,
): Promise<NoteResponse> {
  const existing = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null } });
  if (!existing) {
    throw new NoteNotFoundError();
  }

  const nextTitle = input.title !== undefined ? input.title : existing.title;
  const nextContent = input.content !== undefined ? sanitizeNoteHtml(input.content) : existing.content;
  const nextContentPlain =
    input.content !== undefined ? extractPlainText(nextContent) : existing.contentPlain;
  const tagIds =
    input.tagIds !== undefined ? await resolveOwnedTagIds(prisma, userId, input.tagIds) : undefined;

  const note = await prisma.$transaction(async (tx) => {
    await tx.note.update({
      where: { id: noteId },
      data: { title: nextTitle, content: nextContent, contentPlain: nextContentPlain },
    });

    if (tagIds !== undefined) {
      await tx.noteTag.deleteMany({ where: { noteId } });
      if (tagIds.length > 0) {
        await tx.noteTag.createMany({ data: tagIds.map((tagId) => ({ noteId, tagId })) });
      }
    }

    // AF-1: a version snapshot is created on every update, even a title-only edit (Scenario 16).
    const latestVersion = await tx.noteVersion.aggregate({
      where: { noteId },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (latestVersion._max.versionNumber ?? 0) + 1;
    await tx.noteVersion.create({
      data: { noteId, versionNumber: nextVersionNumber, title: nextTitle, content: nextContent },
    });

    return tx.note.findUniqueOrThrow({
      where: { id: noteId },
      include: NOTE_WITH_TAGS_INCLUDE,
    });
  });

  return toNoteResponse(note);
}

export async function softDeleteNote(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
): Promise<DeleteNoteResponse> {
  const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!existing) {
    throw new NoteNotFoundError();
  }
  if (existing.deletedAt !== null) {
    throw new AlreadyDeletedError();
  }

  await prisma.$transaction([
    prisma.note.update({ where: { id: noteId }, data: { deletedAt: new Date() } }),
    // BR-014: soft-deleting a note revokes (hard-deletes) its active ShareLink.
    prisma.shareLink.deleteMany({ where: { noteId } }),
  ]);

  return { message: 'Note deleted successfully.' };
}

export async function restoreNote(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
): Promise<RestoreNoteResponse> {
  const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!existing) {
    throw new NoteNotFoundError();
  }
  if (existing.deletedAt === null) {
    throw new NotDeletedError();
  }

  const elapsedMs = Date.now() - existing.deletedAt.getTime();
  if (elapsedMs > RECOVERY_WINDOW_DAYS * 86_400_000) {
    throw new RecoveryExpiredError();
  }

  const note = await prisma.note.update({
    where: { id: noteId },
    data: { deletedAt: null },
    include: NOTE_WITH_TAGS_INCLUDE,
  });

  return { note: toNoteResponse(note) };
}
