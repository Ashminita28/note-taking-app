import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  generateShareLink,
  revokeShareLink,
  listShares,
  getSharedNote,
} from '../../src/modules/share/share.service';
import { NoteNotFoundError } from '../../src/modules/notes/notes.errors';
import { ShareLinkNotFoundError, ShareLinkExpiredError } from '../../src/modules/share/share.errors';

const USER_ID = '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01';
const NOTE_ID = '61aec4e7-d98d-48e9-8425-1257b67fcb15';
const TOKEN = 'a92183a4-2b92-4cb1-8762-29a2aa3b971b';

function buildNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: NOTE_ID,
    userId: USER_ID,
    title: 'Note',
    content: '<p>Hello</p>',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildShareLink(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f',
    noteId: NOTE_ID,
    token: TOKEN,
    viewCount: 0,
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockPrisma() {
  const prisma = {
    note: {
      findFirst: vi.fn(),
    },
    shareLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  };
  return prisma as unknown as PrismaClient & {
    note: Record<string, ReturnType<typeof vi.fn>>;
    shareLink: Record<string, ReturnType<typeof vi.fn>>;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-23T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('generateShareLink', () => {
  it('creates a new share link with the default expiry when none is provided', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.shareLink.findUnique.mockResolvedValue(null);
    prisma.shareLink.create.mockResolvedValue(buildShareLink());

    const result = await generateShareLink(prisma, USER_ID, NOTE_ID, {});

    expect(prisma.note.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, userId: USER_ID, deletedAt: null },
    });
    expect(prisma.shareLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ noteId: NOTE_ID, viewCount: 0 }),
    });
    expect(result.shareLink.token).toBe(TOKEN);
    expect(result.shareLink.viewCount).toBe(0);
    expect(result.shareLink.url).toContain(`/shared/${TOKEN}`);
  });

  it('creates a new share link honoring a custom expiresInHours', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.shareLink.findUnique.mockResolvedValue(null);
    prisma.shareLink.create.mockResolvedValue(buildShareLink());

    await generateShareLink(prisma, USER_ID, NOTE_ID, { expiresInHours: 24 });

    const callArgs = prisma.shareLink.create.mock.calls[0][0];
    const expectedExpiresAt = new Date(Date.now() + 24 * 3_600_000);
    expect(callArgs.data.expiresAt.getTime()).toBe(expectedExpiresAt.getTime());
  });

  it('returns the existing active share link unchanged, without creating or updating', async () => {
    const prisma = createMockPrisma();
    const existing = buildShareLink({ viewCount: 3 });
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.shareLink.findUnique.mockResolvedValue(existing);

    const result = await generateShareLink(prisma, USER_ID, NOTE_ID, {});

    expect(prisma.shareLink.create).not.toHaveBeenCalled();
    expect(prisma.shareLink.update).not.toHaveBeenCalled();
    expect(result.shareLink.token).toBe(existing.token);
    expect(result.shareLink.viewCount).toBe(3);
  });

  it('regenerates an expired existing share link in place (new token, reset viewCount)', async () => {
    const prisma = createMockPrisma();
    const expired = buildShareLink({
      token: 'old-token',
      viewCount: 7,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const regenerated = buildShareLink({ token: 'new-token', viewCount: 0 });
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.shareLink.findUnique.mockResolvedValue(expired);
    prisma.shareLink.update.mockResolvedValue(regenerated);

    const result = await generateShareLink(prisma, USER_ID, NOTE_ID, {});

    expect(prisma.shareLink.create).not.toHaveBeenCalled();
    expect(prisma.shareLink.update).toHaveBeenCalledWith({
      where: { noteId: NOTE_ID },
      data: expect.objectContaining({ viewCount: 0 }),
    });
    expect(result.shareLink.token).toBe('new-token');
  });

  it('throws NoteNotFoundError when the note does not exist, is foreign, or is soft-deleted', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(generateShareLink(prisma, USER_ID, NOTE_ID, {})).rejects.toThrow(
      NoteNotFoundError,
    );
    expect(prisma.shareLink.findUnique).not.toHaveBeenCalled();
  });
});

describe('revokeShareLink', () => {
  it('deletes the existing share link', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.shareLink.findUnique.mockResolvedValue(buildShareLink());

    const result = await revokeShareLink(prisma, USER_ID, NOTE_ID);

    expect(prisma.shareLink.delete).toHaveBeenCalledWith({ where: { noteId: NOTE_ID } });
    expect(result.message).toEqual(expect.any(String));
  });

  it('throws NoteNotFoundError when the note does not exist or is foreign', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(revokeShareLink(prisma, USER_ID, NOTE_ID)).rejects.toThrow(NoteNotFoundError);
    expect(prisma.shareLink.findUnique).not.toHaveBeenCalled();
  });

  it('throws ShareLinkNotFoundError when the note has no active share link', async () => {
    const prisma = createMockPrisma();
    prisma.note.findFirst.mockResolvedValue(buildNote());
    prisma.shareLink.findUnique.mockResolvedValue(null);

    await expect(revokeShareLink(prisma, USER_ID, NOTE_ID)).rejects.toThrow(
      ShareLinkNotFoundError,
    );
    expect(prisma.shareLink.delete).not.toHaveBeenCalled();
  });
});

describe('listShares', () => {
  it('lists active share links scoped to the user, excluding expired ones via the where filter', async () => {
    const prisma = createMockPrisma();
    prisma.shareLink.findMany.mockResolvedValue([
      {
        ...buildShareLink(),
        note: { id: NOTE_ID, title: 'Note' },
      },
    ]);

    const result = await listShares(prisma, USER_ID);

    expect(prisma.shareLink.findMany).toHaveBeenCalledWith({
      where: { expiresAt: { gt: expect.any(Date) }, note: { userId: USER_ID } },
      include: { note: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.shares).toEqual([
      expect.objectContaining({ noteId: NOTE_ID, noteTitle: 'Note', viewCount: 0 }),
    ]);
  });

  it('returns an empty list when there are no active share links', async () => {
    const prisma = createMockPrisma();
    prisma.shareLink.findMany.mockResolvedValue([]);

    const result = await listShares(prisma, USER_ID);

    expect(result.shares).toEqual([]);
  });
});

describe('getSharedNote', () => {
  it('throws ShareLinkNotFoundError when the token does not exist', async () => {
    const prisma = createMockPrisma();
    prisma.shareLink.findUnique.mockResolvedValue(null);

    await expect(getSharedNote(prisma, TOKEN)).rejects.toThrow(ShareLinkNotFoundError);
    expect(prisma.shareLink.updateMany).not.toHaveBeenCalled();
  });

  it('throws ShareLinkExpiredError when the link has expired, without incrementing viewCount', async () => {
    const prisma = createMockPrisma();
    prisma.shareLink.findUnique.mockResolvedValue({
      ...buildShareLink({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
      note: { ...buildNote(), user: { name: 'Jane Doe' } },
    });

    await expect(getSharedNote(prisma, TOKEN)).rejects.toThrow(ShareLinkExpiredError);
    expect(prisma.shareLink.updateMany).not.toHaveBeenCalled();
  });

  it('throws ShareLinkNotFoundError when the associated note is soft-deleted (defensive)', async () => {
    const prisma = createMockPrisma();
    prisma.shareLink.findUnique.mockResolvedValue({
      ...buildShareLink(),
      note: { ...buildNote({ deletedAt: new Date() }), user: { name: 'Jane Doe' } },
    });

    await expect(getSharedNote(prisma, TOKEN)).rejects.toThrow(ShareLinkNotFoundError);
    expect(prisma.shareLink.updateMany).not.toHaveBeenCalled();
  });

  it('atomically increments viewCount and returns a read-only note view with no id/tags/email', async () => {
    const prisma = createMockPrisma();
    prisma.shareLink.findUnique.mockResolvedValue({
      ...buildShareLink(),
      note: { ...buildNote(), user: { name: 'Jane Doe', email: 'jane@example.com' } },
    });
    prisma.shareLink.updateMany.mockResolvedValue({ count: 1 });

    const result = await getSharedNote(prisma, TOKEN);

    expect(prisma.shareLink.updateMany).toHaveBeenCalledWith({
      where: { token: TOKEN, expiresAt: { gt: expect.any(Date) } },
      data: { viewCount: { increment: 1 } },
    });
    expect(result).toEqual({
      note: {
        title: 'Note',
        content: '<p>Hello</p>',
        authorName: 'Jane Doe',
        createdAt: expect.any(String),
      },
    });
    expect(result.note).not.toHaveProperty('id');
    expect(result.note).not.toHaveProperty('tags');
    expect(result.note).not.toHaveProperty('email');
    expect(result.note).not.toHaveProperty('viewCount');
  });
});
