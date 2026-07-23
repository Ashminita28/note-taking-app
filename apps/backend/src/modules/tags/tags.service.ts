import type { PrismaClient, Tag } from '@prisma/client';
import type {
  CreateTagRequest,
  UpdateTagRequest,
  TagResponse,
  ListTagsResponse,
  DeleteTagResponse,
} from '@note-app/shared';
import { TagNameExistsError, TagNotFoundError } from './tags.errors.js';

function toTagResponse(tag: Tag): TagResponse {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

/** Case-insensitive per-user name uniqueness check (BR-005); `excludeId` lets an update ignore its own row. */
async function assertNameAvailable(
  prisma: PrismaClient,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.tag.findFirst({
    where: {
      userId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new TagNameExistsError();
  }
}

export async function createTag(
  prisma: PrismaClient,
  userId: string,
  input: CreateTagRequest,
): Promise<TagResponse> {
  await assertNameAvailable(prisma, userId, input.name);

  const tag = await prisma.tag.create({
    data: { userId, name: input.name, color: input.color },
  });

  return toTagResponse(tag);
}

export async function listTags(prisma: PrismaClient, userId: string): Promise<ListTagsResponse> {
  const tags = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { notes: { where: { note: { deletedAt: null } } } } } },
  });

  return {
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      noteCount: tag._count.notes,
    })),
  };
}

export async function updateTag(
  prisma: PrismaClient,
  userId: string,
  tagId: string,
  input: UpdateTagRequest,
): Promise<TagResponse> {
  const existing = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!existing) {
    throw new TagNotFoundError();
  }

  if (input.name !== undefined) {
    await assertNameAvailable(prisma, userId, input.name, tagId);
  }

  const tag = await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
  });

  return toTagResponse(tag);
}

export async function deleteTag(
  prisma: PrismaClient,
  userId: string,
  tagId: string,
): Promise<DeleteTagResponse> {
  const existing = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!existing) {
    throw new TagNotFoundError();
  }

  await prisma.tag.delete({ where: { id: tagId } });

  return { message: 'Tag deleted successfully.' };
}
