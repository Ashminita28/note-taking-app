import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { searchNotes } from '../../src/modules/search/search.service';

const USER_ID = '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01';
const NOTE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const TAG_ID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';

function createMockPrisma() {
  const prisma = { $queryRaw: vi.fn() };
  return prisma as unknown as PrismaClient & { $queryRaw: ReturnType<typeof vi.fn> };
}

describe('searchNotes', () => {
  it('maps raw rows and the count row into the response shape', async () => {
    const prisma = createMockPrisma();
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: NOTE_ID,
          title: 'Weekly Standup Notes',
          snippet: '<mark>Standup</mark> notes',
          rank: 0.6079271,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ count: 1n }]);

    const result = await searchNotes(prisma, USER_ID, { q: 'standup', page: 1, pageSize: 20 });

    expect(result).toEqual({
      data: [
        {
          id: NOTE_ID,
          title: 'Weekly Standup Notes',
          snippet: '<mark>Standup</mark> notes',
          rank: 0.6079271,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('returns an empty page with totalPages 0 when there are no matches', async () => {
    const prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

    const result = await searchNotes(prisma, USER_ID, {
      q: 'nonexistentterm',
      page: 1,
      pageSize: 20,
    });

    expect(result).toEqual({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });

  it('computes totalPages across multiple pages from a bigint count', async () => {
    const prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 25n }]);

    const result = await searchNotes(prisma, USER_ID, { q: 'term', page: 2, pageSize: 20 });

    expect(result.pagination).toEqual({ page: 2, pageSize: 20, totalItems: 25, totalPages: 2 });
  });

  it('passes the pagination offset computed from page/pageSize to the data query', async () => {
    const prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

    await searchNotes(prisma, USER_ID, { q: 'term', page: 3, pageSize: 10 });

    const dataCallArgs = prisma.$queryRaw.mock.calls[0];
    // Template values, in source order: tsQuery (ts_rank), tsQuery (ts_headline), where, pageSize, offset.
    expect(dataCallArgs[4]).toBe(10); // pageSize
    expect(dataCallArgs[5]).toBe(20); // offset = (3 - 1) * 10
  });

  it('scopes the shared WHERE fragment to userId and the search query, with no tag filter', async () => {
    const prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

    await searchNotes(prisma, USER_ID, { q: 'roadmap', page: 1, pageSize: 20 });

    const dataCallArgs = prisma.$queryRaw.mock.calls[0];
    const countCallArgs = prisma.$queryRaw.mock.calls[1];
    const whereFromData = dataCallArgs[3];
    const whereFromCount = countCallArgs[1];

    expect(whereFromData.text).not.toContain('HAVING');
    expect(whereFromData.values).toContain(USER_ID);
    // q is converted into a prefix tsquery ("term:*") so partial input matches longer words.
    expect(whereFromData.values).toContain('roadmap:*');
    // Data and count queries must share the exact same WHERE fragment so they never disagree.
    expect(whereFromCount).toBe(whereFromData);
  });

  it('adds a HAVING COUNT(DISTINCT tagId) fragment when tagIds are provided', async () => {
    const prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

    await searchNotes(prisma, USER_ID, { q: 'budget', page: 1, pageSize: 20, tagIds: [TAG_ID] });

    const dataCallArgs = prisma.$queryRaw.mock.calls[0];
    const where = dataCallArgs[3];

    expect(where.text).toContain('HAVING COUNT(DISTINCT');
    expect(where.values).toContain(TAG_ID);
    expect(where.values).toContain(1);
  });
});
