import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  listVersions,
  getVersion,
  restoreVersion,
  purgeOldVersions,
} from '../../src/modules/versions/versions.service';
import { NoteNotFoundError } from '../../src/modules/notes/notes.errors';
import { VersionNotFoundError } from '../../src/modules/versions/versions.errors';

const USER_ID = '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01';
const NOTE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

function buildNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: NOTE_ID,
    userId: USER_ID,
    title: 'Current',
    content: '<p>current</p>',
    contentPlain: 'current',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildVersion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f',
    noteId: NOTE_ID,
    versionNumber: 1,
    title: 'Original',
    content: '<p>original</p>',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockPrisma() {
  const prisma = {
    note: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    noteVersion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
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
    noteVersion: Record<string, ReturnType<typeof vi.fn>>;
    $transaction: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-23T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('listVersions', () => {
  it('lists versions newest-first with a truncated content preview', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    const longContent = 'x'.repeat(250);
    prisma.noteVersion.findMany.mockResolvedValue([
      buildVersion({ versionNumber: 2, content: longContent }),
      buildVersion({ versionNumber: 1 }),
    ]);

    const result = await listVersions(prisma, USER_ID, NOTE_ID);

    expect(prisma.noteVersion.findMany).toHaveBeenCalledWith({
      where: { noteId: NOTE_ID },
      orderBy: { versionNumber: 'desc' },
    });
    expect(result.versions[0].versionNumber).toBe(2);
    expect(result.versions[0].contentPreview).toHaveLength(200);
    expect(result.versions[0].contentPreview).toBe(longContent.slice(0, 200));
    expect(result.versions[0]).not.toHaveProperty('content');
  });

  it('throws NoteNotFoundError when the note does not exist, is foreign, or is soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(listVersions(prisma, USER_ID, NOTE_ID)).rejects.toThrow(NoteNotFoundError);
    expect(prisma.noteVersion.findMany).not.toHaveBeenCalled();
  });
});

describe('getVersion', () => {
  it('returns the full content of the requested version', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.noteVersion.findUnique.mockResolvedValue(buildVersion({ versionNumber: 2 }));

    const result = await getVersion(prisma, USER_ID, NOTE_ID, 2);

    expect(prisma.noteVersion.findUnique).toHaveBeenCalledWith({
      where: { noteId_versionNumber: { noteId: NOTE_ID, versionNumber: 2 } },
    });
    expect(result.version).toEqual({
      versionNumber: 2,
      title: 'Original',
      content: '<p>original</p>',
      createdAt: expect.any(String),
    });
  });

  it('throws VersionNotFoundError when the versionNumber does not exist for the note', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.noteVersion.findUnique.mockResolvedValue(null);

    await expect(getVersion(prisma, USER_ID, NOTE_ID, 99)).rejects.toThrow(VersionNotFoundError);
  });

  it('throws NoteNotFoundError before checking the version when the note is missing/foreign/soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(getVersion(prisma, USER_ID, NOTE_ID, 1)).rejects.toThrow(NoteNotFoundError);
    expect(prisma.noteVersion.findUnique).not.toHaveBeenCalled();
  });
});

describe('restoreVersion', () => {
  it('updates the note from the target version, recomputes contentPlain, and creates a new version', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    const target = buildVersion({ versionNumber: 1, title: 'Original', content: '<p>original</p>' });
    prisma.noteVersion.findUnique.mockResolvedValue(target);
    prisma.noteVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 3 } });
    prisma.note.findUniqueOrThrow.mockResolvedValue({
      ...buildNote({ title: 'Original', content: '<p>original</p>' }),
      tags: [],
    });

    const result = await restoreVersion(prisma, USER_ID, NOTE_ID, 1);

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: { title: 'Original', content: '<p>original</p>', contentPlain: 'original' },
    });
    expect(prisma.noteVersion.create).toHaveBeenCalledWith({
      data: { noteId: NOTE_ID, versionNumber: 4, title: 'Original', content: '<p>original</p>' },
    });
    expect(result.note.title).toBe('Original');
  });

  it('creates version 1 when no prior version exists (defensive max fallback)', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.noteVersion.findUnique.mockResolvedValue(buildVersion());
    prisma.noteVersion.aggregate.mockResolvedValue({ _max: { versionNumber: null } });
    prisma.note.findUniqueOrThrow.mockResolvedValue({ ...buildNote(), tags: [] });

    await restoreVersion(prisma, USER_ID, NOTE_ID, 1);

    expect(prisma.noteVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1 }) }),
    );
  });

  it('throws VersionNotFoundError without starting a transaction when the version is missing', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.noteVersion.findUnique.mockResolvedValue(null);

    await expect(restoreVersion(prisma, USER_ID, NOTE_ID, 99)).rejects.toThrow(VersionNotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws NoteNotFoundError without checking the version when the note is missing/foreign/soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(restoreVersion(prisma, USER_ID, NOTE_ID, 1)).rejects.toThrow(NoteNotFoundError);
    expect(prisma.noteVersion.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('purgeOldVersions', () => {
  it('purges only notes above the retention threshold, excluding the most recent versions and recent timestamps', async () => {
    const prisma = createMockPrisma();
    prisma.noteVersion.groupBy.mockResolvedValue([
      { noteId: 'note-over', _count: { id: 15 } },
      { noteId: 'note-under', _count: { id: 6 } },
    ]);
    prisma.noteVersion.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `retained-${i}` })),
    );
    prisma.noteVersion.deleteMany.mockResolvedValue({ count: 5 });

    const deleted = await purgeOldVersions(prisma);

    expect(prisma.noteVersion.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.noteVersion.findMany).toHaveBeenCalledWith({
      where: { noteId: 'note-over' },
      orderBy: { versionNumber: 'desc' },
      take: 10,
      select: { id: true },
    });
    expect(prisma.noteVersion.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.noteVersion.deleteMany).toHaveBeenCalledWith({
      where: {
        noteId: 'note-over',
        id: { notIn: Array.from({ length: 10 }, (_, i) => `retained-${i}`) },
        createdAt: { lt: expect.any(Date) },
      },
    });
    expect(deleted).toBe(5);
  });

  it('purges nothing when every note is at or below the retention threshold', async () => {
    const prisma = createMockPrisma();
    prisma.noteVersion.groupBy.mockResolvedValue([{ noteId: 'note-a', _count: { id: 10 } }]);

    const deleted = await purgeOldVersions(prisma);

    expect(prisma.noteVersion.findMany).not.toHaveBeenCalled();
    expect(prisma.noteVersion.deleteMany).not.toHaveBeenCalled();
    expect(deleted).toBe(0);
  });

  it('evaluates each eligible note independently and sums the deleted counts', async () => {
    const prisma = createMockPrisma();
    prisma.noteVersion.groupBy.mockResolvedValue([
      { noteId: 'note-1', _count: { id: 15 } },
      { noteId: 'note-2', _count: { id: 20 } },
    ]);
    prisma.noteVersion.findMany.mockResolvedValue([]);
    prisma.noteVersion.deleteMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 7 });

    const deleted = await purgeOldVersions(prisma);

    expect(prisma.noteVersion.deleteMany).toHaveBeenCalledTimes(2);
    expect(deleted).toBe(10);
  });
});
