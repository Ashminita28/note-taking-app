import type { Request, Response } from 'express';
import type { CreateTagRequest, UpdateTagRequest, TagIdParam } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import { listTags, createTag, updateTag, deleteTag } from './tags.service.js';

export async function listTagsHandler(req: Request, res: Response): Promise<void> {
  const result = await listTags(prisma, req.userId as string);
  res.status(200).json(result);
}

export async function createTagHandler(req: Request, res: Response): Promise<void> {
  const tag = await createTag(prisma, req.userId as string, req.body as CreateTagRequest);
  res.status(201).json({ tag });
}

export async function updateTagHandler(
  req: Request<TagIdParam>,
  res: Response,
): Promise<void> {
  const tag = await updateTag(
    prisma,
    req.userId as string,
    req.params.id,
    req.body as UpdateTagRequest,
  );
  res.status(200).json({ tag });
}

export async function deleteTagHandler(
  req: Request<TagIdParam>,
  res: Response,
): Promise<void> {
  const result = await deleteTag(prisma, req.userId as string, req.params.id);
  res.status(200).json(result);
}
