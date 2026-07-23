import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  createNote,
  getNote,
  updateNote,
  softDeleteNote,
  restoreNote,
} from '../../src/modules/notes/notes.service';
import {
  NoteNotFoundError,
  AlreadyDeletedError,
  NotDeletedError,
  RecoveryExpiredError,
} from '../../src/modules/notes/notes.errors';

const USER_ID = '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01';
const NOTE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const TAG_ID_1 = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';
const TAG_ID_2 = 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70';

function buildNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: NOTE_ID,
    userId: USER_ID,
    title: 'Untitled',
    content: '',
    contentPlain: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function buildNoteWithTags(overrides: Partial<Record<string, unknown>> = {}, tags: Array<{ id: string; name: string; color: string }> = []) {
  return { ...buildNote(overrides), tags: tags.map((tag) => ({ noteId: NOTE_ID, tagId: tag.id, tag })) };
}

function createMockPrisma() {
  const prisma = {
    note: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    noteTag: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    noteVersion: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    shareLink: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
  };
  return prisma as unknown as PrismaClient & {
    note: Record<string, ReturnType<typeof vi.fn>>;
    noteTag: Record<string, ReturnType<typeof vi.fn>>;
    noteVersion: Record<string, ReturnType<typeof vi.fn>>;
    tag: Record<string, ReturnType<typeof vi.fn>>;
    shareLink: Record<string, ReturnType<typeof vi.fn>>;
    $transaction: ReturnType<typeof vi.fn>;
  };
}

describe('createNote', () => {
  it('creates a note with sanitized content, extracted plain text, and an initial version', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findMany.mockResolvedValue([]);
    prisma.note.create.mockResolvedValue(buildNote({ id: NOTE_ID, title: 'Groceries', content: '<p>Milk</p>' }));
    prisma.note.findUniqueOrThrow.mockResolvedValue(
      buildNoteWithTags({ title: 'Groceries', content: '<p>Milk</p>' }),
    );

    const result = await createNote(prisma, USER_ID, { title: 'Groceries', content: '<p>Milk</p>' });

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, title: 'Groceries', content: '<p>Milk</p>', contentPlain: 'Milk' },
    });
    expect(prisma.noteVersion.create).toHaveBeenCalledWith({
      data: { noteId: NOTE_ID, versionNumber: 1, title: 'Groceries', content: '<p>Milk</p>' },
    });
    expect(result.title).toBe('Groceries');
    expect(result.tags).toEqual([]);
  });

  it('creates a note with no content, storing empty content and contentPlain', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findMany.mockResolvedValue([]);
    prisma.note.create.mockResolvedValue(buildNote());
    prisma.note.findUniqueOrThrow.mockResolvedValue(buildNoteWithTags());

    await createNote(prisma, USER_ID, { title: 'Untitled', content: '' });

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, title: 'Untitled', content: '', contentPlain: '' },
    });
  });

  it('associates only the tagIds owned by the user, silently dropping foreign/unknown ids', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findMany.mockResolvedValue([{ id: TAG_ID_1 }]);
    prisma.note.create.mockResolvedValue(buildNote());
    prisma.note.findUniqueOrThrow.mockResolvedValue(
      buildNoteWithTags({}, [{ id: TAG_ID_1, name: 'home', color: '#6B7280' }]),
    );

    const result = await createNote(prisma, USER_ID, {
      title: 'Untitled',
      content: '',
      tagIds: [TAG_ID_1, TAG_ID_2],
    });

    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: { id: { in: [TAG_ID_1, TAG_ID_2] }, userId: USER_ID },
      select: { id: true },
    });
    expect(prisma.noteTag.createMany).toHaveBeenCalledWith({
      data: [{ noteId: NOTE_ID, tagId: TAG_ID_1 }],
    });
    expect(result.tags).toEqual([{ id: TAG_ID_1, name: 'home', color: '#6B7280' }]);
  });

  it('skips noteTag.createMany when there are no resolved tagIds', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findMany.mockResolvedValue([]);
    prisma.note.create.mockResolvedValue(buildNote());
    prisma.note.findUniqueOrThrow.mockResolvedValue(buildNoteWithTags());

    await createNote(prisma, USER_ID, { title: 'Untitled', content: '' });

    expect(prisma.noteTag.createMany).not.toHaveBeenCalled();
  });
});

describe('getNote', () => {
  it('returns the note when it exists, is owned by the user, and is not soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNoteWithTags({ title: 'Groceries' }));

    const result = await getNote(prisma, USER_ID, NOTE_ID);

    expect(prisma.note.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, userId: USER_ID, deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });
    expect(result.title).toBe('Groceries');
  });

  it('throws NoteNotFoundError when the note does not exist', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(getNote(prisma, USER_ID, NOTE_ID)).rejects.toThrow(NoteNotFoundError);
  });

  it('throws NoteNotFoundError for a soft-deleted note (scoped out by the deletedAt: null filter)', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(getNote(prisma, USER_ID, NOTE_ID)).rejects.toThrow(NoteNotFoundError);
  });
});

describe('updateNote', () => {
  it('applies a full update, replaces tags, and creates the next version', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote({ title: 'Old', content: '<p>Old</p>' }));
    prisma.tag.findMany.mockResolvedValue([{ id: TAG_ID_1 }]);
    prisma.noteVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 1 } });
    prisma.note.findUniqueOrThrow.mockResolvedValue(
      buildNoteWithTags({ title: 'New title', content: '<p>New</p>' }, [
        { id: TAG_ID_1, name: 'home', color: '#6B7280' },
      ]),
    );

    const result = await updateNote(prisma, USER_ID, NOTE_ID, {
      title: 'New title',
      content: '<p>New</p>',
      tagIds: [TAG_ID_1],
    });

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: { title: 'New title', content: '<p>New</p>', contentPlain: 'New' },
    });
    expect(prisma.noteTag.deleteMany).toHaveBeenCalledWith({ where: { noteId: NOTE_ID } });
    expect(prisma.noteTag.createMany).toHaveBeenCalledWith({ data: [{ noteId: NOTE_ID, tagId: TAG_ID_1 }] });
    expect(prisma.noteVersion.create).toHaveBeenCalledWith({
      data: { noteId: NOTE_ID, versionNumber: 2, title: 'New title', content: '<p>New</p>' },
    });
    expect(result.title).toBe('New title');
  });

  it('creates a version snapshot on a title-only partial update, leaving content unchanged', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(
      buildNote({ title: 'Old', content: '<p>Unchanged</p>', contentPlain: 'Unchanged' }),
    );
    prisma.noteVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 3 } });
    prisma.note.findUniqueOrThrow.mockResolvedValue(
      buildNoteWithTags({ title: 'Renamed', content: '<p>Unchanged</p>' }),
    );

    await updateNote(prisma, USER_ID, NOTE_ID, { title: 'Renamed' });

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: { title: 'Renamed', content: '<p>Unchanged</p>', contentPlain: 'Unchanged' },
    });
    expect(prisma.noteTag.deleteMany).not.toHaveBeenCalled();
    expect(prisma.noteVersion.create).toHaveBeenCalledWith({
      data: { noteId: NOTE_ID, versionNumber: 4, title: 'Renamed', content: '<p>Unchanged</p>' },
    });
  });

  it('computes the next version number from the current max', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.noteVersion.aggregate.mockResolvedValue({ _max: { versionNumber: null } });
    prisma.note.findUniqueOrThrow.mockResolvedValue(buildNoteWithTags());

    await updateNote(prisma, USER_ID, NOTE_ID, { title: 'Renamed' });

    expect(prisma.noteVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1 }) }),
    );
  });

  it('throws NoteNotFoundError when the note does not exist, is foreign, or is soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(updateNote(prisma, USER_ID, NOTE_ID, { title: 'X' })).rejects.toThrow(
      NoteNotFoundError,
    );
  });
});

describe('softDeleteNote', () => {
  it('sets deletedAt and revokes the active share link', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());

    const result = await softDeleteNote(prisma, USER_ID, NOTE_ID);

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.shareLink.deleteMany).toHaveBeenCalledWith({ where: { noteId: NOTE_ID } });
    expect(result).toEqual({ message: expect.any(String) });
  });

  it('succeeds when the note has no active share link', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());

    await expect(softDeleteNote(prisma, USER_ID, NOTE_ID)).resolves.toBeDefined();
  });

  it('throws NoteNotFoundError when the note does not exist or is foreign', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(softDeleteNote(prisma, USER_ID, NOTE_ID)).rejects.toThrow(NoteNotFoundError);
  });

  it('throws AlreadyDeletedError when the note is already soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote({ deletedAt: new Date() }));

    await expect(softDeleteNote(prisma, USER_ID, NOTE_ID)).rejects.toThrow(AlreadyDeletedError);
  });
});

describe('restoreNote', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores a note deleted 10 days ago (within the 30-day window)', async () => {
    const now = new Date('2026-02-01T00:00:00.000Z');
    vi.setSystemTime(now);
    const deletedAt = new Date(now.getTime() - 10 * 86_400_000);
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote({ deletedAt }));
    prisma.note.update.mockResolvedValue(buildNoteWithTags({ deletedAt: null }));

    const result = await restoreNote(prisma, USER_ID, NOTE_ID);

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: { deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });
    expect(result.note.id).toBe(NOTE_ID);
  });

  it('restores a note at exactly the 30-day boundary (inclusive)', async () => {
    const now = new Date('2026-02-01T00:00:00.000Z');
    vi.setSystemTime(now);
    const deletedAt = new Date(now.getTime() - 30 * 86_400_000);
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote({ deletedAt }));
    prisma.note.update.mockResolvedValue(buildNoteWithTags({ deletedAt: null }));

    await expect(restoreNote(prisma, USER_ID, NOTE_ID)).resolves.toBeDefined();
  });

  it('throws RecoveryExpiredError just past the 30-day window', async () => {
    const now = new Date('2026-02-01T00:00:00.000Z');
    vi.setSystemTime(now);
    const deletedAt = new Date(now.getTime() - 30 * 86_400_000 - 1);
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote({ deletedAt }));

    await expect(restoreNote(prisma, USER_ID, NOTE_ID)).rejects.toThrow(RecoveryExpiredError);
  });

  it('throws NoteNotFoundError when the note does not exist or is foreign', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(restoreNote(prisma, USER_ID, NOTE_ID)).rejects.toThrow(NoteNotFoundError);
  });

  it('throws NotDeletedError when the note is not soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote({ deletedAt: null }));

    await expect(restoreNote(prisma, USER_ID, NOTE_ID)).rejects.toThrow(NotDeletedError);
  });
});
