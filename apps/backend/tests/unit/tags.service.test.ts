import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createTag, listTags, updateTag, deleteTag } from '../../src/modules/tags/tags.service';
import { TagNameExistsError, TagNotFoundError } from '../../src/modules/tags/tags.errors';

const USER_ID = '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01';
const TAG_ID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';
const OTHER_TAG_ID = 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70';

function buildTag(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TAG_ID,
    userId: USER_ID,
    name: 'Work',
    color: '#6B7280',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockPrisma() {
  const prisma = {
    tag: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return prisma as unknown as PrismaClient & {
    tag: Record<string, ReturnType<typeof vi.fn>>;
  };
}

describe('createTag', () => {
  it('creates a tag with the given name and color', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValue(null);
    prisma.tag.create.mockResolvedValue(buildTag({ name: 'Work', color: '#FF5733' }));

    const result = await createTag(prisma, USER_ID, { name: 'Work', color: '#FF5733' });

    expect(prisma.tag.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, name: { equals: 'Work', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(prisma.tag.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, name: 'Work', color: '#FF5733' },
    });
    expect(result.name).toBe('Work');
    expect(result.color).toBe('#FF5733');
  });

  it('throws TagNameExistsError when the case-insensitive pre-check finds a match', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValue({ id: TAG_ID });

    await expect(createTag(prisma, USER_ID, { name: 'WORK', color: '#6B7280' })).rejects.toThrow(
      TagNameExistsError,
    );
    expect(prisma.tag.create).not.toHaveBeenCalled();
  });
});

describe('listTags', () => {
  it('orders tags alphabetically by name and maps non-deleted note counts', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findMany.mockResolvedValue([
      { ...buildTag({ name: 'Archive' }), _count: { notes: 0 } },
      { ...buildTag({ name: 'Work' }), _count: { notes: 3 } },
    ]);

    const result = await listTags(prisma, USER_ID);

    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { name: 'asc' },
      include: { _count: { select: { notes: { where: { note: { deletedAt: null } } } } } },
    });
    expect(result.tags).toEqual([
      { id: TAG_ID, name: 'Archive', color: '#6B7280', noteCount: 0 },
      { id: TAG_ID, name: 'Work', color: '#6B7280', noteCount: 3 },
    ]);
  });

  it('returns an empty list when the user has no tags', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findMany.mockResolvedValue([]);

    const result = await listTags(prisma, USER_ID);

    expect(result.tags).toEqual([]);
  });
});

describe('updateTag', () => {
  it('throws TagNotFoundError when the tag does not exist or belongs to another user', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValue(null);

    await expect(updateTag(prisma, USER_ID, TAG_ID, { name: 'Office' })).rejects.toThrow(
      TagNotFoundError,
    );
    expect(prisma.tag.update).not.toHaveBeenCalled();
  });

  it('updates only the name when color is omitted', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValueOnce(buildTag()).mockResolvedValueOnce(null);
    prisma.tag.update.mockResolvedValue(buildTag({ name: 'Office' }));

    await updateTag(prisma, USER_ID, TAG_ID, { name: 'Office' });

    expect(prisma.tag.update).toHaveBeenCalledWith({ where: { id: TAG_ID }, data: { name: 'Office' } });
  });

  it('updates only the color when name is omitted', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValue(buildTag());
    prisma.tag.update.mockResolvedValue(buildTag({ color: '#00FF00' }));

    await updateTag(prisma, USER_ID, TAG_ID, { color: '#00FF00' });

    expect(prisma.tag.update).toHaveBeenCalledWith({
      where: { id: TAG_ID },
      data: { color: '#00FF00' },
    });
  });

  it('updates both name and color when both are provided', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValueOnce(buildTag()).mockResolvedValueOnce(null);
    prisma.tag.update.mockResolvedValue(buildTag({ name: 'Office', color: '#00FF00' }));

    await updateTag(prisma, USER_ID, TAG_ID, { name: 'Office', color: '#00FF00' });

    expect(prisma.tag.update).toHaveBeenCalledWith({
      where: { id: TAG_ID },
      data: { name: 'Office', color: '#00FF00' },
    });
  });

  it('excludes the tag being updated from its own duplicate-name check', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValueOnce(buildTag()).mockResolvedValueOnce(null);
    prisma.tag.update.mockResolvedValue(buildTag({ name: 'WORK' }));

    await updateTag(prisma, USER_ID, TAG_ID, { name: 'WORK' });

    expect(prisma.tag.findFirst).toHaveBeenNthCalledWith(2, {
      where: { userId: USER_ID, name: { equals: 'WORK', mode: 'insensitive' }, id: { not: TAG_ID } },
      select: { id: true },
    });
  });

  it('throws TagNameExistsError when the new name collides with a different tag', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst
      .mockResolvedValueOnce(buildTag())
      .mockResolvedValueOnce({ id: OTHER_TAG_ID });

    await expect(updateTag(prisma, USER_ID, TAG_ID, { name: 'Personal' })).rejects.toThrow(
      TagNameExistsError,
    );
    expect(prisma.tag.update).not.toHaveBeenCalled();
  });

  it('does not run the duplicate-name check when name is not being changed', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValue(buildTag());
    prisma.tag.update.mockResolvedValue(buildTag({ color: '#00FF00' }));

    await updateTag(prisma, USER_ID, TAG_ID, { color: '#00FF00' });

    expect(prisma.tag.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('deleteTag', () => {
  it('throws TagNotFoundError when the tag does not exist or belongs to another user', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValue(null);

    await expect(deleteTag(prisma, USER_ID, TAG_ID)).rejects.toThrow(TagNotFoundError);
    expect(prisma.tag.delete).not.toHaveBeenCalled();
  });

  it('deletes the tag and returns a success message', async () => {
    const prisma = createMockPrisma();
    prisma.tag.findFirst.mockResolvedValue(buildTag());
    prisma.tag.delete.mockResolvedValue(buildTag());

    const result = await deleteTag(prisma, USER_ID, TAG_ID);

    expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: TAG_ID } });
    expect(result).toEqual({ message: 'Tag deleted successfully.' });
  });
});
